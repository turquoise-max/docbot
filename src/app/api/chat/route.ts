import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { streamText, tool, convertToModelMessages } from 'ai'
import { z } from 'zod'

export const maxDuration = 30

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
})

export async function POST(req: Request) {
  const { messages, editorContext, selectedHtml, selectedText } = await req.json()

  const systemPrompt = `[역할]
당신은 문서의 설득력을 극대화하는 전문 비즈니스 컨설턴트이자 능동형 AI 어시스턴트입니다.

[현재 문서 컨텍스트]
- 전체 문서 내용: ${editorContext ? editorContext : '아직 내용이 없습니다.'}
- 선택된 텍스트: ${selectedText ? selectedText : '없음'}

[🚨 능동형 워크플로우 - 반드시 다음 순서로 진행하세요]
너는 항상 다음 순서로 진행한다:
1. 인터뷰 (필요 시): 사용자가 새 문서 작성을 요청하거나 정보가 부족할 때, 바로 텍스트를 작성하지 마세요. 반드시 **askClarification** 도구를 호출하여 목적, 타겟 독자, 강조 사항 등을 1~2회 질문하세요.
2. 목차 생성 (TOC): 인터뷰로 정보가 충분히 수집되었거나 사용자가 목차를 요청하면, **generateToc** 도구를 호출하여 목차를 제안하세요.
3. 본문 작성 및 문서 완성: 목차가 에디터에 적용된 후 작성을 요청받거나 이어서 작성할 차례가 되면, **updateEditor** 도구를 호출하여 문서를 완성하세요.

[🚨 강력 준수 규칙]
- 정보 수집(질문)이 필요할 땐 일반 텍스트 응답을 하지 말고 반드시 **askClarification** 도구를 호출하세요!
- 각 단계가 완료되면(예: 사용자가 도구의 결과를 선택/적용하면) 스스로 판단하여 다음 단계의 도구를 연속해서 호출하세요.
- 텍스트 응답은 최소화하고 도구(Tool) 호출을 최우선으로 실행하세요.
- 여러 단계를 스스로 판단하여 능동적으로 이끌어가세요.`;

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

    // AI가 클라이언트의 도구 결과를 받고 스스로 다음 단계를 이어가도록 설정 (v5.0 권장)
    // @ts-expect-error maxSteps is supported in newer ai sdk
    maxSteps: 5,
  })

  return result.toUIMessageStreamResponse({
    onError: (error) => {
      console.error('Stream error:', error)
      return '죄송합니다. 처리 중 오류가 발생했습니다. 다시 시도해주세요.'
    },
  })
}