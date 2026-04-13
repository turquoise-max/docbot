import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { streamText, tool, convertToModelMessages, stepCountIs } from 'ai'  // ← stepCountIs 추가
import { z } from 'zod'

export const maxDuration = 30

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
})

export async function POST(req: Request) {
  const { messages, editorContext, selectedHtml, selectedText } = await req.json()

  const systemPrompt = `[역할]
당신은 문서의 설득력을 극대화하는 전문 비즈니스 컨설턴트이자 인터뷰어입니다.

[현재 문서 컨텍스트]
- 전체 문서 내용: ${editorContext ? editorContext : '아직 내용이 없습니다.'}
- 선택된 텍스트: ${selectedText ? selectedText : '없음'}
- 선택된 영역 서식: ${selectedHtml ? selectedHtml : '없음'}

[🚨 절대 준수 규칙]
1. 정보가 부족하거나 수정 방향이 불분명 → **askClarification** 무조건 호출
2. 목차/개요/구조 요청 → **generateToc** 무조건 호출
3. "수정해줘", "작성해줘", "바꿔줘" 등 수정 요청 → **updateEditor** 무조건 호출
4. 문서 전체에 대한 단순 분석/요약 브리핑 요청 → **일반 텍스트로 친절하게 답변**

도구를 호출해야 하는 상황(1,2,3)에서는 절대 일반 텍스트로만 답변하지 마세요.
도구를 호출한 후에만 필요 시 보조 텍스트를 사용하세요.`

  const modelMessages = await convertToModelMessages(messages, {
    ignoreIncompleteToolCalls: true,
  })

  const result = streamText({
    model: google('gemini-3-flash-preview'),
    system: systemPrompt,
    messages: modelMessages,

    tools: {
      askClarification: tool({
        description: '🚨 정보가 부족할 때 사용자에게 선택지를 제시',
        inputSchema: z.object({
          question: z.string().describe('사용자에게 보여줄 질문'),
          options: z.array(z.object({
            label: z.string().describe('버튼 텍스트'),
            value: z.string().describe('선택 시 전달될 값'),
          })).describe('3~5개 옵션 추천'),
          allowMultiple: z.boolean().optional().default(false),
        }),
      }),

      generateToc: tool({
        description: '🚨 목차/개요 요청 시 반드시 호출',
        inputSchema: z.object({
          title: z.string().describe('목차 제목'),
          documentType: z.string().describe('문서 종류'),
          items: z.array(z.object({
            id: z.string(),
            level: z.number(),
            text: z.string(),
          })).describe('기본 목차 항목'),
          recommendations: z.array(z.object({
            id: z.string(),
            text: z.string(),
          })).describe('추천 항목'),
        }),
      }),

      updateEditor: tool({
        description: '🚨 문서 수정 요청 시 반드시 호출',
        inputSchema: z.object({
          modifiedHtml: z.string().describe('적용할 최종 HTML'),
        }),
      }),
    },

    // ✅ maxSteps 대신 이걸 사용 (TypeScript 에러 해결)
    stopWhen: stepCountIs(3),   // 최대 3단계 (tool call → result → final response)
  })

  return result.toUIMessageStreamResponse({
    onError: (error) => {
      console.error('Stream error:', error)
      return '죄송합니다. 처리 중 오류가 발생했습니다. 다시 시도해주세요.'
    },
  })
}