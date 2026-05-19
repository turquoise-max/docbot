'use client'

import { useChat } from '@ai-sdk/react'
import { type UIMessage } from 'ai'
import { useEffect, useRef, useState, useMemo, forwardRef, useImperativeHandle } from 'react'
import { Send, User, Bot, Check, X, AlertCircle, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useEditor } from '@/contexts/EditorContext'

// 분리된 도구 컴포넌트 임포트
import { UpdateEditorTool } from './tools/UpdateEditorTool'
import { AskClarificationWizard } from './tools/AskClarificationWizard'
import { ReportProgressTool } from './tools/ReportProgressTool'
import { UpdateTableTool } from './tools/UpdateTableTool'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ==================== Main ChatPanel ====================
// ✨ 누락되었던 인터페이스 선언 추가
interface ChatPanelProps {
  documentId: string;
  editorContext: string;
  isNewDocument?: boolean;
  initialPrompt?: string;
  isUploaded?: boolean;
  isReady?: boolean;
}

const HIDDEN_ANALYZE_PROMPT = "[SYSTEM: 현재 에디터에 로드된 문서의 구조를 분석하고 요약 리포트를 작성해줘]";

const ChatPanel = forwardRef<{ sendMessage: (msg: { text: string }) => void }, ChatPanelProps>(({ 
  documentId,
  editorContext,
  isNewDocument = false,
  initialPrompt,
  isUploaded = false,
  isReady = false
}, ref) => {
  const { selectedHtml, selectedText, editorRef } = useEditor()
  const [showHistoryError, setShowHistoryError] = useState(false)

  const hasInitializedAnalyizeRef = useRef(false)
  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false)
  const processedAutoCalls = useRef<Set<string>>(new Set())

  const [width, setWidth] = useState(600)
  const [isResizing, setIsResizing] = useState(false)
  const [input, setInput] = useState('')

  const truncatedContext = useMemo(() => {
    if (!editorContext) return '';
    const MAX_LENGTH = 15000;
    
    if (editorContext.length <= MAX_LENGTH) return editorContext;

    // 15,000자에서 자르되, 가장 가까운 이전 문단 끝(\n)을 찾음
    const slice = editorContext.slice(0, MAX_LENGTH);
    const lastNewline = slice.lastIndexOf('\n');
    
    // 적절한 줄바꿈 위치를 찾으면 거기서 자르고, 아니면 그냥 slice
    const finalTrim = lastNewline > MAX_LENGTH * 0.8 ? slice.slice(0, lastNewline) : slice;
    
    return finalTrim + '\n...(이하 생략)';
  }, [editorContext])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return
      const newWidth = window.innerWidth - e.clientX
      setWidth(Math.min(Math.max(300, newWidth), 800))
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  const chatHelpers = useChat({
    id: documentId,
    onError: (err) => {
      alert('챗 서버와의 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      console.error('Chat error:', err);
    },
    // DB 저장 로직은 서버 사이드(api/chat/route.ts)의 onFinish로 이전됨
  })

  const {
    messages,
    status,
    addToolResult,
    setMessages,
  } = chatHelpers

  // @ts-expect-error append is available in newer ai versions or fallback to sendMessage
  const append = (chatHelpers.append || chatHelpers.sendMessage) as any

  const isStreaming = status === 'submitted' || status === 'streaming'

  // 에이전트별 가장 마지막(최신) toolCallId를 계산하여 중복 렌더링 방지
  const latestProgressByAgent = useMemo(() => {
    const latest: Record<string, string> = {};
    messages.forEach((m) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      m.parts?.forEach((part: any) => {
        const toolName = part.toolInvocation?.toolName || part.toolName || (part.type.startsWith('tool-') ? part.type.replace('tool-', '') : '');
        if (toolName === 'planDocument' || toolName === 'writeDocument' || toolName === 'reviewDocument') {
          latest[toolName] = part.toolInvocation?.toolCallId || part.toolCallId;
        }
      });
    });
    return latest;
  }, [messages]);

  const pendingClarificationCall = useMemo(() => {
    if (messages.length === 0) return null;
    const lastMessage = messages[messages.length - 1];
    
    // 오직 마지막 메시지가 assistant일 때만 위저드를 렌더링함
    if (lastMessage.role !== 'assistant') return null;

    const pendingPart = lastMessage.parts?.find((part: any) => {
      const inv = part.toolInvocation || part;
      const toolName = inv.toolName || (part.type?.startsWith('tool-') ? part.type.replace('tool-', '') : '');
      return toolName === 'askClarification' && inv.result === undefined && inv.output === undefined;
    });

    return pendingPart ? ((pendingPart as any).toolInvocation || pendingPart) : null;
  }, [messages]);

  const hasPendingTool = useMemo(() => {
    if (messages.length === 0) return false;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'assistant') return false;

    return lastMessage.parts?.some((part: any) => {
      if (!part.type?.startsWith('tool-')) return false;
      const inv = part.toolInvocation || part;
      if (inv.toolName === 'reportProgress') return false;
      return inv.result === undefined && inv.output === undefined;
    }) || false;
  }, [messages]);

  useImperativeHandle(ref, () => ({
    sendMessage: (msg: { text: string }) => {
      append(
        { role: 'user', parts: [{ type: 'text', text: msg.text }] }, 
        {
          body: {
            documentId,
            selectedHtml,
            selectedText,
            editorContext: truncatedContext, // 꼼수 최적화 폐기: 무조건 보냄
            isNewDocument // 새 문서 여부 명시적 전달
          }
        }
      );
    }
  }));

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isStreaming) return

    if (hasPendingTool) {
      messages.forEach((m: UIMessage) => {
        m.parts?.forEach((part: any) => {
          const inv = part.toolInvocation || part;
          if (part.type.startsWith('tool-') && inv.result === undefined && inv.output === undefined) {
            addToolResult({
              toolCallId: inv.toolCallId,
              result: '사용자가 도구 사용을 무시하고 새로운 채팅을 입력하여 실행이 취소되었습니다.',
              tool: inv.toolName || part.type.replace('tool-', ''),
              output: '사용자가 도구 사용을 무시하고 새로운 채팅을 입력하여 실행이 취소되었습니다.'
            } as any)
          }
        })
      })
    }

    append(
      { role: 'user', parts: [{ type: 'text', text: input }] }, 
      {
        body: {
          documentId,
          selectedHtml,
          selectedText,
          editorContext: truncatedContext, // 꼼수 최적화 폐기: 무조건 보냄
          isNewDocument // 새 문서 여부 명시적 전달
        }
      }
    )
    setInput('')
  }

  // 채팅 히스토리 불러오기
  useEffect(() => {
    const fetchHistory = async () => {
      if (!documentId) {
        setIsHistoryLoaded(true);
        return;
      }
      
      // 새 문서이고 파일 업로드도 아니면 기존 채팅 기록 없음
      if (isNewDocument && !isUploaded) {
        setIsHistoryLoaded(true);
        return;
      }
      
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('document_id', documentId)
          .order('created_at', { ascending: true });

        if (error) throw error;

        if (data && data.length > 0) {
          const uiMessages: UIMessage[] = data.map(m => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            parts: [{ type: 'text', text: m.content }]
          }));
          setMessages(uiMessages);
          hasInitializedAnalyizeRef.current = true;
        }
      } catch (err) {
        console.error('Failed to fetch chat history:', err);
        setShowHistoryError(true);
        setTimeout(() => setShowHistoryError(false), 3000);
      } finally {
        setIsHistoryLoaded(true);
      }
    };

    fetchHistory();
  }, [documentId, isNewDocument, isUploaded, setMessages]);

  useEffect(() => {
    if (!isHistoryLoaded || !isReady) return;
    if (messages.length > 0 || hasInitializedAnalyizeRef.current) return;

    hasInitializedAnalyizeRef.current = true

    if (initialPrompt) {
      setTimeout(() => {
        append(
          { role: 'user', parts: [{ type: 'text', text: initialPrompt }] }, 
          { body: { documentId, selectedHtml, selectedText, editorContext: truncatedContext, isNewDocument } }
        );
      }, 500)
    } else if (isUploaded) {
      console.log('[DEBUG-CHAT] HIDDEN_ANALYZE_PROMPT 전송 시도.');
      setTimeout(() => {
        append(
          { role: 'user', parts: [{ type: 'text', text: HIDDEN_ANALYZE_PROMPT }] }, 
          { body: { documentId, selectedHtml, selectedText, editorContext: truncatedContext, isNewDocument } }
        );
      }, 800)
    } else {
      // 기존 채팅 기록이 없을 때만 인사말을 출력합니다.
      // (만약 위에서 채팅 기록을 로드했다면 messages.length > 0이 되어 이 로직으로 진입하지 않음)
      if (!isNewDocument) {
        // 기존 문서 로드 시 (파일 업로드 아님) 일반 인사말만 출력
        setMessages([
          {
            id: 'initial-greeting',
            role: 'assistant',
            parts: [{ 
              type: 'text', 
              text: '안녕하세요! 문서를 수정하거나 궁금한 점이 있으시면 언제든 말씀해주세요. 👋'
            }],
          } as UIMessage
        ])
      } else {
        // 빈 문서로 시작하는 경우 초기 인삿말
        setMessages([
          {
            id: 'initial-greeting',
            role: 'assistant',
            parts: [{ 
              type: 'text', 
              text: '새로운 문서를 시작하시네요! 👋\n\n어떤 종류의 문서를 작성하실 계획인가요?\n(예: IT 서비스 사업계획서, 주간 운영 보고서, 제안서, 기획안 등)'
            }],
          } as UIMessage
        ])
      }
    }
  }, [isHistoryLoaded, isReady, messages.length, isNewDocument, isUploaded, setMessages, initialPrompt, append, selectedHtml, selectedText, truncatedContext])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ✨ 클라이언트 오케스트레이션: planDocument 완료 감지 후 자동 다음 단계 트리거
  useEffect(() => {
    if (isStreaming || messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'assistant') return;

    // planDocument 도구 결과가 있는지 확인
    const planPart = lastMessage.parts?.find((p: any) => {
      const inv = p.toolInvocation || p;
      const toolName = inv.toolName || (p.type?.startsWith('tool-') ? p.type.replace('tool-', '') : '');
      const isCompleted = p.state === 'result' || inv.state === 'result' || inv.result !== undefined || p.state === 'output-available' || inv.state === 'output-available' || inv.output !== undefined;
      return toolName === 'planDocument' && isCompleted;
    });

    if (planPart) {
      const inv = (planPart as any).toolInvocation || planPart;
      const toolCallId = inv.toolCallId;
      
      if (!processedAutoCalls.current.has(toolCallId)) {
        // 혹시 이미 작성 단계가 발동되었는지 안전 확인
        const hasWriteDocument = messages.some(m => 
          m.parts?.some((p: any) => {
            const i = p.toolInvocation || p;
            const tName = i.toolName || (p.type?.startsWith('tool-') ? p.type.replace('tool-', '') : '');
            return tName === 'writeDocument';
          })
        );

        if (!hasWriteDocument) {
          processedAutoCalls.current.add(toolCallId);
          console.log('[DEBUG-ORCHESTRATION] planDocument 완료 확인. writeDocument 자동 트리거 진행.');
          setTimeout(() => {
            append(
              { role: 'user', parts: [{ type: 'text', text: '[AUTO] 기획안을 바탕으로 전체 문서 HTML 초안을 작성하여 writeDocument 도구를 호출해주세요.' }] }, 
              {
                body: {
                  documentId,
                  selectedHtml,
                  selectedText,
                  editorContext: truncatedContext,
                  isNewDocument
                }
              }
            );
          }, 500);
        }
      }
    }

    // ✨ writeDocument 완료 감지 후 에디터에 자동 덮어쓰기 트리거
    const writePart = lastMessage.parts?.find((p: any) => {
      const inv = p.toolInvocation || p;
      const toolName = inv.toolName || (p.type?.startsWith('tool-') ? p.type.replace('tool-', '') : '');
      const isCompleted = p.state === 'result' || inv.state === 'result' || inv.result !== undefined || p.state === 'output-available' || inv.state === 'output-available' || inv.output !== undefined;
      return toolName === 'writeDocument' && isCompleted;
    });

    if (writePart && editorRef?.current) {
      const inv = (writePart as any).toolInvocation || writePart;
      const toolCallId = inv.toolCallId;
      const args = inv.args || inv.input;
      
      if (args?.htmlContent && !processedAutoCalls.current.has(toolCallId)) {
        processedAutoCalls.current.add(toolCallId);
        console.log('[DEBUG-ORCHESTRATION] writeDocument 완료 확인. 에디터에 직접 HTML 덮어쓰기 진행.');
        editorRef.current.replaceSelection(args.htmlContent);
      }
    }
  }, [isStreaming, messages, append, documentId, selectedHtml, selectedText, truncatedContext, isNewDocument, editorRef]);

  // 디버깅: 현재 messages 배열의 상태를 콘솔에 출력
  useEffect(() => {
    if (messages.length > 0) {
      console.log('[DEBUG-MESSAGES]', JSON.stringify(messages, null, 2));
    }
  }, [messages])

  return (
    <div 
      className="relative flex-shrink-0 flex flex-col h-full border-l bg-gray-50"
      style={{ width: `${width}px` }}
    >
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-10 transition-colors",
          isResizing ? "bg-blue-500" : "hover:bg-blue-300"
        )}
        onMouseDown={(e) => {
          e.preventDefault()
          setIsResizing(true)
        }}
      />
      
      <div className="p-4 border-b bg-white font-bold text-gray-700 relative">
        AI 문서 도우미
        
        {/* 히스토리 로드 실패 배너 */}
        {showHistoryError && (
          <div className="absolute top-full left-0 right-0 bg-yellow-50 border-b border-yellow-100 p-2 flex items-center gap-2 text-[11px] text-yellow-800 z-10 animate-in slide-in-from-top duration-300">
            <AlertCircle size={14} className="text-yellow-600 shrink-0" />
            <span>대화 기록을 불러오지 못했습니다. 새 대화로 시작합니다.</span>
          </div>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages
                .map((m: UIMessage) => {
                  const textContent = m.parts 
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    ? m.parts.filter(p => p.type === 'text').map((p: any) => p.text).join('')
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    : (m as any).content || (m as any).text || '';

                  // 시스템 숨김 명령어 렌더링 필터링
                  if (m.role === 'user' && (textContent.trim() === HIDDEN_ANALYZE_PROMPT || textContent.trim().startsWith('[AUTO]'))) {
                    return null;
                  }

                  // 숨겨진 빈 메시지(껍데기)로 인한 마진 누적 방지 로직
                  const hasVisibleText = textContent.trim().length > 0;
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const hasVisibleTool = m.parts?.some((part: any) => {
                    if (!part.type.startsWith('tool-')) return false;
                    const toolInvocation = part.toolInvocation || part;
                    const toolName = toolInvocation.toolName || (part.type.startsWith('tool-') ? part.type.replace('tool-', '') : '');
                    
                    if (toolName === 'planDocument' || toolName === 'writeDocument' || toolName === 'reviewDocument') {
                      // 최신의 toolCallId가 아닌 경우 화면에 그리지 않으므로 false
                      if (latestProgressByAgent[toolName] !== toolInvocation.toolCallId) return false;
                      
                      // askClarification과 병렬 호출된 경우 화면에 그리지 않음
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const hasAsk = m.parts?.some((p: any) => {
                        const tName = p.toolInvocation?.toolName || p.toolName || (p.type.startsWith('tool-') ? p.type.replace('tool-', '') : '');
                        return tName === 'askClarification';
                      });
                      if (hasAsk) return false;

                      return true;
                    }
                    if (toolName === 'updateTable' || toolName === 'updateEditor') return true;
                    if (toolName === 'askClarification') return false; // askClarification은 퀵 리플라이로 렌더링되므로 채팅 말풍선 제외
                    
                    return false;
                  });

                  if (!hasVisibleText && !hasVisibleTool) {
                    return null;
                  }

                  return (
                    <div key={m.id} className={cn("flex flex-col gap-2", m.role === 'user' ? "items-end" : "items-start")}>
                      
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
                        if (!part.type.startsWith('tool-')) return null;
                        
                        // AI SDK 구버전 및 최신 버전 호환 파싱
                        const toolInvocation = part.toolInvocation || part;
                        const toolName = toolInvocation.toolName || (part.type.startsWith('tool-') ? part.type.replace('tool-', '') : '');
                        const toolCallId = toolInvocation.toolCallId;
                        const args = toolInvocation.args || toolInvocation.input || part.args || part.input;

                        // 상태 보고 도구 렌더링 (Multi-step Tool Calling)
                        if (toolName === 'planDocument' || toolName === 'writeDocument' || toolName === 'reviewDocument') {
                          if (!args) return null;

                          // 중복 렌더링 방지: 가장 최신의 toolCallId가 아니면 렌더링 숨김
                          if (latestProgressByAgent[toolName] !== toolCallId) {
                            return null;
                          }

                          // askClarification과 병렬 호출된 경우 차단
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          const hasAsk = m.parts?.some((p: any) => {
                            const tName = p.toolInvocation?.toolName || p.toolName || (p.type.startsWith('tool-') ? p.type.replace('tool-', '') : '');
                            return tName === 'askClarification';
                          });
                          if (hasAsk) return null;

                          // 명확한 완료 상태 체크 (AI SDK v6 표준 및 최신: state === 'result' 또는 'output-available', result 또는 output 유무)
                          const isCompleted = part.state === 'result' || toolInvocation.state === 'result' || toolInvocation.result !== undefined || part.state === 'output-available' || toolInvocation.state === 'output-available' || toolInvocation.output !== undefined;
                          
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

                        // ✨ 표 업데이트 도구 렌더링 연결
                        if (toolName === 'updateTable') {
                          if (!args) return null;
                          return (
                            <UpdateTableTool
                              key={`${toolCallId}-${index}`}
                              args={args}
                              toolCallId={toolCallId}
                              toolName={toolName}
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
                              // @ts-expect-error fallback for addToolResult type
                              addToolResult={addToolResult}
                            />
                          );
                        }

                        // askClarification 답변 내용을 말풍선으로 렌더링
                        if (toolName === 'askClarification') {
                          const clariResult = toolInvocation.result;
                          if (clariResult === undefined) return null; // 아직 응답 전이면 렌더링 안함
                          
                          // tool_result 내용(사용자 응답)을 예쁘게 포맷팅
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
                })}

              {/* 🚨 [방어막 3] 위저드가 활성화되어 사용자의 답변을 기다리는 상태라면, 
                  뒤이어 쏟아지는 스트리밍 데이터(병렬 툴 껍데기 등)에 반응하여 
                  "답변 중" 로딩 상태가 뜨지 않도록 조건을 강화합니다. */}
              {(status === 'submitted' || status === 'streaming') && messages.length > 0 && !pendingClarificationCall && (
                <div className={cn(
                  "max-w-[85%] p-3 rounded-lg bg-white border self-start shadow-sm animate-in fade-in duration-300",
                  status === 'streaming' && "border-blue-100 bg-blue-50/30"
                )}>
                  <div className="flex items-center gap-3 text-gray-500">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce"></span>
                    </div>
                    <span className="text-xs font-medium text-blue-700">
                      {messages.length === 1 ? '문서의 구조와 내용을 정밀 분석하고 있습니다...' : 'AI가 답변을 작성 중입니다...'}
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

      {/* ✨ Quick Reply Wizard (askClarification 연동) */}
      {pendingClarificationCall && ((pendingClarificationCall as any).args || (pendingClarificationCall as any).input) && (
        <AskClarificationWizard
          args={(pendingClarificationCall as any).args || (pendingClarificationCall as any).input}
          toolCallId={(pendingClarificationCall as any).toolCallId || 'unknown'}
          // @ts-expect-error fallback for addToolResult type
          addToolResult={addToolResult}
          append={append}
          editorContext={truncatedContext}
          selectedHtml={selectedHtml}
          selectedText={selectedText}
        />
      )}

      <form onSubmit={handleSubmit} className="p-4 bg-white border-t">
        <div className="relative flex flex-col border rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all shadow-sm">
          {/* 선택 영역 배지 (내부 상단) */}
          {selectedText && (
            <div className="px-3 pt-3 pb-1 bg-white">
              <div className="inline-flex items-center max-w-full px-2.5 py-1.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-md border border-blue-100 shadow-sm">
                <span className="truncate max-w-full">
                  {selectedText.length > 80 
                    ? `"${selectedText.slice(0, 40)} ... ${selectedText.slice(-40)}"`
                    : `"${selectedText}"`}
                </span>
              </div>
            </div>
          )}
          
          {/* 입력 폼 */}
          <div className="relative flex items-center bg-white">
            <input
              value={input}
              onChange={handleInputChange}
              placeholder={hasPendingTool ? "도구를 무시하고 다른 요청하기..." : (selectedText ? "선택 영역을 어떻게 수정할까요?" : "무엇을 도와드릴까요?")}
              className="w-full pl-4 pr-12 py-3.5 focus:outline-none text-sm bg-transparent"
              disabled={isStreaming}
            />
            <button
              type="submit"
              disabled={isStreaming || !input.trim()}
              className="absolute right-3 p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 disabled:text-gray-300 disabled:hover:bg-transparent transition-colors"
            >
              <Send size={18} className="ml-0.5" />
            </button>
          </div>
        </div>
      </form>
    </div>
  )
})

export default ChatPanel;