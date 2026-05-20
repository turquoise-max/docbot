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
      description: `전체 문서 내용을 HTML로 작성하거나 업데이트할 때 호출합니다. 신규 문서 작성 및 기존 문서 전체 수정 시 사용됩니다.
htmlContent 작성 규칙:
- h1 1개(제목), h2(섹션), h3(하위항목), h4 이하 금지
- section 태그로 섹션 분리, margin-bottom:2rem
- 표: width:100%, border-collapse:collapse, th/td padding:10px 12px, border:1px solid #dee2e6
- ul/ol padding-left:1.5rem, li margin-bottom:0.4rem
- strong 문단당 최대 2회, em/u 금지, 인라인 font-size 금지
- 표: 모든 셀 채우기 필수, 빈 td 금지, 수치는 단위 포함
- 헤딩 언어 통일: 한국어 문서는 h2/h3 모두 한글, 영문 용어는 괄호 병기
- h1 color:#0d1f35 / h2 color:#1a3a5c / h3 color:#2c6fad 고정`,
      inputSchema: z.object({
        summary: z.string().describe('UI에 표시될 완료 문구. 기존 문서 수정 시에는 반드시 "문서 수정 완료"라고 짧게 작성하고, 신규 초안 작성 시에는 "문서 초안 작성 완료"라고 작성하세요.'),
        htmlContent: z.string().describe('작성된 순수 HTML 초안 코드 (```html 태그 없이)'),
      }),
      execute: async () => {
        return `[시스템 알림] 문서 작성이 완료되었습니다. 에디터에 자동 반영됩니다.`;
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
