'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import ChatPanel from '@/components/chat/ChatPanel'
import AppSidebar from '@/components/layout/AppSidebar'
import Header from '@/components/layout/Header'
import VersionHistoryPanel from '@/components/editor/VersionHistoryPanel'
import { createClient } from '@/lib/supabase/client'
import SyncfusionDocEditor from '@/components/editor/SyncfusionDocEditor'
import { EditorProvider, useEditor } from '@/contexts/EditorContext'
import ErrorBoundary from '@/components/common/ErrorBoundary'
import { FileX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { creationIntentStore } from '@/lib/store/creationIntent'

// 로딩 단계를 정의합니다.
type LoadingStep = 'idle' | 'creating' | 'downloading' | 'importing' | 'rendering' | 'complete';

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
  const [hasLoadError, setHasLoadError] = useState(false)
  const [loadingStep, setLoadingStep] = useState<LoadingStep>('idle')
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [tempTitle, setTempTitle] = useState('')
  const lastSavedContentRef = useRef<string>('')
  const [isNewDocument, setIsNewDocument] = useState(false)
  
  // 자동저장 관련 refs 및 상태
  const lastTypingTimeRef = useRef<number>(0)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const initializationStartedRef = useRef(false)

  // 핵심 개선: 이벤트 기반 초기화 로직
  const handleContentChange = useCallback((text: string) => {
    setContent(text);
    lastTypingTimeRef.current = Date.now();
    
    // 렌더링 중이고 텍스트가 추출되었다면 초기화 완료
    if (isInitializing && text.trim().length > 0) {
      setLoadingStep('complete');
      setIsInitializing(false);
    }
  }, [isInitializing]);

  useEffect(() => {
    let safetyTimer: NodeJS.Timeout;

    const initializeDocument = async () => {
      if (!documentId || initializationStartedRef.current) {
        return;
      }
      
      initializationStartedRef.current = true;

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("Unauthorized")

        // 1. 인텐트(의도) 확인
        const intent = creationIntentStore.getIntent(documentId)
        
        if (intent) {
          // 새로 생성하는 프로세스
          setLoadingStep('creating');
          creationIntentStore.removeIntent(documentId); // 처리 후 스토어에서 제거
          
          const insertData: any = {
            id: documentId, // 라우팅된 ID를 그대로 사용
            title: intent.title,
            user_id: user.id
          };

          if (intent.type === 'empty' || intent.type === 'template') {
            insertData.content_html = intent.html;
            
            const { error } = await supabase.from('documents').insert(insertData);
            if (error) throw error;
            
            setTitle(intent.title || '');
            setIsNewDocument(true);
            setLoadingStep('rendering');
            editorRef.current?.loadDocument(intent.html || '');
            
          } else if (intent.type === 'upload' && intent.file) {
            setLoadingStep('downloading'); // 업로드 중이지만 UX상 다운로드 스텝 텍스트 활용
            
            const fileExt = intent.file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `${user.id}/documents/${fileName}`;

            // 스토리지 업로드
            const { error: uploadError } = await supabase.storage
              .from('files')
              .upload(filePath, intent.file);

            if (uploadError) throw uploadError;

            // DB 레코드 생성
            insertData.file_path = filePath;
            const { error: insertError } = await supabase.from('documents').insert(insertData);
            if (insertError) throw insertError;

            setTitle(intent.title || '');
            setIsNewDocument(false);
            
            // 서버 변환 시작
            setLoadingStep('importing');
            const formData = new FormData();
            formData.append('document', intent.file, 'document.docx');

            const response = await fetch('/api/document/import', {
              method: 'POST',
              body: formData,
            });

            if (response.ok) {
              const sfdt = await response.text();
              setLoadingStep('rendering');
              editorRef.current?.loadDocument(sfdt);
            } else {
              throw new Error('변환 실패');
            }
          }

        } else {
          // 기존 문서 불러오는 프로세스
          setLoadingStep('downloading');
          const { data, error } = await supabase
            .from('documents')
            .select('*')
            .eq('id', documentId)
            .single();

          if (error) throw error;

          if (data) {
            setTitle(data.title);

            if (data.file_path || data.content_html) {
              setIsNewDocument(false);
            } else {
              setIsNewDocument(true);
            }

            if (data.file_path) {
              const { data: fileData, error: downloadError } = await supabase.storage
                .from('files')
                .download(data.file_path);

              if (downloadError) throw downloadError;

              if (fileData) {
                setLoadingStep('importing');
                const formData = new FormData();
                formData.append('document', fileData, 'document.docx');

                const response = await fetch('/api/document/import', {
                  method: 'POST',
                  body: formData,
                });

                if (response.ok) {
                  const sfdt = await response.text();
                  setLoadingStep('rendering');
                  editorRef.current?.loadDocument(sfdt);
                } else {
                  throw new Error('변환 실패');
                }
              }
            } else if (data.content_html) {
              setLoadingStep('rendering');
              editorRef.current?.loadDocument(data.content_html);
            } else {
              setIsInitializing(false);
              setLoadingStep('complete');
            }
          }
        }

        // 공통 안전장치 (렌더링 이후)
        safetyTimer = setTimeout(() => {
          if (isInitializing) {
            const text = editorRef.current?.getText() || '';
            setContent(text);
            setIsInitializing(false);
            setLoadingStep('complete');
          }
        }, 10000); 

      } catch (error) {
        console.error('Failed to initialize document:', error);
        setHasLoadError(true);
        setIsInitializing(false);
      }
    };

    if (!initializationStartedRef.current) {
      initializeDocument();
    }

    return () => {
      if (safetyTimer) clearTimeout(safetyTimer);
    };
  }, [documentId, supabase, setTitle, editorRef, isInitializing]);

  // 로딩 메시지 맵핑
  const loadingMessages = {
    idle: '준비 중...',
    creating: '새 문서를 생성하는 중입니다...',
    downloading: '파일을 처리하고 있습니다...',
    importing: '문서 형식을 변환하는 중입니다...',
    rendering: '에디터에 내용을 구성하고 있습니다...',
    complete: '완료!'
  };

  const handleSelectionChange = useCallback((html: string, text: string) => {
    setSelection(html, text);
  }, [setSelection]);

  // 브라우저 탭 제목 동기화
  useEffect(() => {
    const displayTitle = title || '제목 없는 문서';
    document.title = `${displayTitle} — 문서봇`;
  }, [title]);

  // 제목 편집 핸들러
  const handleTitleClick = () => {
    setTempTitle(title || '제목 없는 문서');
    setIsEditingTitle(true);
  };

  const handleTitleSave = async () => {
    const newTitle = tempTitle.trim() || '제목 없는 문서';
    setIsEditingTitle(false);
    
    if (newTitle === title) return;

    try {
      const { error } = await supabase
        .from('documents')
        .update({ title: newTitle })
        .eq('id', documentId);

      if (error) throw error;
      setTitle(newTitle);
    } catch (err) {
      console.error('제목 저장 실패:', err);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
    }
  };

  // 수동 저장 핸들러
  const handleManualSave = async () => {
    if (!editorRef.current || saveStatus !== 'idle') return;

    try {
      setSaveStatus('saving');
      const sfdt = editorRef.current.getSfdt();
      
      // 1. documents 테이블 업데이트
      const { error } = await supabase
        .from('documents')
        .update({ 
          content_html: sfdt,
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId);

      if (error) throw error;

      // 2. 내용이 변경된 경우에만 versions 테이블에 스냅샷 저장
      if (content !== lastSavedContentRef.current) {
        // 버전 삽입
        const { error: versionError } = await supabase
          .from('versions')
          .insert({
            document_id: documentId,
            snapshot_html: sfdt
          });
        
        if (versionError) console.error('버전 저장 실패:', versionError);

        // 최대 20개 유지 로직
        const { data: versions } = await supabase
          .from('versions')
          .select('id')
          .eq('document_id', documentId)
          .order('created_at', { ascending: true });

        if (versions && versions.length > 20) {
          const toDelete = versions.slice(0, versions.length - 20);
          const deleteIds = toDelete.map(v => v.id);
          await supabase
            .from('versions')
            .delete()
            .in('id', deleteIds);
        }
      }

      setSaveStatus('saved');
      lastSavedContentRef.current = content;
      
      setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    } catch (err) {
      console.error('수동 저장 실패:', err);
      setSaveStatus('idle');
    }
  };

  // 복원 핸들러
  const handleRestore = async (snapshot: string) => {
    if (!editorRef.current) return;

    try {
      setSaveStatus('saving');
      
      // 에디터 로드
      editorRef.current.loadDocument(snapshot);
      
      // documents 테이블 업데이트
      const { error } = await supabase
        .from('documents')
        .update({ 
          content_html: snapshot,
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId);

      if (error) throw error;

      // 로드된 후 텍스트 추출하여 content 상태 동기화
      const text = editorRef.current.getText();
      setContent(text);
      lastSavedContentRef.current = text;

      setSaveStatus('saved');
      setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    } catch (err) {
      console.error('복원 실패:', err);
      setSaveStatus('idle');
    }
  };

  // 개선된 자동저장 로직 (Interval 방식)
  useEffect(() => {
    if (!documentId || isInitializing || !editorRef.current) return;

    const checkAutoSave = async () => {
      // 조건 확인
      const now = Date.now();
      const timeSinceLastTyping = now - lastTypingTimeRef.current;
      const hasChanges = content !== lastSavedContentRef.current;
      
      if (
        timeSinceLastTyping >= 3000 && // 3초 이상 경과
        hasChanges && // 변경 있음
        !isSaving && // 현재 저장 중 아님
        saveStatus === 'idle' // 수동 저장 중 아님
      ) {
        try {
          setIsSaving(true);
          console.log('자동 저장 시작...');
          
          const sfdt = editorRef.current?.getSfdt();
          if (sfdt) {
            const { error } = await supabase
              .from('documents')
              .update({ 
                content_html: sfdt,
                updated_at: new Date().toISOString()
              })
              .eq('id', documentId);
              
            if (error) {
              console.error('자동 저장 실패:', error);
            } else {
              console.log('자동 저장 완료');
              lastSavedContentRef.current = content;
              
              // "저장됨 ✓" 표시를 위해 saveStatus 활용
              setSaveStatus('saved');
              setTimeout(() => setSaveStatus('idle'), 2000);
            }
          }
        } catch (err) {
          console.error('자동 저장 중 오류 발생:', err);
        } finally {
          setIsSaving(false);
        }
      }
    };

    const interval = setInterval(checkAutoSave, 5000); // 5초마다 체크

    return () => clearInterval(interval);
  }, [content, documentId, isInitializing, supabase, editorRef, isSaving, saveStatus]);

  const handleExport = () => {
    if (editorRef.current) {
      editorRef.current.exportAsDocx(title);
    }
  };

  return (
    <main className="flex h-screen bg-white">
      <AppSidebar variant="narrow" />

      {/* 에디터 영역 */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header>
          <div className="flex items-center gap-4 min-w-0 flex-1 mr-4 w-full">
            <span className="text-sm font-medium text-gray-500 underline decoration-gray-300 shrink-0">내 문서</span>
            {isEditingTitle ? (
              <input
                autoFocus
                type="text"
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={handleTitleKeyDown}
                className="text-sm font-bold text-gray-800 border-b border-blue-500 outline-none bg-transparent w-full max-w-[300px]"
              />
            ) : (
            <span 
              onClick={handleTitleClick}
              className="text-sm font-bold text-gray-800 cursor-pointer hover:bg-gray-50 px-1 rounded truncate"
            >
              {title || '제목 없는 문서'}
            </span>
          )}
          {content !== lastSavedContentRef.current && (
            <span className="text-gray-400 text-[10px] shrink-0 ml-1">●</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 mr-4">
          {(isSaving || saveStatus === 'saving') && <span className="text-xs text-gray-400 animate-pulse">저장 중...</span>}
          <button 
            onClick={() => setIsHistoryOpen(true)}
            className="px-3 py-1.5 text-xs font-medium border rounded-md hover:bg-gray-50"
          >
            히스토리
          </button>
          <button 
            onClick={handleManualSave}
            disabled={saveStatus !== 'idle'}
            className="px-3 py-1.5 text-xs font-medium border rounded-md hover:bg-gray-50 min-w-[70px] transition-colors"
          >
            {saveStatus === 'saved' ? '저장됨 ✓' : '저장'}
          </button>
          <button onClick={handleExport} className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700">내보내기</button>
        </div>
        </Header>

        <div className="flex-1 relative bg-[#f0f0f0]">
          <div className="absolute inset-0">
            {hasLoadError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-20">
                <div className="flex flex-col items-center max-w-md p-8 text-center">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                    <FileX className="w-8 h-8 text-gray-300" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">문서를 불러오지 못했습니다</h2>
                  <p className="text-gray-500 mb-8">
                    문서가 존재하지 않거나 접근 권한이 없습니다.
                  </p>
                  <Button 
                    onClick={() => window.location.href = '/dashboard'}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8"
                  >
                    대시보드로 돌아가기
                  </Button>
                </div>
              </div>
            ) : (
              <ErrorBoundary 
                fallback={
                  <div className="flex flex-col items-center justify-center h-full bg-white p-4">
                    <p className="text-gray-600 mb-4 text-sm">에디터를 불러오지 못했습니다. 새로고침해주세요.</p>
                    <Button variant="outline" size="sm" onClick={() => window.location.reload()}>새로고침</Button>
                  </div>
                }
              >
                <SyncfusionDocEditor 
                  ref={editorRef} 
                  onSelectionChange={handleSelectionChange}
                  onContentChange={handleContentChange}
                />
              </ErrorBoundary>
            )}
            
            {isInitializing && !hasLoadError && (
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
      {!isInitializing && !hasLoadError && (
        <ErrorBoundary
          fallback={
            <div className="w-[400px] border-l flex items-center justify-center bg-gray-50 text-gray-500 text-sm p-4 text-center">
              AI 도우미를 불러오지 못했습니다.
            </div>
          }
        >
          <ChatPanel
            documentId={documentId}
            editorContext={content}
            isNewDocument={isNewDocument}
          />
        </ErrorBoundary>
      )}

      {/* 버전 히스토리 패널 */}
      <VersionHistoryPanel 
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        documentId={documentId}
        onRestore={handleRestore}
      />
    </main>
  )
}
