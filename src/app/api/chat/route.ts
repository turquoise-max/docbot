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

[현재 사용자가 선택한 영역의 서식 정보 (SFDT JSON 포맷)]
${selectedHtml ? selectedHtml : '선택된 서식 정보가 없습니다.'}

[컨텍스트 활용 및 구조 인지 규칙]
1. 제공된 '[현재 작성 중인 문서 전체 내용]'을 면밀히 분석하여 문서의 전체적인 논리적 구조를 항상 기억하세요.
2. '[현재 사용자가 선택한 텍스트]' 영역을 우선적으로 고려하되 전체 문맥과 자연스럽게 이어지도록 수정 방향을 제안하세요.

[도구(Tool) 사용 규칙 - 매우 중요]
당신은 다음 두 가지 도구를 사용할 수 있습니다. 상황에 맞게 반드시 도구를 호출하세요.
1. updateEditor: 
   - 사용자가 "선택한 부분 수정해줘", "이 문단을 ~게 바꿔줘" 등 수정을 요청한 경우 반드시 이 도구를 호출하세요.
   - 텍스트로만 어떻게 수정할지 설명하지 말고, 수정된 최종 HTML 결과를 'modifiedHtml' 파라미터로 전달하세요.
   - 🚨 [수정 범위 엄수]: 사용자가 선택한 부분에 대한 수정 결과만 반환하세요. 선택하지 않은 앞뒤의 제목이나 문맥을 임의로 생성하지 마세요.
   - 🚨 [서식 및 들여쓰기 완벽 복원]: 제공된 '[현재 사용자가 선택한 영역의 서식 정보]'는 Syncfusion의 SFDT JSON 데이터입니다. 이 JSON을 분석하여 다음 지침을 반드시 따르세요.
     1) 헤딩(styleName), 굵기(bold), 기울임(italic), 글자색 등 기본 스타일을 100% 동일하게 반영하세요.
     2) 들여쓰기 복원: JSON 내 'paragraphFormat.leftIndent' 및 'firstLineIndent' 값을 확인하고, 값이 있다면 생성하는 HTML 태그(p, h1 등)에 style="margin-left: {값}pt;" 형태로 인라인 CSS를 적용하여 들여쓰기를 똑같이 맞추세요.
     3) 리스트 계층 복원: 불렛이나 번호 매기기 리스트인 경우 'listFormat.listLevelNumber'를 확인하여, 깊이에 따라 <ul>이나 <ol> 태그를 올바르게 중첩(Nesting)해서 들여쓰기 계층이 절대 깨지지 않도록 하세요.
2. generateToc: 
   - 사용자가 "목차 만들어줘", "개요 짜줘"라고 요청한 경우 이 도구를 호출하세요.

[응답 포맷 및 제한 사항]
- 수정/적용 요청이 아닌 단순 질문인 경우, 도구를 사용하지 말고 일반 텍스트(마크다운)로 친절하게 답변하세요.`

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