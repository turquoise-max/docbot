import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { streamText, tool, convertToModelMessages, stepCountIs } from 'ai'
import { z } from 'zod'

export const maxDuration = 30

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
})

export async function POST(req: Request) {
  const { messages, editorContext, selectedHtml, selectedText } = await req.json()

  const systemPrompt = `...` // 기존 systemPrompt 그대로 유지

  const modelMessages = await convertToModelMessages(messages)

  const result = streamText({
    model: google('gemini-3-flash-preview'), // gemini-3-flash-preview → 최신 추천
    system: systemPrompt,
    messages: modelMessages,
    tools: {
      generateToc: tool({
        description: '문서의 목차를 생성합니다...',
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
        description: '에디터 선택 영역을 수정합니다...',
        inputSchema: z.object({
          modifiedHtml: z.string().describe('수정된 HTML')
        })
      })
    },
    // ✅ v6에서는 maxSteps 대신 stopWhen 사용
    stopWhen: stepCountIs(5),   // 최대 5단계 tool calling 허용
  })

  // ✅ v6에서 올바른 메서드 + 옵션
  return result.toUIMessageStreamResponse({
    onError: (error) => {
      console.error('Stream error:', error)
      return '죄송합니다. 처리 중 오류가 발생했습니다.'
    }
  })
}