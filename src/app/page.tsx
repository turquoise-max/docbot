'use client'

import { useState, useRef } from 'react'
import type { TiptapEditorRef } from '@/components/editor/TiptapEditor'
import ChatPanel from '@/components/chat/ChatPanel'
import dynamic from 'next/dynamic'

const TiptapEditor = dynamic(
  () => import('@/components/editor/TiptapEditor'),
  { ssr: false }
)

export default function Home() {
  const editorRef = useRef<TiptapEditorRef>(null)
  const [content, setContent] = useState('<h1>새 문서</h1><p>여기에 내용을 입력하거나 AI에게 초안 작성을 부탁해보세요.</p>')
  const [selectedText, setSelectedText] = useState('')
  const [selectionRange, setSelectionRange] = useState<{ from: number; to: number } | null>(null)

  const handleSelection = (text: string, range: { from: number; to: number } | null) => {
    setSelectedText(text)
    setSelectionRange(range)
  }

  const handleApplyEdit = (newContent: string) => {
    // 만약 선택 영역이 있다면 해당 영역만 교체하는 로직이 필요하지만,
    // 현재는 단순화를 위해 전체 내용을 업데이트하거나 추가하는 방식으로 구현
    // 실제 운영 시에는 TipTap의 commands.insertContentAt 등을 사용해야 함
    if (selectedText && selectionRange) {
      // 부분 수정 로직 (TipTap Editor 내부에서 처리하는 것이 좋음)
      // 여기서는 간단히 전체 content 업데이트 예시로 처리
      setContent(newContent) 
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
            <TiptapEditor 
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
        selectedText={selectedText} 
        editorContext={content}
        onApplyEdit={handleApplyEdit}
        editorRef={editorRef}
      />
    </main>
  )
}