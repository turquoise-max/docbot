'use client'

import { useChat } from '@ai-sdk/react'
import { type UIMessage } from 'ai' // Message 대신 UIMessage 사용
import { useEffect, useRef, useState } from 'react' // useState 추가
import { Send, User, Bot, Check, X } from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import TocBuilder from '../template/TocBuilder'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

import { RefObject } from 'react'
import { SyncfusionDocEditorRef } from '../editor/SyncfusionDocEditor'

interface ChatPanelProps {
  selectedHtml: string
  selectedText: string
  editorContext: string
  onApplyEdit: (newContent: string) => void
  editorRef?: RefObject<SyncfusionDocEditorRef>
}

// 툴 UI 상태 관리를 위한 내부 컴포넌트
function UpdateEditorTool({ 
  args, 
  toolCallId, 
  addToolResult, 
  editorRef, 
  onApplyEdit 
}: { 
  args: { modifiedHtml?: string }, 
  toolCallId: string, 
  addToolResult: any,
  editorRef?: RefObject<SyncfusionDocEditorRef>, 
  onApplyEdit: (html: string) => void 
}) {
  const [status, setStatus] = useState<'pending' | 'applied' | 'rejected'>('pending');
  const hasPreviewed = useRef(false);

  useEffect(() => {
    if (!args || !args.modifiedHtml) return;

    if (status === 'pending' && !hasPreviewed.current && editorRef?.current) {
      hasPreviewed.current = true;
      editorRef.current.previewSelection(args.modifiedHtml);
    }
  }, [args?.modifiedHtml, editorRef, status]);

  if (!args || !args.modifiedHtml) {
    return (
      <div className="max-w-[85%] w-full p-4 bg-blue-50 border border-blue-100 rounded-lg animate-in slide-in-from-bottom-2 mt-2">
        <p className="text-sm font-medium text-blue-600 animate-pulse">수정 내용을 생성하는 중입니다...</p>
      </div>
    );
  }

  if (status === 'applied') {
    return (
      <div className="max-w-[85%] w-full p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700 mt-2">
        <Check size={16} />
        <span className="text-sm font-medium">수정 내용이 적용되었습니다.</span>
      </div>
    );
  }

  if (status === 'rejected') {
    return null; 
  }

  return (
    <div className="max-w-[85%] w-full p-4 bg-blue-50 border border-blue-100 rounded-lg animate-in slide-in-from-bottom-2 mt-2">
      <p className="text-sm font-bold text-blue-700 mb-3">AI가 수정한 내용을 적용할까요?</p>
      
      {/* ✨ 챗 패널 내부의 HTML 미리보기(dangerouslySetInnerHTML) 삭제됨 */}

      <div className="flex gap-2">
        <button 
          onClick={() => {
            if (editorRef?.current) {
              editorRef.current.acceptPreview();
            } else {
              onApplyEdit(args.modifiedHtml!);
            }
            setStatus('applied');
            addToolResult({ toolCallId, tool: 'updateEditor', result: '사용자가 수정 사항을 수락했습니다.', output: '사용자가 수정 사항을 수락했습니다.' });
          }}
          className="flex-1 flex items-center justify-center gap-1 bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Check size={16} /> 수락
        </button>
        <button 
          onClick={() => {
            if (editorRef?.current) {
              editorRef.current.rejectPreview();
            }
            setStatus('rejected');
            addToolResult({ toolCallId, tool: 'updateEditor', result: '사용자가 수정 사항을 거절했습니다.', output: '사용자가 수정 사항을 거절했습니다.' });
          }}
          className="flex-1 flex items-center justify-center gap-1 bg-white border border-gray-200 text-gray-600 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <X size={16} /> 거절
        </button>
      </div>
    </div>
  );
}

