import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import { NextResponse } from 'next/server';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

const tocSchema = z.object({
  title: z.string().describe("문서의 적절한 제목"),
  toc: z.array(
    z.object({
      id: z.string().describe("고유 식별자 (예: '1', '1.1', '1.1.1' 등)"),
      level: z.union([z.literal(1), z.literal(2), z.literal(3)]).describe("목차 레벨 (1: 대분류, 2: 중분류, 3: 소분류)"),
      text: z.string().describe("목차 항목의 텍스트"),
    })
  ).describe("문서의 목차 항목 배열"),
});

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const { object } = await generateObject({
      model: google('gemini-3-flash-preview'),
      schema: tocSchema,
      prompt: `사용자의 다음 요청을 바탕으로 문서의 제목과 계층형 목차 구조를 작성해주세요.\n\n사용자 요청: "${prompt}"\n\n지시사항:\n- 목차는 대분류(level: 1), 중분류(level: 2), 소분류(level: 3)를 적절히 활용하여 논리적으로 구성하세요.\n- id는 '1', '1.1', '1.2.1'과 같이 계층을 나타내는 문자열로 작성하세요.`,
    });

    return NextResponse.json(object);
  } catch (error) {
    console.error('Failed to generate TOC:', error);
    return NextResponse.json({ error: 'Failed to generate TOC' }, { status: 500 });
  }
}