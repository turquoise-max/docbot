import React from 'react'
import { type UIMessage } from 'ai'
import { User, Bot } from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { UpdateEditorTool } from '../tools/UpdateEditorTool'
import { ReportProgressTool } from '../tools/ReportProgressTool'
import { UpdateTableTool } from '../tools/UpdateTableTool'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const HIDDEN_ANALYZE_PROMPT = "[SYSTEM: 현재 에디터에 로드된 문서의 구조를 분석하고 요약 리포트를 작성해줘]";

interface ChatMessageItemProps {
  message: UIMessage;
  latestProgressByAgent: Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addToolResult: (result: any) => void;
}

export function ChatMessageItem({ message: m, latestProgressByAgent, addToolResult }: ChatMessageItemProps) {
  const textContent = m.parts 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? m.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    : (m as any).content || (m as any).text || '';

  // 시스템 숨김 명령어 렌더링 필터링
  if (m.role === 'user' && (textContent.trim() === HIDDEN_ANALYZE_PROMPT || textContent.trim().startsWith('[AUTO]') || textContent.trim().startsWith('[SYSTEM_AUTO_TRIGGER:'))) {
    return null;
  }

  // 숨겨진 빈 메시지(껍데기)로 인한 마진 누적 방지 로직
  const hasVisibleText = textContent.trim().length > 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasVisibleTool = m.parts?.some((part: any) => {
    if (!part.type?.startsWith('tool-')) return false;
    const toolInvocation = part.toolInvocation || part;
    const toolName = toolInvocation.toolName || (part.type.startsWith('tool-') ? part.type.replace('tool-', '') : '');
    
    if (toolName === 'planDocument' || toolName === 'writeDocument' || toolName === 'reviewDocument') {
      if (latestProgressByAgent[toolName] !== toolInvocation.toolCallId) return false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hasAsk = m.parts?.some((p: any) => {
        const tName = p.toolInvocation?.toolName || p.toolName || (p.type.startsWith('tool-') ? p.type.replace('tool-', '') : '');
        return tName === 'askClarification';
      });
      if (hasAsk) return false;
      return true;
    }
    if (toolName === 'updateTable' || toolName === 'updateEditor') return true;
    if (toolName === 'askClarification') return false; 
    
    return false;
  });

  if (!hasVisibleText && !hasVisibleTool) {
    return null;
  }

  return (
    <div className={cn("flex flex-col gap-2", m.role === 'user' ? "items-end" : "items-start")}>
      
      {textContent && (
        <div className={cn(
          "max-w-[85%] p-3 rounded-lg text-sm shadow-sm",
          m.role === 'user' ? "bg-blue-600 text-white" : "bg-white text-gray-800 border"
        )}>
          <div className="flex items-center gap-2 mb-1 opacity-70">
            {m.role === 'user' ? <User size={14} /> : <Bot size={14} />}
            <span className="font-bold">{m.role === 'user' ? '나' : '문서봇'}</span>
          </div>
          <div className={cn("text-sm leading-relaxed", m.role === 'user' ? "whitespace-pre-wrap" : "prose prose-sm max-w-none")}>
            {m.role === 'user' ? (
              textContent
            ) : (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {textContent}
              </ReactMarkdown>
            )}
          </div>
        </div>
      )}

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {m.parts?.map((part: any, index: number) => {
        if (!part.type?.startsWith('tool-')) return null;
        
        const toolInvocation = part.toolInvocation || part;
        const toolName = toolInvocation.toolName || (part.type.startsWith('tool-') ? part.type.replace('tool-', '') : '');
        const toolCallId = toolInvocation.toolCallId;
        const args = toolInvocation.args || toolInvocation.input || part.args || part.input;
        const isCompleted = part.state === 'result' || toolInvocation.state === 'result' || toolInvocation.result !== undefined || part.state === 'output-available' || toolInvocation.state === 'output-available' || toolInvocation.output !== undefined;

        if (toolName === 'planDocument' || toolName === 'writeDocument' || toolName === 'reviewDocument') {
          if (!args) return null;
          if (latestProgressByAgent[toolName] !== toolCallId) return null;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const hasAsk = m.parts?.some((p: any) => {
            const tName = p.toolInvocation?.toolName || p.toolName || (p.type.startsWith('tool-') ? p.type.replace('tool-', '') : '');
            return tName === 'askClarification';
          });
          if (hasAsk) return null;
          
          let agentName = '';
          let statusText = '';
          let detailsText = '';

          if (toolName === 'planDocument') {
            agentName = '기획자';
            statusText = isCompleted ? '문서 구조 기획 완료' : '문서 구조 및 핵심 전략 기획 중...';
            detailsText = args.strategy ? `전략: ${args.strategy}` : '';
          } else if (toolName === 'writeDocument') {
            agentName = '작성자';
            statusText = isCompleted ? '문서 초안 작성 완료' : '전체 문서 초안 작성 중...';
            detailsText = args.summary ? `요약: ${args.summary}` : '';
          } else if (toolName === 'reviewDocument') {
            agentName = '검토자';
            statusText = isCompleted ? '검토 완료' : '문서 최종 검토 및 다듬는 중...';
            detailsText = args.feedback ? `피드백: ${args.feedback}` : '';
          }

          return (
            <ReportProgressTool
              key={`${toolCallId}-${index}`}
              args={{ agent: agentName, status: statusText, details: detailsText }}
              isCompleted={isCompleted}
            />
          );
        }

        if (toolName === 'updateTable') {
          if (!args) return null;
          return (
            <UpdateTableTool
              key={`${toolCallId}-${index}`}
              args={args}
              toolCallId={toolCallId}
              toolName={toolName}
              isCompleted={isCompleted}
              // @ts-expect-error fallback for addToolResult type
              addToolResult={addToolResult}
            />
          );
        }

        if (toolName === 'updateEditor') {
          if (!args) return null;
          return (
            <UpdateEditorTool
              key={`${toolCallId}-${index}`}
              args={args}
              toolCallId={toolCallId}
              toolName={toolName}
              isCompleted={isCompleted}
              // @ts-expect-error fallback for addToolResult type
              addToolResult={addToolResult}
            />
          );
        }

        if (toolName === 'askClarification') {
          const clariResult = toolInvocation.result;
          if (clariResult === undefined) return null;
          
          const resultText = String(clariResult);
          const isUserResponse = resultText.startsWith('사용자가 다음의 응답을 완료했습니다');
          
          if (!isUserResponse) return null;

          return (
            <div key={`${toolCallId}-${index}`} className="flex flex-col items-end w-full mt-2">
              <div className="max-w-[85%] p-3 rounded-lg text-sm shadow-sm bg-blue-600 text-white">
                <div className="flex items-center gap-2 mb-2 opacity-70 border-b border-blue-500/50 pb-1">
                  <User size={14} />
                  <span className="font-bold text-xs">나의 답변</span>
                </div>
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                  {resultText.replace('사용자가 다음의 응답을 완료했습니다:\n', '')}
                </div>
              </div>
            </div>
          );
        }
        
        return null;
      })}
    </div>
  );
}