'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import ChatPanel from '@/components/chat/ChatPanel'
import { createClient } from '@/lib/supabase/client'
import SyncfusionDocEditor from '@/components/editor/SyncfusionDocEditor'
import { EditorProvider, useEditor } from '@/contexts/EditorContext'

// 로딩 단계를 정의합니다.
type LoadingStep = 'idle' | 'downloading' | 'importing' | 'rendering' | 'complete';

export default function EditorPage() {
  const params = useParams()
  const id = params.id as string

  return (
    <EditorProvider documentId={id}>
      <EditorContentInner />
    </EditorProvider>
  )
}

function EditorContentInner() {
  const { editorRef, title, setTitle, setSelection, documentId } = useEditor()
  const supabase = createClient()

  const [content, setContent] = useState('')
  const [isInitializing, setIsInitializing] = useState(true)
  const [loadingStep, setLoadingStep] = useState<LoadingStep>('idle')

  // 핵심 개선: 이벤트 기반 초기화 로직
  const handleContentChange = useCallback((text: string) => {
    setContent(text);
    
    // 렌더링 중이고 텍스트가 추출되었다면 초기화 완료
    if (isInitializing && text.trim().length > 0) {
      setLoadingStep('complete');
      setIsInitializing(false);
    }
  }, [isInitializing]);

  useEffect(() => {
    let safetyTimer: NodeJS.Timeout;

    const fetchDocument = async () => {
      if (!documentId) {
        setIsInitializing(false);
        return;
      }

      try {
        setLoadingStep('downloading'); // 1단계: 다운로드 시작
        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .eq('id', documentId)
          .single();

        if (error) throw error;

        if (data) {
          setTitle(data.title);

          if (data.file_path) {
            const { data: fileData, error: downloadError } = await supabase.storage
              .from('files')
              .download(data.file_path);

            if (downloadError) throw downloadError;

            if (fileData) {
              setLoadingStep('importing'); // 2단계: 서버 변환 시작
              const formData = new FormData();
              formData.append('document', fileData, 'document.docx');

              const response = await fetch('/api/document/import', {
                method: 'POST',
                body: formData,
              });

              if (response.ok) {
                const sfdt = await response.text();
                setLoadingStep('rendering'); // 3단계: 에디터 렌더링 시작
                
                editorRef.current?.loadDocument(sfdt);

                // 안전장치: 이벤트가 발생하지 않더라도 10초 후에는 강제 로드 시도
                safetyTimer = setTimeout(() => {
                  if (isInitializing) {
                    const text = editorRef.current?.getText() || '';
                    setContent(text);
                    setIsInitializing(false);
                    setLoadingStep('complete');
                  }
                }, 10000); 

              } else {
                setIsInitializing(false);
              }
            }
          } else {
            setIsInitializing(false); // 빈 문서인 경우
          }
        }
      } catch (error) {
        console.error('Failed to fetch document:', error);
        setIsInitializing(false);
      }
    };

    fetchDocument();

    return () => {
      if (safetyTimer) clearTimeout(safetyTimer);
    };
  }, [documentId, supabase, setTitle, editorRef, isInitializing]);

  // 로딩 메시지 맵핑
  const loadingMessages = {
    idle: '준비 중...',
    downloading: '파일을 업로드하고 있습니다...',
    importing: '문서 형식을 변환하는 중입니다...',
    rendering: '에디터에 내용을 구성하고 있습니다...',
    complete: '완료!'
  };

  const handleSelectionChange = useCallback((html: string, text: string) => {
    setSelection(html, text);
  }, [setSelection]);

  // Debounced auto-save effect
  useEffect(() => {
    // 초기화 중이거나 에디터가 준비되지 않았으면 타이머를 돌리지 않음
    if (!documentId || isInitializing || !editorRef.current) return;

    const timer = setTimeout(async () => {
      try {
        const sfdt = editorRef.current?.getSfdt();
        if (sfdt) {
          const { error } = await supabase
            .from('documents')
            .update({ 
              content_html: sfdt,
              updated_at: new Date().toISOString() // ✨ 피드백 수용: 최종 수정 시간 갱신
            })
            .eq('id', documentId);
            
          if (error) {
            console.error('Failed to auto-save document:', error);
          }
        }
      } catch (err) {
        console.error('Error during auto-save:', err);
      }
    }, 3000);

    // 3초 내에 content가 또 변경되면 기존 저장 타이머를 취소 (디바운스 역할 완벽 수행)
    return () => clearTimeout(timer);
    
    // eslint 경고를 방지하기 위해 supabase는 남겨두되, 구조를 간결하게 유지
  }, [content, documentId, isInitializing, supabase, editorRef]);

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
            <SyncfusionDocEditor 
              ref={editorRef} 
              onSelectionChange={handleSelectionChange}
              onContentChange={handleContentChange}
            />
            
            {isInitializing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10 backdrop-blur-sm">
                {/* 단순 텍스트 대신 스피너와 단계별 메시지 표시 */}
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <div className="text-center">
                    <p className="text-blue-800 font-bold text-lg">{loadingMessages[loadingStep]}</p>
                    <p className="text-gray-500 text-sm mt-1">문서 크기에 따라 시간이 걸릴 수 있습니다.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI 챗 패널 */}
      {!isInitializing && (
        <ChatPanel
          editorContext={content}
        />
      )}
    </main>
  )
}
