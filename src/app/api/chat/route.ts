import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { streamText } from 'ai'

export const maxDuration = 30

// 환경변수 매핑 안내:
// Vercel AI SDK의 Google Provider는 기본적으로 'GOOGLE_GENERATIVE_AI_API_KEY' 환경변수를 찾습니다.
// 만약 사용자가 .env.local에 'GEMINI_API_KEY'라는 이름으로 키를 저장했다면,
// 아래와 같이 createGoogleGenerativeAI 설정에 apiKey를 명시적으로 전달하여 매핑할 수 있습니다.
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
<selected_text>
${selectedText || ''}
</selected_text>
<selected_html>
${selectedHtml || ''}
</selected_html>

[에디터 제어 프로토콜]
문서의 특정 부분을 직접 수정해야 할 경우,
반드시 답변에 \`[UPDATE_EDITOR_SELECTION]: <html>수정된 내용</html>\` 형식을 사용하십시오.
이때, 전달받은 <selected_html> 원본 HTML의 서식(인라인 스타일, 클래스, 태그 구조 등)을 완벽하게 유지하면서 내용만 수정하여 반환해야 합니다. 절대로 기존 태그 구조를 훼손하거나 누락해서는 안 됩니다.
사용자는 이 HTML을 에디터의 현재 영역에 즉시 치환하여 반영할 것입니다.

항상 전문적이고 정중한 한국어 실무 톤을 유지하십시오.
`

  const result = await streamText({
    model: google('gemini-1.5-pro'),
    system: systemPrompt,
    messages,
  })

  return result.toTextStreamResponse()
}
