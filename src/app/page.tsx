'use client'

import { useState, useRef } from 'react'
import type { TinyMceEditorRef } from '@/components/editor/TinyMceEditor'
import ChatPanel from '@/components/chat/ChatPanel'
import dynamic from 'next/dynamic'

const TinyMceEditor = dynamic(
  () => import('@/components/editor/TinyMceEditor'),
  { ssr: false }
)

export default function Home() {
  const editorRef = useRef<TinyMceEditorRef>(null)
  const [content, setContent] = useState('<h1>새 문서</h1><p>여기에 내용을 입력하거나 AI에게 초안 작성을 부탁해보세요.</p>')
  const [selectedHtml, setSelectedHtml] = useState('')
  const [selectedText, setSelectedText] = useState('')

  const handleSelection = (html: string, text: string) => {
    setSelectedHtml(html)
    setSelectedText(text)
  }

  const handleApplyEdit = (newContent: string) => {
    if (selectedHtml && editorRef.current) {
      editorRef.current.replaceSelectionHtml(newContent)
    } else {
      setContent(newContent)
    }
  }

  return (
    <main className="flex h-screen bg-white">
      {/* 사이드바 (추후 구현) */}
      <div className="w-16 border-r bg-gray-50 flex flex-col items-center py-4 gap-4">
        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">D</div>
      </div>

      {/* 에디터 영역 */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b flex items-center px-6 justify-between bg-white">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-500 underline decoration-gray-300">내 문서</span>
            <span className="text-sm font-bold text-gray-800">무제 문서</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 text-xs font-medium border rounded-md hover:bg-gray-50">저장</button>
            <button className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700">공유</button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden p-8 bg-gray-50/50">
          <div className="max-w-4xl mx-auto h-full">
            <TinyMceEditor 
              ref={editorRef}
              content={content} 
              onChange={setContent} 
              onSelection={handleSelection}
            />
          </div>
        </div>
      </div>

      {/* AI 챗 패널 */}
      <ChatPanel
        selectedHtml={selectedHtml}
        selectedText={selectedText}
        editorContext={content}
        onApplyEdit={handleApplyEdit}
        editorRef={editorRef}
      />
    </main>
  )
}