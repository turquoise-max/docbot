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

  // console.log('messages structure:', JSON.stringify(messages.slice(-3), null, 2));

  // 임시 디버그: convertToModelMessages의 실제 구조 확인 (isSyncOnly 처리 전)
  // try {
  //   const debugModelMessages = await convertToModelMessages(messages.map((m: any) => ({...m, parts: m.parts || []})));
  //   const debugLast = debugModelMessages.length > 0 ? debugModelMessages[debugModelMessages.length - 1] : null;
  //   console.log('=== DEBUG last modelMessage ===');
  //   console.log(JSON.stringify(debugLast, null, 2));
  // } catch(e) {
  //   console.log('debug convert error', e);
  // }

  // [핵심 해결책: Full Sync] 
  // 프론트엔드의 최신 메모리 상태(messages)가 언제나 가장 정확하므로, 
  // 복잡한 Update 대신 기존 내역을 지우고 전체를 덮어씁니다.
  if (documentId && messages.length > 0) {
    try {
      const supabase = await createClient();
      
      const insertData = messages
        // DB 저장 시 시스템 숨김 트리거 문자열이 포함된 메시지는 영구 저장되지 않도록 필터링합니다.
        .filter((m: any) => !m.parts?.some((p: any) => p.text?.startsWith('[SYSTEM_AUTO_TRIGGER:')))
        .map((m: any, index: number) => {
          // 순서 보장을 위해 현재 시간에서 밀리초 단위로 미세한 차이를 둡니다.
          const date = new Date();
          date.setMilliseconds(date.getMilliseconds() + index * 10);
          
          return {
            id: m.id,
            document_id: documentId,
            role: m.role,
            content: JSON.stringify(m.parts || [{ type: 'text', text: m.content || '' }]),
            created_at: date.toISOString(),
          };
        });

      await supabase.from('chat_messages').upsert(insertData, { onConflict: 'id' });

    } catch (err) {
      console.error('[DB Full Sync 오류]', err);
    }
  }

  // 화면 상태 동기화용 백그라운드 핑이면 AI 답변을 생성하지 않고 즉시 200 OK 종료
  if (isSyncOnly) {
    return new Response(JSON.stringify({ success: true, message: 'Sync complete' }), { status: 200 });
  }
  
  const effectiveContext = editorContext;
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
      // result와 output이 둘 다 없는 미완성 도구만 제거 (Vercel AI SDK v6 호환성)
      if (p.type?.startsWith('tool-') && p.state === 'input-available' && p.result === undefined && p.output === undefined) return false;
      return true;
    });
    return { ...m, parts: cleanParts };
  }).filter((m: any) => m.parts && m.parts.length > 0);

  const modelMessages = await convertToModelMessages(validMessages);

  const activeTools = getActiveTools(allowAskClarification);

  const lastMessage = modelMessages.length > 0 ? modelMessages[modelMessages.length - 1] : null;
  
  // 가장 마지막 메시지가 도구 응답(tool)이고, 그 도구가 planDocument인지 확인합니다.
  const isPlanComplete = lastMessage?.role === 'tool' && Array.isArray(lastMessage.content) && lastMessage.content.some(
    (c: any) => c.type === 'tool-result' && c.toolName === 'planDocument'
  );

  const dynamicToolChoice = isPlanComplete ? 'required' : 'auto';

  try {
    const result = streamText({
      model: litellm(process.env.LITELLM_MODEL ?? 'gemini/gemini-3.0-flash-preview'),
      system: systemPrompt,
      messages: modelMessages,
      tools: activeTools,
      toolChoice: dynamicToolChoice,
      // @ts-expect-error maxSteps may not be typed in this ai version
      maxSteps: 3, // 서버 사이드 오케스트레이션(plan -> write) 연속 호출을 위해 3으로 증가
      maxRetries: 1,
      experimental_parallelToolCalls: false, // 도구 병렬 호출 방지
      stopSequences: ['ㅇㅇㅇ', '[AUTO]', '[SYSTEM_AUTO_TRIGGER'], // 무한 반복 및 시스템 트리거 출력 방지
      maxTokens: 8000, // 무한 출력 방지용 상한선
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