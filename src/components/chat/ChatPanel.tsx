'use client'

import { useChat } from '@ai-sdk/react'
import { type UIMessage } from 'ai'
import { useEffect, useRef, useState, useMemo } from 'react'
import { Send, User, Bot, Check, X } from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import TocBuilder from '../template/TocBuilder'
import { OptionPicker } from './OptionPicker'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { RefObject } from 'react'
import { SyncfusionDocEditorRef } from '../editor/SyncfusionDocEditor'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

import { useEditor } from '@/contexts/EditorContext'

interface ChatPanelProps {
  editorContext: string
}

// ==================== UpdateEditorTool ====================
function UpdateEditorTool({ 
  args, 
  toolCallId, 
  toolName,
  addToolOutput, 
  triggerMessage
}: { 
  args: { modifiedHtml?: string; textBefore?: string; targetText?: string; textAfter?: string }
  toolCallId: string
  toolName: string
  addToolOutput: (options: any) => void
  triggerMessage: () => void
}) {
  const { editorRef } = useEditor()
  const [status, setStatus] = useState<'pending' | 'applied' | 'rejected'>('pending')
  const hasPreviewed = useRef(false)

  useEffect(() => {
    if (!args?.modifiedHtml) return
    if (status === 'pending' && !hasPreviewed.current && editorRef?.current) {
      hasPreviewed.current = true
      editorRef.current.previewSelection(args.modifiedHtml, args.textBefore, args.targetText, args.textAfter)
    }
  }, [args?.modifiedHtml, args?.textBefore, args?.targetText, args?.textAfter, editorRef, status])

  if (!args?.modifiedHtml) {
    return <div className="max-w-[85%] w-full p-4 bg-blue-50 border border-blue-100 rounded-lg animate-in slide-in-from-bottom-2 mt-2">
      <p className="text-sm font-medium text-blue-600 animate-pulse">수정 내용을 생성하는 중입니다...</p>
    </div>
  }

  if (status === 'applied') {
    return (
      <div className="max-w-[85%] w-full p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700 mt-2">
        <Check size={16} />
        <span className="text-sm font-medium">수정 내용이 적용되었습니다.</span>
      </div>
    )
  }

  if (status === 'rejected') return null

  return (
    <div className="max-w-[85%] w-full p-4 bg-blue-50 border border-blue-100 rounded-lg animate-in slide-in-from-bottom-2 mt-2">
      <p className="text-sm font-bold text-blue-700 mb-3">AI가 수정한 내용을 적용할까요?</p>
      
      <div className="flex gap-2">
        <button 
          onClick={() => {
            if (editorRef?.current) editorRef.current.acceptPreview()
            else if (args.modifiedHtml && editorRef?.current) editorRef.current.replaceSelection(args.modifiedHtml)
            
            setStatus('applied')
            addToolOutput({
              tool: toolName,
              toolCallId,
              output: '사용자가 수정 사항을 수락했습니다.'
            })
            // 자동 후속 요청 트리거
            setTimeout(() => {
              triggerMessage()
            }, 50)
          }}
          className="flex-1 flex items-center justify-center gap-1 bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Check size={16} /> 수락
        </button>
        <button 
          onClick={() => {
            if (editorRef?.current) editorRef.current.rejectPreview()
            setStatus('rejected')
            addToolOutput({
              tool: toolName,
              toolCallId,
              output: '사용자가 수정 사항을 거절했습니다.'
            })
            // 자동 후속 요청 트리거
            setTimeout(() => {
              triggerMessage()
            }, 50)
          }}
          className="flex-1 flex items-center justify-center gap-1 bg-white border border-gray-200 text-gray-600 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <X size={16} /> 거절
        </button>
      </div>
    </div>
  )
}

