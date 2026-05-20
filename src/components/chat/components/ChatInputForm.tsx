import React from 'react'
import { Send } from 'lucide-react'

interface ChatInputFormProps {
  input: string;
  isStreaming: boolean;
  hasPendingTool: boolean;
  selectedText: string | null;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function ChatInputForm({
  input,
  isStreaming,
  hasPendingTool,
  selectedText,
  onInputChange,
  onSubmit
}: ChatInputFormProps) {
  return (
    <form onSubmit={onSubmit} className="p-4 bg-white border-t">
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
            onChange={onInputChange}
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
  )
}