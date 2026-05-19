// .env.local에 LITELLM_MODEL 변수를 추가하여 사용할 모델을 설정하세요. (기본값: gemini/gemini-3.0-flash-preview)
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { streamText, createUIMessageStreamResponse, convertToModelMessages } from 'ai'
import { createClient } from '@/lib/supabase/server'
import { getSystemPrompt } from '@/lib/ai/prompts';
import { getActiveTools } from '@/lib/ai/tools';
import { generateText } from 'ai';

export const maxDuration = 60 // 파이프라인 대기 시간을 위해 증가

const litellm = createOpenAICompatible({
  name: 'litellm',
  baseURL: process.env.LITELLM_BASE_URL ?? 'https://litellm.must.codes',
  apiKey: process.env.LITELLM_API_KEY ?? undefined,
})

export async function POST(req: Request) {
  const { documentId, messages, editorContext, selectedText, selectedHtml, isNewDocument, isSyncOnly } = await req.json()

  console.log('messages structure:', JSON.stringify(messages.slice(-3), null, 2));

  // [핵심 해결책: Full Sync] 
  // 프론트엔드의 최신 메모리 상태(messages)가 언제나 가장 정확하므로, 
  // 복잡한 Update 대신 기존 내역을 지우고 전체를 덮어씁니다.
  if (documentId && messages.length > 0) {
    try {
      const supabase = await createClient();
      
      // 1. 기존 문서의 채팅 내역 전부 삭제
      await supabase.from('chat_messages').delete().eq('document_id', documentId);

      // 2. 현재 넘어온 최신 messages 배열 전체 삽입
      // 순서를 보장하기 위해 한 번에 bulk insert 합니다.
      const insertData = messages.map((m: any, index: number) => {
        // 순서 보장을 위해 현재 시간에서 밀리초 단위로 미세한 차이를 둡니다.
        const date = new Date();
        date.setMilliseconds(date.getMilliseconds() + index * 10);
        
        return {
          document_id: documentId,
          role: m.role,
          content: JSON.stringify(m.parts || [{ type: 'text', text: m.content || '' }]),
          created_at: date.toISOString(),
        };
      });

      await supabase.from('chat_messages').insert(insertData);

    } catch (err) {
      console.error('[DB Full Sync 오류]', err);
    }
  }

  // 화면 상태 동기화용 백그라운드 핑이면 AI 답변을 생성하지 않고 즉시 200 OK 종료
  if (isSyncOnly) {
    return new Response(JSON.stringify({ success: true, message: 'Sync complete' }), { status: 200 });
  }
  
  let effectiveContext = editorContext;
  let contextInstruction = '';

  if (selectedText) {
    contextInstruction = '사용자가 텍스트를 선택했습니다. 전체 문서보다는 "선택된 텍스트"의 수정에 집중하세요.';
  }

  const isDocumentEmpty = isNewDocument === true;

  // 마법사는 빈 문서이고 아직 한 번도 호출되지 않았을 때만 허용
  const hasEverAskedClarification = JSON.stringify(messages).includes('askClarification');
  // Gemini 히스토리 검증(400 에러) 방지: 히스토리에 도구가 존재하면 무조건 스키마를 넘겨야 함
  const allowAskClarification = isDocumentEmpty || hasEverAskedClarification;

  const systemPrompt = getSystemPrompt(
    effectiveContext,
    selectedText,
    selectedHtml,
    contextInstruction,
    isDocumentEmpty
  );

  // AI SDK v6 엄격한 스펙 검증: 모든 메시지는 반드시 parts 배열을 가져야 하며, 각 part는 type을 가져야 함
  for (const m of messages) {
    if (!Array.isArray(m.parts)) {
      console.error(`Invalid UIMessage: parts missing for role=${m.role}`, m);
      throw new Error(`Invalid UIMessage: parts missing for role=${m.role}`);
    }

    for (const part of m.parts) {
      if (!part.type) {
        console.error(`Invalid part: missing type in message role=${m.role}`, part);
        throw new Error(`Invalid part: missing type`);
      }
    }
  }

  // 완료되지 않은 도구 호출(pending 툴)만 안전하게 필터링
  const validMessages = messages.map((m: any) => {
    const cleanParts = m.parts.filter((p: any) => {
      if (p.type?.startsWith('tool-') && p.state === 'input-available' && p.result === undefined) return false;
      return true;
    });
    return { ...m, parts: cleanParts };
  }).filter((m: any) => m.parts && m.parts.length > 0);

  const modelMessages = await convertToModelMessages(validMessages);

  const activeTools = getActiveTools(allowAskClarification);

  try {
    const result = streamText({
      model: litellm(process.env.LITELLM_MODEL ?? 'gemini/gemini-3.0-flash-preview'),
      system: systemPrompt,
      messages: modelMessages,
      tools: activeTools,
      // @ts-expect-error maxSteps may not be typed in this ai version
      maxSteps: 2, // 클라이언트 오케스트레이션 적용 (한 턴당 1번의 툴 호출 + 텍스트 응답 정도만 허용하여 타임아웃 방지)
      maxRetries: 1,
      experimental_parallelToolCalls: false, // 도구 병렬 호출 방지
      // 진실의 원천이 클라이언트의 messages 배열이 되도록 아키텍처를 변경했으므로, 
      // 불완전하게 저장될 수 있는 서버 측 onFinish의 DB 개별 저장 로직은 과감하게 제거합니다.
      // (대신 클라이언트에서 스트리밍 종료 시점에 현재 상태를 Sync 통신으로 서버에 밀어넣습니다)
      onFinish: async () => {
        // No-op
      }
    })

    return createUIMessageStreamResponse({
      stream: result.toUIMessageStream(),
    })
  } catch (error) {
    console.error('Chat API Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}