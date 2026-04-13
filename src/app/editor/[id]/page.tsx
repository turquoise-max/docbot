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
            const { data: fileData, error: downloadError } = await supabase.storage
              .from('files')
              .download(data.file_path)

            if (downloadError) {
              console.error('Error downloading file:', downloadError)
              setIsInitializing(false)
            } else if (fileData) {
              const formData = new FormData();
              formData.append('document', fileData, 'document.docx');
              
              const response = await fetch('/api/document/import', {
                method: 'POST',
                body: formData
              });
              
              if (response.ok) {
                 const sfdt = await response.text();
                 setTimeout(() => {
                   if (editorRef.current) {
                     editorRef.current.loadDocument(sfdt);
                     
                     // ✨ 텍스트가 로드될 때까지 최대 5초간 0.5초 간격으로 반복 확인(Polling)합니다.
                     let retries = 0;
                     const MAX_RETRIES = 10; 
                     
                     const checkAndSetContent = () => {
                       const text = editorRef.current?.getText() || '';
                       console.log(`📄 텍스트 추출 시도 ${retries + 1}/10, 길이: ${text.length}`);
                       
                       if (text.trim().length > 10 || retries >= MAX_RETRIES) {
                         setContent(text);
                         setIsInitializing(false); // 텍스트 확보 후 챗패널 표시
                       } else {
                         retries++;
                         setTimeout(checkAndSetContent, 500); // 0.5초 후 재시도
                       }
                     };
                     
                     setTimeout(checkAndSetContent, 500);
                   } else {
                     setIsInitializing(false);
                   }
                 }, 500);
                 
                 return; // 비동기 대기 중이므로 함수 종료
              } else {
                 console.error('Failed to convert document to SFDT');
                 setIsInitializing(false);
              }
            }
          } else {
             // 파일 경로가 없는 빈 문서인 경우
             setIsInitializing(false);
          }
        }
      } catch (error) {
        console.error('Failed to fetch document:', error)
        setIsInitializing(false);
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

  const handleExport = () => {
    if (editorRef.current) {
      editorRef.current.exportAsDocx(title);
    }
  };

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
            <button onClick={handleExport} className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700">내보내기</button>
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