export default function ChatPanel({ selectedHtml, selectedText, editorContext, onApplyEdit, editorRef }: ChatPanelProps) {
  const INITIAL_PROMPT = '업로드된 문서의 구조와 핵심 내용을 분석해서 요약해줘. "[문서 구조 분석 브리핑]" 이라는 제목으로 시작하고, 앞으로 내가 질문하거나 수정을 요청할 때 이 전체 구조를 기억하고 문맥에 맞게 답변해줘.';

  const activePreviewIdRef = useRef<string | null>(null)
  const hasInitializedAnalyizeRef = useRef(false)

  // 챗 패널 너비 상태 관리
  const [width, setWidth] = useState(400)
  const [isResizing, setIsResizing] = useState(false)

  // 1. AI SDK v5.0+ 에 맞춰 input 상태를 직접 관리
  const [input, setInput] = useState('')

  const { messages, sendMessage, status, stop, addToolResult } = useChat()

  const isStreaming = status === 'submitted' || status === 'streaming'

 // ✨ 수정: 최신 AI SDK (UIMessage) 구조에 맞춰 parts 배열 안의 toolInvocation 상태를 검사합니다.
  const hasPendingTool = messages.some((m: UIMessage) =>
    m.parts?.some((part: any) => 
      part.type === 'tool-invocation' && part.toolInvocation?.state !== 'result'
    )
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }

  // 2. 수동 submit 핸들러 수정
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isStreaming) return

    // ✨ 추가: 보류 중인 툴이 있다면 전송을 막고 안내 알림 띄우기
    if (hasPendingTool) {
      alert("에디터에 제안된 수정 사항을 '수락' 또는 '거절'한 후 새로운 메시지를 보내주세요.");
      return;
    }

    const truncatedContext = editorContext && editorContext.length > 30000 
      ? editorContext.slice(0, 30000) + '\n...(중략)...' 
      : editorContext;

    // text 대신 role과 content 형식의 메시지 객체를 전달합니다.
    sendMessage(
      { text: input },
      { 
        body: { selectedHtml, selectedText, editorContext: truncatedContext } 
      }
    )
    setInput('')
  }

  // 3. 자동 브리핑 요청 로직 개선
  useEffect(() => {
    console.log("🤖 ChatPanel이 전달받은 문서 길이:", editorContext?.length);
    // 문서가 비어있지 않고(10자 초과), 채팅 내역이 아직 없으며, 최초 1회일 때만 실행
    if (editorContext && editorContext.trim().length > 10 && messages.length === 0 && !hasInitializedAnalyizeRef.current) {
      console.log("🚀 AI 문서 분석 브리핑을 시작합니다!");
      hasInitializedAnalyizeRef.current = true;
      
      const truncatedContext = editorContext.length > 30000 
        ? editorContext.slice(0, 30000) + '\n...(중략)...' 
        : editorContext;
        
      // AI에게 보내는 첫 브리핑 메시지
      sendMessage(
        { 
          text: INITIAL_PROMPT 
        },
        { body: { selectedHtml, selectedText, editorContext: truncatedContext } }
      )
    }
  }, [sendMessage, messages.length, selectedHtml, selectedText, editorContext])

  useEffect(() => {
    const handleReject = () => {
      if (isStreaming) {
        stop()
      }
      activePreviewIdRef.current = null
    }

    window.addEventListener('ai-preview-rejected', handleReject as EventListener)
    return () => window.removeEventListener('ai-preview-rejected', handleReject as EventListener)
  }, [stop, isStreaming])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 리사이징 이벤트 핸들러
  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = document.body.clientWidth - e.clientX
      if (newWidth >= 300 && newWidth <= 800) {
        setWidth(newWidth)
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.body.style.userSelect = 'auto'
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = 'auto'
    }
  }, [isResizing])

  return (
    <div 
      className="relative flex-shrink-0 flex flex-col h-full border-l bg-gray-50"
      style={{ width: `${width}px` }}
    >
      <div 
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 active:bg-blue-600 z-10 transition-colors"
        onMouseDown={() => setIsResizing(true)}
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
        {/* 5. Message 타입을 UIMessage로 변경 */}
        {messages
          .filter((m: UIMessage) => {
            // 메시지의 텍스트 내용을 안전하게 추출해
            const textContent = m.parts 
              ? m.parts.filter((p) => p.type === 'text').map((p) => (p as any).text).join('')
              : ('text' in m ? (m as any).text : ('content' in m ? (m as any).content : ''));
            
            // 🌟 핵심 로직: 유저가 보낸 메시지인데, 내용이 INITIAL_PROMPT와 같으면 화면에서 숨김(false)
            if (m.role === 'user' && textContent === INITIAL_PROMPT) {
              return false;
            }
            return true; // 나머지는 모두 화면에 그림
          })
          .map((m: UIMessage) => (
          <div key={m.id} className={cn("flex flex-col gap-2", m.role === 'user' ? "items-end" : "items-start")}>
            <div className={cn(
              "max-w-[85%] p-3 rounded-lg text-sm shadow-sm",
              m.role === 'user' ? "bg-blue-600 text-white" : "bg-white text-gray-800 border"
            )}>
              <div className="flex items-center gap-2 mb-1 opacity-70">
                {m.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                <span className="font-bold">{m.role === 'user' ? '나' : '문서봇'}</span>
              </div>
              <div className={cn(
                "text-sm leading-relaxed",
                m.role === 'user' 
                  ? "whitespace-pre-wrap"
                  : "prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0.5"
              )}>
                {/* 최신 SDK 구조에 맞게 텍스트 파트 렌더링 */}
                {m.role === 'user' ? (
                  m.parts 
                    ? m.parts.filter((p) => p.type === 'text').map((p) => (p as {type: 'text'; text: string}).text).join('')
                    : ('text' in m ? (m as {text: string}).text : ('content' in m ? (m as {content: string}).content : ''))
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {m.parts 
                      ? m.parts.filter((p) => p.type === 'text').map((p) => (p as {type: 'text'; text: string}).text).join('')
                      : ('text' in m ? (m as {text: string}).text : ('content' in m ? (m as {content: string}).content : ''))}
                  </ReactMarkdown>
                )}
              </div>
            </div>

            {/* 6. toolInvocations가 제거되고 parts 배열 안에서 'tool-{이름}' 형태로 변경됨 */}
            {m.parts?.map((part, index: number) => {
              if (part.type === 'tool-generateToc') {
                // v5.0 부터는 args 필드가 input 필드로 이름이 변경되었습니다.
                const args = part.input as { title: string, items: { id: string, level: number, text: string }[] };
                return (
                  <div key={`tool-${index}`} className="max-w-[85%] w-full">
                    <TocBuilder 
                      title={args.title} 
                      items={args.items} 
                      onApply={() => {
                        const html = `<h2>${args.title}</h2><ul>` + args.items.map((item) => `<li>${item.text}</li>`).join('') + `</ul>`;
                        if (editorRef?.current) {
                          editorRef.current.replaceSelection(html);
                        }
                      }} 
                    />
                  </div>
                );
              }

              if (part.type === 'tool-updateEditor') {
                const args = part.input as { modifiedHtml: string };
                const toolCallId = (part as any).toolCallId || (part as any).toolInvocation?.toolCallId || `tool-${index}`;
                
                return (
                  <UpdateEditorTool
                    key={`tool-${index}`}
                    args={args}
                    toolCallId={toolCallId}
                    addToolResult={addToolResult}
                    editorRef={editorRef}
                    onApplyEdit={onApplyEdit}
                  />
                );
              }

              return null;
            })}
          </div>
        ))}
        
        {status === 'submitted' && (
          <div className="flex flex-col gap-2 items-start">
            <div className="max-w-[85%] p-3 rounded-lg text-sm shadow-sm bg-white text-gray-800 border">
              <div className="flex items-center gap-2 mb-1 opacity-70">
                <Bot size={14} />
                <span className="font-bold">문서봇</span>
              </div>
              <div className="flex items-center gap-2 text-gray-500">
                <span className="animate-pulse">AI가 생각 중...</span>
              </div>
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
          />
          <button
            type="submit"
            // ✨ disabled 속성에 hasPendingTool 추가
            disabled={isStreaming || !input?.trim() || hasPendingTool}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-600 disabled:text-gray-300 transition-colors"
          >
            <Send size={20} />
          </button>
        </div>
      </form>
    </div>
  )
}