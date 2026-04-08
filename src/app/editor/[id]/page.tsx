'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams } from 'next/navigation'
import type { DocEditorRef } from '@/features/document-editor/DocEditor'
import ChatPanel from '@/components/chat/ChatPanel'
import { createClient } from '@/lib/supabase/client'
import { DocEditor } from '@/features/document-editor/DocEditor'

export default function EditorPage() {
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()

  const editorRef = useRef<DocEditorRef>(null)
  const [content, setContent] = useState('')
  const [headerHtml, setHeaderHtml] = useState<string | undefined>()
  const [footerHtml, setFooterHtml] = useState<string | undefined>()
  const [margins, setMargins] = useState<{ top: string; right: string; bottom: string; left: string } | undefined>()
  const [title, setTitle] = useState('무제 문서')
  const [selectedHtml, setSelectedHtml] = useState('')
  const [selectedText, setSelectedText] = useState('')
  const [isInitializing, setIsInitializing] = useState(true)

  useEffect(() => {
    const fetchDocument = async () => {
      if (!id) {
        setIsInitializing(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .eq('id', id)
          .single()

        if (error) throw error

        if (data) {
          setTitle(data.title)
          setContent(data.content_html || '')
          if (data.header_html) setHeaderHtml(data.header_html)
          if (data.footer_html) setFooterHtml(data.footer_html)
          if (data.margins_json) {
              setMargins(data.margins_json as unknown as { top: string; right: string; bottom: string; left: string })
          }
        }
      } catch (error) {
        console.error('Failed to fetch document:', error)
      } finally {
        setIsInitializing(false)
      }
    }

    fetchDocument()
  }, [id, supabase])

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
            <span className="text-sm font-bold text-gray-800">{title}</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 text-xs font-medium border rounded-md hover:bg-gray-50">저장</button>
            <button className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700">공유</button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden bg-[#f0f0f0]">
          <div className="h-full w-full">
            {!isInitializing && (
              <DocEditor 
                ref={editorRef}
                content={content}
                headerHtml={headerHtml}
                footerHtml={footerHtml}
                margins={margins}
                onChange={setContent} 
                onSelection={handleSelection}
              />
            )}
          </div>
        </div>
      </div>

      {/* AI 챗 패널 */}
      {!isInitializing && (
        <ChatPanel
          selectedHtml={selectedHtml}
          selectedText={selectedText}
          editorContext={content}
          onApplyEdit={handleApplyEdit}
          editorRef={editorRef}
        />
      )}
    </main>
  )
}