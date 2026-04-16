import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { streamText, tool, convertToModelMessages } from 'ai'
import { z } from 'zod'

export const maxDuration = 30

const litellm = createOpenAICompatible({
  name: 'litellm',
  baseURL: process.env.LITELLM_BASE_UR ?? 'https://litellm.must.codes',
  apiKey: process.env.LITELLM_API_KEY ?? undefined,
})

export async function POST(req: Request) {
  const { messages, editorContext, selectedHtml, selectedText } = await req.json()

  const isDocumentEmpty = !editorContext || editorContext.trim().length < 50;

  const workflowPrompt = isDocumentEmpty
    ? `[🚨 빈 문서 작성 워크플로우 - 반드시 다음 순서로 진행하세요]
1. 인터뷰 (필요 시): 사용자가 새 문서 작성을 요청하거나 정보가 부족할 때, 바로 텍스트를 작성하지 마세요. 반드시 **askClarification** 도구를 호출하여 목적, 타겟 독자, 강조 사항 등을 1~2회 질문하세요.
2. 목차 생성 (TOC): 인터뷰로 정보가 충분히 수집되었거나 사용자가 목차를 요청하면, **generateToc** 도구를 호출하여 목차를 제안하세요.
3. 본문 작성 및 문서 완성: 목차가 에디터에 적용된 후 작성을 요청받거나 이어서 작성할 차례가 되면, **updateEditor** 도구를 호출하여 문서를 완성하세요.`
    : `[🚨 기존 문서 수정 워크플로우]
- 현재 문서는 이미 내용이 작성되어 있습니다. **사용자가 명시적으로 전체 목차를 다시 짜달라고 요청하지 않는 한 generateToc(목차 생성) 도구는 절대 호출하지 마세요.**
- 일반 텍스트 수정 시 **updateEditor** 도구를, 표 수정 시 **updateTable** 도구를 사용하여 기존 문서를 바로 수정하거나 내용을 추가하세요.
- 정보가 부족하여 수정이 어려운 경우에만 **askClarification**을 호출하여 질문하세요.`;

  const systemPrompt = `[역할]
당신은 하버드 비즈니스 리뷰 수준의 통찰력을 가진 전문 비즈니스 작가이자 컨설턴트입니다. 
당신은 단순히 문서를 "정리"하는 것이 아니라, 사용자의 최소한의 입력만으로도 완벽한 비즈니스 문서를 "창작"합니다.

[현재 문서 컨텍스트]
- 전체 문서 내용: ${editorContext ? editorContext : '아직 내용이 없습니다.'}
- 선택된 텍스트: ${selectedText ? selectedText : '없음'}
- 만약 사용자가 명시적으로 선택한 텍스트(선택된 텍스트)가 없다면, 전체 문서 내용을 바탕으로 수정해야 할 위치를 스스로 찾아야 합니다.

${workflowPrompt}

[🚨 강력 준수 규칙]
- 정보 수집(질문)이 필요할 땐 일반 텍스트 응답을 하지 말고 반드시 **askClarification** 도구를 호출하세요!
- 텍스트 응답은 최소화하고 도구(Tool) 호출을 최우선으로 실행하세요.
- ✨ **[도구 건너뛰기 방어]** 사용자가 도구의 사용을 건너뛰거나 거절한 경우: 해당 도구가 필수 도구라 할지라도 절대 재호출하지 마세요. 대신 "알겠습니다. 건너뛰겠습니다. 원하시는 다른 작업이 있으신가요?"와 같이 일반 텍스트로 자연스럽게 응답하세요.
- 🚨 **[표(Table) 수정 특명]** 사용자가 표의 수정을 요청했을 때, 절대로 **updateEditor** 도구를 사용하지 마세요. 표를 수정할 때는 반드시 **updateTable** 도구를 호출하여 2차원 배열(JSON) 형태로 순수 데이터만 반환해야 합니다. targetKeyword에는 표 내부에 있는 식별 가능한 짧은 고유 단어(예: 특정 헤더명) 1~2개만 입력하세요.`;

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
            templateHtml: z.string().describe(`🚨[필수] 이 섹션에 들어갈 실제 본문 내용(HTML). 
              단순 텍스트가 아닌 표(table), 리스트(ul/li), 강조 박스(div) 등을 활용하여 전문가 수준의 컨텐츠를 직접 작성하세요. 플레이스홀더는 절대 금지입니다.`),
          })),
          recommendations: z.array(z.object({ id: z.string(), text: z.string() })),
        }),
      }),

      // 🚨 변경점: targetType('table')을 스키마에서 완전히 제거!
      updateEditor: tool({
        description: '🚨 문서의 일반 텍스트(단락) 수정 요청 시 반드시 호출. (주의: 표 수정 시에는 절대 사용 금지)',
        inputSchema: z.object({
          modifiedHtml: z.string().describe('적용할 최종 HTML'),
          targetText: z.string().optional().describe("수정할 원본 텍스트"),
          textBefore: z.string().optional().describe('수정할 부분 바로 앞의 텍스트'),
          textAfter: z.string().optional().describe('수정할 부분 바로 뒤의 텍스트'),
        }),
      }),

      // ✨ 표 전용 도구
      updateTable: tool({
        description: '🚨 표(Table)의 데이터를 재작성할 때 반드시 호출. 표의 서식을 유지하기 위해 HTML이 아닌 2차원 배열 데이터를 반환합니다.',
        inputSchema: z.object({
          targetKeyword: z.string().describe('에디터에서 표를 찾기 위한 표 내부의 고유 단어'),
          tableData: z.array(z.array(z.string())).describe('표에 들어갈 새로운 데이터 (예: [["항목", "비용"], ["개발비", "100만"]])'),
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