import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { streamText, tool, convertToModelMessages, stepCountIs } from 'ai'
import { z } from 'zod'

export const maxDuration = 30

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
})

export async function POST(req: Request) {
  // 1. 프론트엔드에서 보낸 문서 컨텍스트 데이터들을 추출합니다.
  const { messages, editorContext, selectedHtml, selectedText } = await req.json()

  // 2. 추출한 데이터를 AI가 읽을 수 있도록 시스템 프롬프트 안에 동적으로 삽입합니다.
  const systemPrompt = `당신은 문서 작성 및 편집을 돕는 전문 AI 어시스턴트입니다.
사용자가 작성 중인 문서의 전체 내용과 현재 드래그하여 선택한 영역이 아래에 제공됩니다.

=========================================
[현재 작성 중인 문서 전체 내용]
${editorContext ? editorContext : '아직 문서에 내용이 없습니다.'}
=========================================

[현재 사용자가 선택한 텍스트]
${selectedText ? selectedText : '선택된 텍스트가 없습니다.'}

[현재 사용자가 선택한 HTML 구조]
${selectedHtml ? selectedHtml : '선택된 HTML이 없습니다.'}

[컨텍스트 활용 및 구조 인지 규칙]
1. 제공된 '[현재 작성 중인 문서 전체 내용]'을 면밀히 분석하여 문서의 전체적인 논리적 구조(서론, 본론, 결론, 주요 목차 등)를 항상 기억하고 인지하세요.
2. 사용자가 문서 내용에 대해 질문하거나 수정 요청을 하면, 단순히 해당 부분만 보지 말고 "문서 전체 구조 속에서 이 부분이 어떤 역할을 하는지"를 고려하여 답변하세요.
3. '[현재 사용자가 선택한 텍스트]'가 존재한다면, 선택 영역을 우선적으로 고려하되 전체 문맥과 자연스럽게 이어지도록 수정 방향을 제안하세요.

[도구(Tool) 사용 규칙 - 매우 중요]
당신은 다음 두 가지 도구를 사용할 수 있습니다. 상황에 맞게 반드시 도구를 호출하세요.
1. updateEditor: 
   - 사용자가 "선택한 부분 수정해줘", "이 문단을 ~게 바꿔줘", "번역해서 적용해줘" 등 문서 내용의 직접적인 수정이나 교체를 요청한 경우 반드시 이 도구를 호출하세요.
   - 텍스트로만 어떻게 수정할지 설명하지 말고, 수정된 최종 HTML 결과를 이 도구의 'modifiedHtml' 파라미터로 전달하여 에디터에 즉각 적용되게 하세요.
2. generateToc: 
   - 사용자가 "목차 만들어줘", "개요 짜줘"라고 요청한 경우 이 도구를 호출하세요.

[응답 포맷 및 제한 사항]
- 수정/적용 요청이 아닌 단순 질문(예: "이 문서의 주요 인사이트가 뭐야?", "아이디어 좀 내줘")인 경우, 도구를 사용하지 말고 일반 텍스트(마크다운)로 친절하게 답변하세요.
- 답변은 간결하고 명확하게 작성하며, 불필요한 서론은 생략하세요.`

  const modelMessages = await convertToModelMessages(messages)

  const result = streamText({
    model: google('gemini-3-flash-preview'),
    system: systemPrompt,
    messages: modelMessages,
    tools: {
      generateToc: tool({
        description: '문서의 목차를 생성합니다. 제목과 하위 항목들을 포함해야 합니다.',
        inputSchema: z.object({
          title: z.string().describe('목차의 제목'),
          items: z.array(z.object({
            id: z.string(),
            level: z.number(),
            text: z.string()
          }))
        })
      }),
      updateEditor: tool({
        description: '에디터의 내용을 직접 수정하거나 교체합니다.',
        inputSchema: z.object({
          modifiedHtml: z.string().describe('에디터에 적용될 최종 수정된 HTML 문자열')
        })
      })
    },
    stopWhen: stepCountIs(2),
  })

  return result.toUIMessageStreamResponse({
    onError: (error) => {
      console.error('Stream error:', error);
      return '죄송합니다. 처리 중 오류가 발생했습니다.';
    }
  });
}