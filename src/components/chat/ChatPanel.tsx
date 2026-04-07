'use client'

import { useChat } from '@ai-sdk/react'
import { type Message } from 'ai'
import { useEffect, useRef } from 'react'
import { Send, User, Bot, Check, X } from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import TocBuilder from '../template/TocBuilder'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

import { RefObject } from 'react'
import { TinyMceEditorRef } from '../editor/TinyMceEditor'

interface ChatPanelProps {
  selectedHtml: string
  selectedText: string
  editorContext: string
  onApplyEdit: (newContent: string) => void
  editorRef?: RefObject<TinyMceEditorRef>
}

export default function ChatPanel({ selectedHtml, selectedText, editorContext, onApplyEdit, editorRef }: ChatPanelProps) {
  const activePreviewIdRef = useRef<string | null>(null)
  const isStreamingRef = useRef<boolean>(false)
  
  const hasInitializedAnalyizeRef = useRef(false)

  const { messages, input, handleInputChange, handleSubmit, isLoading, append, stop } = useChat({
    api: '/api/chat',
    body: {
      selectedHtml,
      selectedText,
      editorContext,
    },
    onResponse: () => {
      isStreamingRef.current = true
    },
    onFinish: () => {
      isStreamingRef.current = false
    },
  })

  useEffect(() => {
    // sessionStorage에서 'isDocxUpload' 플래그 확인 후 브리핑 요청
    const initialDataStr = sessionStorage.getItem('initialEditorContent')
    if (initialDataStr && !hasInitializedAnalyizeRef.current) {
      try {
        const parsed = JSON.parse(initialDataStr)
        if (parsed.type === 'html' && parsed.isDocxUpload) {
          hasInitializedAnalyizeRef.current = true
          if (append && typeof append === 'function') {
            append({
              role: 'user',
              content: '업로드된 문서의 구조와 내용을 분석해서 요약해줘. "[문서 구조 분석 브리핑]" 이라는 제목으로 시작해.'
            })
          }
          
          // 분석 요청 후 플래그 제거하여 새로고침 시 재요청 방지
          sessionStorage.setItem('initialEditorContent', JSON.stringify({ ...parsed, isDocxUpload: false }))
        }
      } catch (e) {
        // ignore
      }
    }
  }, [append])

  // Handle aborting from the editor's reject button
  useEffect(() => {
    const handleReject = () => {
      if (isStreamingRef.current) {
        stop()
        isStreamingRef.current = false
      }
      activePreviewIdRef.current = null
    }

    window.addEventListener('ai-preview-rejected', handleReject as EventListener)
    return () => window.removeEventListener('ai-preview-rejected', handleReject as EventListener)
  }, [stop])

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
        {messages.map((m: Message) => (
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
                {m.content}
              </div>
            </div>

            {m.toolInvocations?.map(toolInvocation => {
              const { toolCallId, toolName, args } = toolInvocation;

              if (toolName === 'generateToc') {
                return (
                  <div key={toolCallId} className="max-w-[85%] w-full">
                    <TocBuilder 
                      title={args.title} 
                      items={args.items} 
                      onApply={() => {
                        const html = `<h2>${args.title}</h2>` + args.items.map((item: { level: number; text: string }) => `<h${item.level + 1}>${item.text}</h${item.level + 1}>`).join('');
                        if (editorRef?.current) {
                          // @ts-ignore
                          editorRef.current.setHtml(html);
                        }
                      }} 
                    />
                  </div>
                );
              }

              if (toolName === 'updateEditor') {
                return (
                  <div key={toolCallId} className="max-w-[85%] w-full p-4 bg-blue-50 border border-blue-100 rounded-lg animate-in slide-in-from-bottom-2 mt-2">
                    <p className="text-xs font-bold text-blue-700 mb-2">AI가 수정한 내용을 적용할까요?</p>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          if (editorRef?.current) {
                            // @ts-ignore
                            editorRef.current.replaceSelectionHtml(args.modifiedHtml);
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
            disabled={isLoading || !input?.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-600 disabled:text-gray-300 transition-colors"
          >
            <Send size={20} />
          </button>
        </div>
      </form>
    </div>
  )
}