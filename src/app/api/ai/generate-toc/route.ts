import { generateObject } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import { NextResponse } from 'next/server';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

const tocSchema = z.object({
  toc: z.array(z.object({
    title: z.string().describe('목차 항목의 제목 (예: 1. 서론)'),
    description: z.string().optional().describe('이 항목에 들어갈 내용에 대한 간략한 설명'),
    children: z.array(z.object({
      title: z.string(),
      description: z.string().optional(),
      children: z.array(z.object({
        title: z.string(),
        description: z.string().optional(),
      })).optional()
    })).optional()
  })).describe('문서의 전체 목차 구조')
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
      prompt: `당신은 전문적인 비즈니스 문서 작성가입니다. 다음 주제에 대한 상세한 문서 목차를 한국어로 작성해주세요. 대분류, 중분류, 소분류까지 포함하여 구조화해주세요.\n\n주제: ${prompt}`,
    });

    return NextResponse.json(object);
  } catch (error) {
    console.error('Error generating TOC:', error);
    return NextResponse.json({ error: 'Failed to generate TOC' }, { status: 500 });
  }
}