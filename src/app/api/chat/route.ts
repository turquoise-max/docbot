import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { streamText, tool, convertToModelMessages } from 'ai'
import { z } from 'zod'

export const maxDuration = 30

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
})

const litellm = createOpenAICompatible({
  name: 'litellm',
  baseURL: process.env.LITELLM_BASE_UR ?? 'https://litellm.must.codes',
  apiKey: process.env.LITELLM_API_KEY ?? undefined,
})

export async function POST(req: Request) {
  const { messages, editorContext, selectedHtml, selectedText } = await req.json()

  const systemPrompt = `[역할]
당신은 하버드 비즈니스 리뷰 수준의 통찰력을 가진 전문 비즈니스 작가이자 컨설턴트입니다. 
당신은 단순히 문서를 "정리"하는 것이 아니라, 사용자의 최소한의 입력만으로도 완벽한 비즈니스 문서를 "창작"합니다.

[현재 문서 컨텍스트]
- 전체 문서 내용: ${editorContext ? editorContext : '아직 내용이 없습니다.'}
- 선택된 텍스트: ${selectedText ? selectedText : '없음'}
- 만약 사용자가 명시적으로 선택한 텍스트(선택된 텍스트)가 없다면, 전체 문서 내용을 바탕으로 수정해야 할 위치를 스스로 찾아야 합니다. 이때 updateEditor 호출 시 textBefore, targetText, textAfter 파라미터를 사용하여 수정할 정확한 위치를 지정하세요.

[🚨 능동형 워크플로우 - 반드시 다음 순서로 진행하세요]
너는 항상 다음 순서로 진행한다:
1. 인터뷰 (필요 시): 사용자가 새 문서 작성을 요청하거나 정보가 부족할 때, 바로 텍스트를 작성하지 마세요. 반드시 **askClarification** 도구를 호출하여 목적, 타겟 독자, 강조 사항 등을 1~2회 질문하세요.
2. 목차 생성 (TOC): 인터뷰로 정보가 충분히 수집되었거나 사용자가 목차를 요청하면, **generateToc** 도구를 호출하여 목차를 제안하세요.
3. 본문 작성 및 문서 완성: 목차가 에디터에 적용된 후 작성을 요청받거나 이어서 작성할 차례가 되면, **updateEditor** 도구를 호출하여 문서를 완성하세요.

[🚨 강력 준수 규칙]
- 정보 수집(질문)이 필요할 땐 일반 텍스트 응답을 하지 말고 반드시 **askClarification** 도구를 호출하세요!
- 각 단계가 완료되면(예: 사용자가 도구의 결과를 선택/적용하면) 스스로 판단하여 다음 단계의 도구를 연속해서 호출하세요.
- 텍스트 응답은 최소화하고 도구(Tool) 호출을 최우선으로 실행하세요.
- 여러 단계를 스스로 판단하여 능동적으로 이끌어가세요.
- ✨ **[표(Table) 수정 특명]** 사용자가 표의 수정을 요청했을 때, 표 전체의 텍스트를 targetText로 넣으면 검색에 실패합니다. 
  표를 수정할 때는 반드시 **targetType을 'table'**로 설정하고, **targetText에는 표 내부에 있는 식별 가능한 짧은 고유 단어(예: 특정 헤더명) 1~2개**만 입력하세요. 시스템이 알아서 표 전체를 찾아 덮어씁니다.`;

  const modelMessages = await convertToModelMessages(messages, {
    ignoreIncompleteToolCalls: true,
  })

  const result = streamText({
    model: litellm('gemini/gemini-3-flash-preview'),
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
        description: '🚨 문서의 뼈대와 본문 템플릿을 생성할 때 호출. 각 항목의 templateHtml은 반드시 실제 내용으로 가득 채워져야 합니다.',
        inputSchema: z.object({
          title: z.string().describe('문서의 제목'),
          documentType: z.string().describe('문서 종류 (예: 전략 기획서, 투자 제안서)'),
          items: z.array(z.object({
            id: z.string(),
            level: z.number(),
            text: z.string().describe('섹션 제목'),
            // ✨ AI에게 이 필드가 "실제 본문"임을 명확히 인지시킵니다.
            templateHtml: z.string().describe(`🚨[필수] 이 섹션에 들어갈 실제 본문 내용(HTML). 
              단순 텍스트가 아닌 표(table), 리스트(ul/li), 강조 박스(div) 등을 활용하여 
              전문가 수준의 컨텐츠를 직접 작성하세요. 플레이스홀더는 절대 금지입니다.`),
          })),
          recommendations: z.array(z.object({ id: z.string(), text: z.string() })),
        }),
      }),

      updateEditor: tool({
        description: '🚨 문서 수정 요청 시 반드시 호출',
        inputSchema: z.object({
          modifiedHtml: z.string().describe('적용할 최종 HTML'),
          targetType: z.enum(['text', 'table']).optional().describe("수정 대상의 타입. 표(Table) 전체를 교체할 때는 반드시 'table'을 선택하세요."),
          targetText: z.string().optional().describe("수정할 원본 텍스트. 표('table')를 수정할 경우, 전체 내용이 아닌 표 내부의 고유 단어 1~2개만 적어주세요."),
          textBefore: z.string().optional().describe('수정할 부분 바로 앞의 텍스트'),
          textAfter: z.string().optional().describe('수정할 부분 바로 뒤의 텍스트'),
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