import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { creationIntentStore } from '@/lib/store/creationIntent';
import { SyncfusionDocEditorRef } from '@/components/editor/SyncfusionDocEditor';

export type LoadingStatus = 'idle' | 'loading' | 'error' | 'ready';
export type LoadingStep = 'idle' | 'creating' | 'downloading' | 'importing' | 'rendering' | 'complete';

interface UseEditorInitProps {
  documentId: string;
  editorRef: React.RefObject<SyncfusionDocEditorRef>;
  setTitle: (title: string) => void;
  setContent: (content: string) => void;
}

export function useEditorInit({ documentId, editorRef, setTitle, setContent }: UseEditorInitProps) {
  const [status, setStatus] = useState<LoadingStatus>('idle');
  const [step, setStep] = useState<LoadingStep>('idle');
  const [isNewDocument, setIsNewDocument] = useState(false);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);
  const [isUploaded, setIsUploaded] = useState(false);
  const initializationStartedRef = useRef(false);

  useEffect(() => {
    if (!documentId || initializationStartedRef.current || !editorRef.current) {
      return;
    }

    initializationStartedRef.current = true;
    setStatus('loading');

    const initialize = async () => {
      const supabase = createClient();

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Unauthorized");

        const intent = creationIntentStore.getIntent(documentId);

        if (intent) {
          // ==================== 새 문서 생성 프로세스 ====================
          setStep('creating');
          if (intent.prompt) {
            setInitialPrompt(intent.prompt);
          }
          creationIntentStore.removeIntent(documentId);

          const insertData: any = {
            id: documentId,
            title: intent.title || '제목 없는 문서',
            user_id: user.id
          };

          // ai_prompt 인텐트도 empty처럼 처리하여 매끄럽게 진입
          if (intent.type === 'empty' || intent.type === 'template' || intent.type === 'ai_prompt') {
            const htmlContent = intent.html || '<p><br/></p>';
            insertData.content_html = htmlContent;
            
            const { error } = await supabase.from('documents').insert(insertData);
            if (error) throw error;
            
            setTitle(insertData.title);
            setIsNewDocument(true);
            setStep('rendering');
            
            await editorRef.current?.loadDocument(htmlContent);
            const text = editorRef.current?.getText() || '';
            setContent(text);

          } else if (intent.type === 'upload' && intent.file) {
            setStep('downloading'); 
            setIsUploaded(true);
            
            const fileExt = intent.file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `${user.id}/documents/${fileName}`;

            // 1. 스토리지 업로드
            const { error: uploadError } = await supabase.storage
              .from('files')
              .upload(filePath, intent.file);
            if (uploadError) throw uploadError;

            // 2. DB 레코드 생성
            insertData.file_path = filePath;
            const { error: insertError } = await supabase.from('documents').insert(insertData);
            if (insertError) throw insertError;

            setTitle(insertData.title);
            setIsNewDocument(false);
            
            // 3. 서버 변환 시작
            setStep('importing');
            const formData = new FormData();
            formData.append('document', intent.file, 'document.docx');

            const response = await fetch('/api/document/import', {
              method: 'POST',
              body: formData,
            });

            if (!response.ok) throw new Error('변환 실패');
            
            const { sfdt } = await response.json();
            
            setStep('rendering');
            await editorRef.current?.loadDocument(sfdt);
          }

        } else {
          // ==================== 기존 문서 불러오기 프로세스 ====================
          setStep('downloading');
          const { data, error } = await supabase
            .from('documents')
            .select('*')
            .eq('id', documentId)
            .single();

          if (error) throw error;
          if (!data) throw new Error("Document not found");

          setTitle(data.title);
          setIsNewDocument(!(data.file_path || data.content_html));

          if (data.folder_id) {
            const { data: folderData } = await supabase
              .from('folders')
              .select('name')
              .eq('id', data.folder_id)
              .single();
            if (folderData) {
              setFolderName(folderData.name);
            }
          }

          if (data.content_html && data.content_html.trim() !== '') {
            // 🌟 수정: 이미 변환되어 DB에 저장된 SFDT(또는 HTML)가 있다면 우선적으로 불러옵니다! (스피너 방지)
            setStep('rendering');
            await editorRef.current?.loadDocument(data.content_html);
          } else if (data.file_path) {
            // 🌟 수정: content_html이 비어있을 때만 최후의 수단으로 파일을 다시 다운로드하고 변환합니다.
            const { data: fileData, error: downloadError } = await supabase.storage
              .from('files')
              .download(data.file_path);

            if (downloadError) throw downloadError;
            if (!fileData) throw new Error("File empty");

            setStep('importing');
            const formData = new FormData();
            formData.append('document', fileData, 'document.docx');

            const response = await fetch('/api/document/import', {
              method: 'POST',
              body: formData,
            });

            if (!response.ok) throw new Error('변환 실패');

            const { sfdt } = await response.json();

            setStep('rendering');
            await editorRef.current?.loadDocument(sfdt);
            
          } else {
            // 아무 내용도 없는 경우
            setStep('rendering');
            await editorRef.current?.loadDocument('<p><br/></p>');
          }
          
          // documentChange 이벤트가 처리하도록 텍스트 추출 생략
        }

        setStep('complete');
        setStatus('ready');

      } catch (error) {
        console.error('Failed to initialize document:', error);
        setStatus('error');
      }
    };

    initialize();
  }, [documentId, editorRef, setTitle, setContent]);

  return { status, step, isNewDocument, folderName, initialPrompt, isUploaded };
}