// ==================== Main ChatPanel ====================
export default function ChatPanel({ 
  editorContext
}: ChatPanelProps) {
  const { selectedHtml, selectedText, editorRef } = useEditor()

  const INITIAL_PROMPT = '업로드된 문서의 구조와 핵심 내용을 분석해서 요약해줘. "[문서 구조 분석 브리핑]" 이라는 제목으로 시작하고, 앞으로 내가 질문하거나 수정을 요청할 때 이 전체 구조를 기억하고 문맥에 맞게 답변해줘.'
  
  const hasInitializedAnalyizeRef = useRef(false)

  const [width, setWidth] = useState(600)
  const [isResizing, setIsResizing] = useState(false)
  const [input, setInput] = useState('')

  const truncatedContext = useMemo(() => {
    return editorContext && editorContext.length > 30000 
      ? editorContext.slice(0, 30000) + '\n...(중략)...' 
      : editorContext
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

  const {
    messages,
    sendMessage,
    status,
    addToolOutput,
    setMessages,
    error,
  } = useChat({
    // 503 등 서버 에러 발생 시 사용자에게 안내 메시지 표시
    onError: (err) => {
      alert('챗 서버와의 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      console.error('Chat error:', err);
    }
  })

  // 동적 컨텍스트를 포함하여 메시지를 재전송 (tool 결과 전송용)
  const handleTriggerMessage = () => {
    sendMessage(undefined, {
      body: {
        selectedHtml,
        selectedText,
        editorContext: truncatedContext,
      },
    })
  }

  const isStreaming = status === 'submitted' || status === 'streaming'

  // ✅ SDK v6 적용 코드
  const hasPendingTool = messages.some((m: UIMessage) => 
    m.parts?.some((part: any) => 
      part.type.startsWith('tool-') && 
      (part.state === 'input-streaming' || part.state === 'input-available')
    )
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isStreaming || hasPendingTool) return

    sendMessage({ text: input }, {
      body: {
        selectedHtml,
        selectedText,
        editorContext: truncatedContext,
      }
    })
    setInput('')
  }

  useEffect(() => {
    if (messages.length > 0 || hasInitializedAnalyizeRef.current) return

    const contextLength = editorContext?.trim().length ?? 0
    

    if (contextLength > 10) {
      // 텍스트가 10자 이상 들어왔을 때만 초기화 완료 처리!
      hasInitializedAnalyizeRef.current = true
      sendMessage({ text: INITIAL_PROMPT }, {
        body: {
          selectedHtml,
          selectedText,
          editorContext: truncatedContext,
        }
      })
    } else {
      const timer = setTimeout(() => {
        if (!hasInitializedAnalyizeRef.current) {
          hasInitializedAnalyizeRef.current = true

          setMessages([
            {
              id: 'initial-onboarding',
              role: 'assistant',
              parts: [{ 
                type: 'text', 
                text: '새로운 문서를 시작하시네요! 👋\n\n어떤 종류의 문서를 작성하실 계획인가요?\n(예: IT 서비스 사업계획서, 주간 운영 보고서, 제안서, 기획안 등)' 
              }],
            }
          ])
        }}, 3000); // 업로드 후 3초 대기

      return () => clearTimeout(timer)
    }
  }, [messages.length, editorContext, sendMessage, setMessages, truncatedContext, INITIAL_PROMPT, selectedHtml, selectedText])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div 
      className="relative flex-shrink-0 flex flex-col h-full border-l bg-gray-50"
      style={{ width: `${width}px` }}
    >
      {/* 리사이즈 핸들 */}
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
      
      <div className="p-4 border-b bg-white font-bold text-gray-700">
        AI 문서 도우미
        {selectedHtml && (
          <div className="text-xs font-normal text-blue-600 mt-1 truncate">
            선택 영역 수정 중...
          </div>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages
                .filter((m: UIMessage) => {
                  const textContent = m.parts 
                    ? m.parts.filter(p => p.type === 'text').map((p: any) => p.text).join('')
                    : (m as any).content || (m as any).text || '';
                  
                  return !(m.role === 'user' && textContent === INITIAL_PROMPT);
                })
                .map((m: UIMessage) => {
                  const textContent = m.parts 
                    ? m.parts.filter(p => p.type === 'text').map((p: any) => p.text).join('')
                    : (m as any).content || (m as any).text || '';

                  return (
                    <div key={m.id} className={cn("flex flex-col gap-2", m.role === 'user' ? "items-end" : "items-start")}>
                      
                      {/* 텍스트가 실제로 존재할 때만 말풍선을 그립니다! */}
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

                      {/* Tool UI 렌더링 */}
                      {m.parts?.map((part: any, index: number) => {
                        // ✅ SDK v6: 'tool-invocation' 대신 'tool-' 접두사로 확인
                        if (!part.type.startsWith('tool-')) return null;
                        
                        // ✅ SDK v6: part 객체에서 직접 데이터 추출 (toolInvocation 중첩 객체 없음)
                        const toolName = part.type.replace('tool-', '');
                        const toolCallId = part.toolCallId;
                        const args = part.input || part.args; // 버전에 따라 input 또는 args로 들어올 수 있음

                        if (toolName === 'generateToc') {
                          if (!args || !args.title || !args.items) return null; // 스트리밍 중 방어 로직
                          return (
                            <TocBuilder
                              key={`${toolCallId}-${index}`}
                              title={args.title}
                              items={args.items}
                              recommendations={args.recommendations || []}
                              onApply={(finalHtml: string) => {
                                if (editorRef?.current) editorRef.current.replaceSelection(finalHtml);
                                addToolOutput({
                                  tool: toolName,
                                  toolCallId,
                                  output: `${args.documentType || '문서'} 목차가 적용되었습니다.`
                                });
                                // 자동 후속 요청 트리거
                                setTimeout(() => {
                                  handleTriggerMessage()
                                }, 50)
                              }}
                            />
                          );
                        }

                        if (toolName === 'updateEditor') {
                          if (!args) return null; // 스트리밍 중 방어 로직
                          return (
                            <UpdateEditorTool
                              key={`${toolCallId}-${index}`}
                              args={args}
                              toolCallId={toolCallId}
                              toolName={toolName}
                              addToolOutput={addToolOutput}
                              triggerMessage={handleTriggerMessage}
                            />
                          );
                        }

                        if (toolName === 'askClarification') {
                          if (!args || !args.question || !args.options) return null; // 스트리밍 중 방어 로직
                          return (
                            <OptionPicker
                              key={`${toolCallId}-${index}`}
                              question={args.question}
                              options={args.options}
                              allowMultiple={args.allowMultiple}
                              onSelect={(value) => {
                                addToolOutput({
                                  tool: toolName,
                                  toolCallId,
                                  output: `사용자가 다음 옵션을 선택했습니다: ${value}`
                                });
                                // 자동 후속 요청 트리거
                                setTimeout(() => {
                                  handleTriggerMessage()
                                }, 50)
                              }}
                            />
                          );
                        }
                        
                        return null;
                      })}
                    </div>
                  );
                })}

              {/* 앞서 추가했던 로딩 애니메이션 */}
              {(status === 'submitted' || status === 'streaming') && messages.length > 0 && (
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

      <form onSubmit={handleSubmit} className="p-4 bg-white border-t">
        <div className="relative">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder={selectedText ? "선택 영역을 어떻게 수정할까요?" : "무엇을 도와드릴까요?"}
            className="w-full pl-3 pr-10 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            disabled={isStreaming}
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim() || hasPendingTool}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-600 disabled:text-gray-300 transition-colors"
          >
            <Send size={20} />
          </button>
        </div>
      </form>
    </div>
  )
}