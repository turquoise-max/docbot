'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import ChatPanel from '@/components/chat/ChatPanel'
import { createClient } from '@/lib/supabase/client'
import SyncfusionDocEditor, { SyncfusionDocEditorRef } from '@/components/editor/SyncfusionDocEditor'

export default function EditorPage() {
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()

  const editorRef = useRef<SyncfusionDocEditorRef>(null)
  const [content, setContent] = useState('')
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
          
          if (data.file_path) {
            // Fetch DOCX file from Storage and convert to SFDT
            const { data: fileData, error: downloadError } = await supabase.storage
              .from('files')
              .download(data.file_path)

            if (downloadError) {
              console.error('Error downloading file:', downloadError)
            } else if (fileData) {
              const formData = new FormData();
              formData.append('document', fileData, 'document.docx');
              
              // Call server API route to convert DOCX to SFDT (Syncfusion Document Format)
              const response = await fetch('/api/document/import', {
                method: 'POST',
                body: formData
              });
              
              if (response.ok) {
                 const sfdt = await response.text();
                 // Load into editor via ref after short delay to ensure component is mounted
                 setTimeout(() => {
                   if (editorRef.current) {
                     editorRef.current.loadDocument(sfdt);
                   }
                 }, 500);
              } else {
                 console.error('Failed to convert document to SFDT');
              }
            }
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

  const handleSelectionChange = useCallback((html: string, text: string) => {
    setSelectedHtml(html);
    setSelectedText(text);
  }, []);

  const handleContentChange = useCallback((text: string) => {
    setContent(text);
  }, []);

  // Debounced auto-save effect
  useEffect(() => {
    if (!id || isInitializing || !editorRef.current) return;

    const timer = setTimeout(async () => {
      try {
        const sfdt = editorRef.current?.getSfdt();
        if (sfdt) {
          const { error } = await supabase
            .from('documents')
            .update({ content_html: sfdt })
            .eq('id', id);
            
          if (error) {
            console.error('Failed to auto-save document:', error);
          }
        }
      } catch (err) {
        console.error('Error during auto-save:', err);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [content, id, isInitializing, supabase]);

  const handleApplyEdit = (newContent: string) => {
    if (editorRef.current) {
      editorRef.current.replaceSelection(newContent)
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

        <div className="flex-1 relative bg-[#f0f0f0]">
          <div className="absolute inset-0">
            {!isInitializing && (
               <SyncfusionDocEditor 
                 ref={editorRef} 
                 onSelectionChange={handleSelectionChange}
                 onContentChange={handleContentChange}
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
