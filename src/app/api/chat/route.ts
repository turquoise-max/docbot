import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { streamText, tool, convertToModelMessages } from 'ai'
import { z } from 'zod'

export const maxDuration = 30

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
})

export async function POST(req: Request) {
  const { messages, editorContext, selectedHtml, selectedText } = await req.json()

  const systemPrompt = `
당신은 "문서봇"의 전문 AI 문서 작성 도우미입니다.
사용자가 실무 문서(기획서, 제안서, 보고서 등)를 작성하는 것을 돕습니다.

[작업 모드]
1. 드래그 텍스트/HTML 없음: 일반 아이디에이션, 초안 생성, 문서 구조 제안.
2. 드래그 영역 있음: 다음의 HTML 원본 부분에 대한 수정, 요약, 확장 요청 처리.

[전체 문서 내용]
${editorContext || '없음'}

<selected_text>
${selectedText || ''}
</selected_text>
<selected_html>
${selectedHtml || ''}
</selected_html>

[도구 사용 지침]
1. 유저가 문서의 목차나 뼈대 작성을 요청하면 반드시 \`generateToc\` 도구를 호출하세요.
2. 유저가 에디터의 특정 텍스트 수정을 요청하면(특히 \`selectedHtml\`이 존재할 때), 기존 서식을 유지한 채 내용만 변경하여 \`updateEditor\` 도구를 호출하세요.
3. 단순한 아이디에이션이나 질문이면 도구를 쓰지 않고 일반 텍스트로 친절하게 답변하세요.

항상 전문적이고 정중한 한국어 실무 톤을 유지하십시오.
`

  // 1. 메시지 형식을 서버 모델용으로 변환 (v5.0+ 스펙에 맞게 await 처리)
  const modelMessages = await convertToModelMessages(messages);

  const result = await streamText({
    model: google('gemini-3-flash-preview'),
    system: systemPrompt,
    messages: modelMessages,
    tools: {
      // 2. parameters 대신 최신 스펙인 inputSchema를 사용합니다.
      generateToc: tool({
        description: '문서의 목차를 생성합니다. 사용자가 목차, 구조, 뼈대 등을 요구할 때 사용합니다.',
        inputSchema: z.object({ // 💡 parameters -> inputSchema 로 변경
          title: z.string().describe('목차의 제목'),
          items: z.array(z.object({
            id: z.string().describe('고유 ID'),
            level: z.number().describe('계층 레벨 (1, 2, 3...)'),
            text: z.string().describe('목차 항목 텍스트')
          })).describe('목차 항목 목록')
        })
      }),
      updateEditor: tool({
        description: '에디터의 선택된 영역을 새로운 내용으로 교체하기 위해 수정된 HTML을 제안합니다.',
        inputSchema: z.object({ // 💡 parameters -> inputSchema 로 변경
          modifiedHtml: z.string().describe('기존 서식을 유지하며 내용이 수정된 완전한 HTML 문자열')
        })
      })
    } // 이제 'as any' 없이도 타입 추론이 완벽하게 작동합니다.
  })

  return result.toTextStreamResponse()
}