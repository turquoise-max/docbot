import { tool } from 'ai'
import { z } from 'zod'

export const getActiveTools = (allowAskClarification: boolean) => {
  const tools: Record<string, any> = {
    planDocument: tool({
      description: '[1단계] 사용자의 요청을 바탕으로 문서의 전략, 목차, 톤앤매너를 기획할 때 호출합니다.',
      inputSchema: z.object({
        strategy: z.string().describe('핵심 전략 및 가치 제안 요약'),
        outline: z.array(z.string()).describe('문서의 주요 목차 리스트'),
        tone: z.string().describe('문서의 톤앤매너 (예: 전문적인, 설득력 있는)'),
      }),
      execute: async () => {
        return `[시스템 알림] 기획이 성공적으로 완료되었습니다. ⚠️ 중요: 여기서 응답을 멈추지 마십시오. 당신은 반드시 방금 기획한 목차와 전략을 바탕으로 즉시 \`writeDocument\` 도구를 호출하여 전체 HTML 초안 작성을 완결지어야 합니다.`;
      }
    }),

    writeDocument: tool({
      description: '[2단계] 기획된 내용을 바탕으로 실제 전체 문서 내용(초안)을 HTML로 작성할 때 호출합니다.',
      inputSchema: z.object({
        summary: z.string().describe('작성된 문서의 핵심 요약'),
        htmlContent: z.string().describe('작성된 순수 HTML 초안 코드 (```html 태그 없이)'),
      }),
      execute: async () => {
        return `[시스템 알림] 초안 작성이 완료되었습니다. 에디터에 자동 반영됩니다.`;
      }
    }),

    updateEditor: tool({
      description: '[단일 수정] 에디터의 선택된 텍스트 영역을 수정한 결과물로 대체합니다. 시스템이 선택 영역을 자동 추적하므로 HTML 결과물만 반환하세요.',
      inputSchema: z.object({
        modifiedHtml: z.string().describe('선택된 텍스트 영역을 대체할 최종 HTML'),
        isDraftMode: z.boolean().optional().describe('전체 문서 덮어쓰기 여부'),
      }),
    }),

    updateTable: tool({
      description: '표(Table)의 데이터를 재작성하거나 추가할 때 반드시 호출합니다.',
      inputSchema: z.object({
        targetKeyword: z.string().describe('표 내부의 고유 단어 (기존 표 수정 시)'),
        tableData: z.array(z.array(z.string())).describe('표에 들어갈 새로운 데이터 (2차원 배열)'),
      }),
    }),
  };

  if (allowAskClarification) {
    tools.askClarification = tool({
      description: '사용자의 요청이 너무 모호하거나 정보가 부족하여 문서 작성을 시작할 수 없을 때, 마법사를 통해 사용자에게 질문과 선택지를 제시합니다.',
      inputSchema: z.object({
        questions: z.array(z.object({
          question: z.string().describe('사용자에게 보여줄 질문'),
          options: z.array(z.object({
            label: z.string().describe('버튼 텍스트'),
            value: z.string().describe('선택 시 전달될 값'),
          })).describe('3~5개 옵션 추천'),
          allowMultiple: z.boolean().optional().default(false).describe('다중 선택 허용 여부'),
        })).min(1).max(3).describe('사용자에게 물어볼 질문 목록 (최대 3개)'),
      }),
    });
  }

  return tools;
};
