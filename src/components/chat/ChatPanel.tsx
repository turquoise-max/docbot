'use client'

import { useChat } from '@ai-sdk/react'
import { type UIMessage } from 'ai' // Message 대신 UIMessage 사용
import { useEffect, useRef, useState } from 'react' // useState 추가
import { Send, User, Bot, Check, X } from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import TocBuilder from '../template/TocBuilder'

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

export default function ChatPanel({ selectedHtml, selectedText, editorContext, onApplyEdit, editorRef }: ChatPanelProps) {
  const activePreviewIdRef = useRef<string | null>(null)
  const hasInitializedAnalyizeRef = useRef(false)

  // 1. AI SDK v5.0+ 에 맞춰 input 상태를 직접 관리
  const [input, setInput] = useState('')

  // 2. useChat의 변경된 반환값 사용 (api 속성은 기본값이 /api/chat 이므로 생략)
  const { messages, sendMessage, status, stop } = useChat()

  // 기존 isLoading과 isStreamingRef를 status 하나로 대체
  const isStreaming = status === 'submitted' || status === 'streaming'

  // 3. 수동 input 변경 핸들러
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }

  // 4. 수동 submit 핸들러 (append 대신 sendMessage 사용)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isStreaming) return

    sendMessage(
      { text: input },
      { 
        // 최신 상태의 에디터 컨텍스트를 전송 시점에 body로 태워 보냅니다.
        body: { selectedHtml, selectedText, editorContext } 
      }
    )
    setInput('')
  }

  useEffect(() => {
    const initialDataStr = sessionStorage.getItem('initialEditorContent')
    if (initialDataStr && !hasInitializedAnalyizeRef.current) {
      try {
        const parsed = JSON.parse(initialDataStr)
        if (parsed.type === 'html' && parsed.isDocxUpload) {
          hasInitializedAnalyizeRef.current = true
          
          // 초기 브리핑 요청도 sendMessage로 변경
          sendMessage(
            { text: '업로드된 문서의 구조와 내용을 분석해서 요약해줘. "[문서 구조 분석 브리핑]" 이라는 제목으로 시작해.' },
            { body: { selectedHtml, selectedText, editorContext } }
          )
          
          sessionStorage.setItem('initialEditorContent', JSON.stringify({ ...parsed, isDocxUpload: false }))
        }
      } catch (e) {
        // ignore
      }
    }
  }, [sendMessage, selectedHtml, selectedText, editorContext])

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

  return (
    <div className="flex flex-col h-full border-l bg-gray-50 w-[400px]">
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
        {messages.map((m: UIMessage) => (
          <div key={m.id} className={cn("flex flex-col gap-2", m.role === 'user' ? "items-end" : "items-start")}>
            <div className={cn(
              "max-w-[85%] p-3 rounded-lg text-sm shadow-sm",
              m.role === 'user' ? "bg-blue-600 text-white" : "bg-white text-gray-800 border"
            )}>
              <div className="flex items-center gap-2 mb-1 opacity-70">
                {m.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                <span className="font-bold">{m.role === 'user' ? '나' : '문서봇'}</span>
              </div>
              <div className="whitespace-pre-wrap leading-relaxed">
                {/* 최신 SDK 구조에 맞게 텍스트 파트 렌더링 */}
                {m.parts 
                  ? m.parts.filter((p) => p.type === 'text').map((p) => (p as {type: 'text'; text: string}).text).join('')
                  : ('text' in m ? (m as {text: string}).text : ('content' in m ? (m as {content: string}).content : ''))}
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
                        const html = `${args.title}\n` + args.items.map((item) => `${item.text}\n`).join('');
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
                return (
                  <div key={`tool-${index}`} className="max-w-[85%] w-full p-4 bg-blue-50 border border-blue-100 rounded-lg animate-in slide-in-from-bottom-2 mt-2">
                    <p className="text-xs font-bold text-blue-700 mb-2">AI가 수정한 내용을 적용할까요?</p>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          if (editorRef?.current) {
                            editorRef.current.replaceSelection(args.modifiedHtml);
                          } else {
                            onApplyEdit(args.modifiedHtml);
                          }
                        }}
                        className="flex-1 flex items-center justify-center gap-1 bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                      >
                        <Check size={16} /> 수락
                      </button>
                      <button 
                        onClick={(e) => {
                          const target = e.currentTarget;
                          target.parentElement?.parentElement?.remove();
                        }}
                        className="flex-1 flex items-center justify-center gap-1 bg-white border border-gray-200 text-gray-600 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
                      >
                        <X size={16} /> 거절
                      </button>
                    </div>
                  </div>
                );
              }

              return null;
            })}
          </div>
        ))}
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
            disabled={isStreaming || !input?.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-600 disabled:text-gray-300 transition-colors"
          >
            <Send size={20} />
          </button>
        </div>
      </form>
    </div>
  )
}