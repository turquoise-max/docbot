'use client'
// @ts-nocheck

import { useChat } from '@ai-sdk/react'
import { useState, useEffect, useRef } from 'react'
import { Send, User, Bot, Check, X } from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

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
  const [pendingUpdate, setPendingUpdate] = useState<string | null>(null)
  const activePreviewIdRef = useRef<string | null>(null)
  const isStreamingRef = useRef<boolean>(false)
  
  const { messages, input, handleInputChange, handleSubmit, isLoading, stop } = useChat({
    api: '/api/chat',
    body: {
      selectedHtml,
      selectedText,
      editorContext,
    },
    onResponse: () => {
      isStreamingRef.current = true
    },
    onFinish: (message) => {
      isStreamingRef.current = false
      const selectionMatch = message.content.match(/\[UPDATE_EDITOR_SELECTION\]:\s*<html>([\s\S]*?)<\/html>/)
      if (selectionMatch && selectionMatch[1]) {
        setPendingUpdate(selectionMatch[1])
      }
    },
  })

  // Handle aborting from the editor's reject button
  useEffect(() => {
    const handleReject = (e: CustomEvent) => {
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

  const handleAccept = () => {
    if (pendingUpdate) {
      onApplyEdit(pendingUpdate)
      setPendingUpdate(null)
    }
  }

  const handleDecline = () => {
    setPendingUpdate(null)
  }

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
        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.role === 'user' ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[85%] p-3 rounded-lg text-sm shadow-sm",
              m.role === 'user' ? "bg-blue-600 text-white" : "bg-white text-gray-800 border"
            )}>
              <div className="flex items-center gap-2 mb-1 opacity-70">
                {m.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                <span className="font-bold">{m.role === 'user' ? '나' : '문서봇'}</span>
              </div>
              <div className="whitespace-pre-wrap leading-relaxed">
              {/* UPDATE_EDITOR 태그 제외하고 텍스트만 표시 */}
              {m.content.split(/\[UPDATE_EDITOR(_SELECTION)?\]/)[0]}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {pendingUpdate && (
        <div className="p-4 bg-blue-50 border-t border-blue-100 animate-in slide-in-from-bottom-2">
          <p className="text-xs font-bold text-blue-700 mb-2">AI가 수정한 내용을 적용할까요?</p>
          <div className="flex gap-2">
            <button 
              onClick={handleAccept}
              className="flex-1 flex items-center justify-center gap-1 bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Check size={16} /> 수락
            </button>
            <button 
              onClick={handleDecline}
              className="flex-1 flex items-center justify-center gap-1 bg-white border border-gray-200 text-gray-600 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <X size={16} /> 거절
            </button>
          </div>
        </div>
      )}

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