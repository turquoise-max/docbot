import { anthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'

export const maxDuration = 30

export async function POST(req: Request) {
  const { messages, editorContext, selectedText } = await req.json()

  const systemPrompt = `
당신은 "문서봇"의 전문 AI 문서 작성 도우미입니다.
사용자가 실무 문서(기획서, 제안서, 보고서 등)를 작성하는 것을 돕습니다.

[작업 모드]
1. 드래그 텍스트 없음: 일반 아이디에이션, 초안 생성, 문서 구조 제안.
2. 드래그 텍스트 있음: "${selectedText}" 부분에 대한 수정, 요약, 확장 요청 처리.

[에디터 제어 프로토콜]
문서의 특정 부분을 직접 수정하거나 초안을 작성해야 할 경우, 
반드시 답변에 \`[UPDATE_EDITOR_BLOCK]: <blockId> 블록아이디 </blockId> <html>내용</html>\` 형식을 사용하십시오.
사용자는 이 내용을 에디터에 즉시 반영할 수 있습니다.
(블록 아이디가 주어지지 않으면 전체 문서를 수정합니다)

항상 전문적이고 정중한 한국어 실무 톤을 유지하십시오.
`

  const result = await streamText({
    model: anthropic('claude-3-5-sonnet-20241022'),
    system: systemPrompt,
    messages,
  })

  return result.toTextStreamResponse()
}
