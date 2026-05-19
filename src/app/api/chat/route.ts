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
  const { documentId, messages, editorContext, selectedText, selectedHtml, isNewDocument } = await req.json()

  console.log('messages structure:', JSON.stringify(messages.slice(-3), null, 2));
  
  let effectiveContext = editorContext;
  let contextInstruction = '';

  if (selectedText) {
    contextInstruction = '사용자가 텍스트를 선택했습니다. 전체 문서보다는 "선택된 텍스트"의 수정에 집중하세요.';
  }

  const isDocumentEmpty = isNewDocument === true;

  // 마법사는 빈 문서이고 아직 한 번도 호출되지 않았을 때만 허용
  const hasEverAskedClarification = JSON.stringify(messages).includes('askClarification');
  const allowAskClarification = isDocumentEmpty && !hasEverAskedClarification;

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
      onFinish: async ({ text, toolResults }) => {
        // [최적화 1] 서버 사이드 DB 저장 (프론트엔드 연결 끊김 대비)
        if (!documentId) return;
        try {
          const supabase = await createClient();

          // 유저 메시지 추출 및 저장 (parts 기반)
          const lastUserMsg = messages[messages.length - 1];
          if (lastUserMsg && lastUserMsg.role === 'user') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const userContent = lastUserMsg.parts?.find((p: any) => p.type === 'text')?.text || '';
            
            if (userContent) {
              await supabase.from('chat_messages').insert({
                document_id: documentId,
                role: 'user',
                content: userContent,
              });
            }
          }

          // 어시스턴트 텍스트 응답 저장
          if (text) {
            await supabase.from('chat_messages').insert({
              document_id: documentId,
              role: 'assistant',
              content: text,
            });
          }

          // 위저드(도구)를 통한 유저 응답도 어시스턴트 턴 안의 result로 존재하므로 이를 유저 메시지로 저장
          if (toolResults && toolResults.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for (const tr of toolResults as any[]) {
              if (tr.toolName === 'askClarification' && tr.result && typeof tr.result === 'string') {
                await supabase.from('chat_messages').insert({
                  document_id: documentId,
                  role: 'user',
                  content: tr.result,
                });
              }
            }
          }
        } catch (err) {
          console.error('[서버 DB 저장 오류]', err);
        }
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