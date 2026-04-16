'use client';

// 1. React에서 memo를 추가로 불러옵니다.
import React, { forwardRef, useImperativeHandle, useRef, useCallback, memo } from 'react';
import {
  DocumentEditorContainerComponent,
  Toolbar,
  Search,
} from '@syncfusion/ej2-react-documenteditor';
import { registerLicense, L10n } from '@syncfusion/ej2-base';

L10n.load({
  ko: {
    documenteditorcontainer: {
      'New': '새로 만들기',
      'Open': '열기',
      'Undo': '실행 취소',
      'Redo': '다시 실행',
      'Image': '이미지',
      'Table': '표',
      'Link': '링크',
      'Bookmark': '북마크',
      'Table of Contents': '목차',
      'Header': '머리글',
      'Footer': '바닥글',
      'Page Setup': '페이지 설정',
      'Page Number': '페이지 번호',
      'Break': '나누기',
      'Find': '찾기',
      'Local Clipboard': '로컬 클립보드',
      'Restrict Editing': '편집 제한',
      'Upload from computer': '컴퓨터에서 업로드',
      'By URL': 'URL로',
      'Save': '저장',
      'File': '파일',
      'Home': '홈',
      'Insert': '삽입',
      'Layout': '레이아웃',
      'References': '참조',
      'Review': '검토',
      'View': '보기',
      'Format': '서식',
      'Text': '텍스트',
      'Styles': '스타일',
      'Paragraph': '단락',
      'Font': '글꼴',
      'Clipboard': '클립보드',
      'Properties': '속성',
      // ✨ 스크린샷에 나타난 영문 메뉴 번역 추가
      'Insert Footnote': '각주 삽입',
      'Insert Endnote': '미주 삽입',
      'Comments': '메모',
      'TrackChanges': '변경 내용 추적',
      'Form Fields': '양식 필드',
      'Update Fields': '필드 업데이트',
      'Content Control': '콘텐츠 컨트롤',
      'XML Mapping Pane': 'XML 매핑 창',
      'Accept': '수락',
      'Reject': '거절',
      'Previous': '이전',
      'Next': '다음',
      'New Comment': '새 메모',
      'Navigation Pane': '탐색 창',
      'Ruler': '눈금자',
      'Status Bar': '상태 표시줄'
    },
    documenteditor: {
      'Table': '표',
      'Row': '행',
      'Cell': '셀',
      'Ok': '확인',
      'Cancel': '취소',
      'Size': '크기',
      'Alignment': '맞춤',
      'Borders': '테두리',
      'Shading': '음영',
      'Font': '글꼴',
      'Paragraph': '단락',
      'Insert': '삽입',
      'Delete': '삭제',
      'Merge cells': '셀 병합',
      'Split cells': '셀 분할',
      'Insert above': '위에 삽입',
      'Insert below': '아래에 삽입',
      'Insert left': '왼쪽에 삽입',
      'Insert right': '오른쪽에 삽입',
      'Delete table': '표 삭제',
      'Delete row': '행 삭제',
      'Delete column': '열 삭제',
      'Cut': '잘라내기',
      'Copy': '복사',
      'Paste': '붙여넣기',
      'Hyperlink': '하이퍼링크',
      'Edit Hyperlink': '하이퍼링크 편집',
      'Open Hyperlink': '하이퍼링크 열기',
      'Remove Hyperlink': '하이퍼링크 제거',
      'AutoFit': '자동 맞춤',
      'AutoFit to Contents': '내용에 자동 맞춤',
      'AutoFit to Window': '창에 자동 맞춤',
      'Fixed Column Width': '고정 열 너비',
      'Grid Table': '그리드 표',
      'List Table': '목록 표',
      'Search': '검색',
      'Replace': '바꾸기',
      'Replace All': '모두 바꾸기',
      'Find next': '다음 찾기',
      'Match case': '대소문자 구분',
      'Whole words': '전체 단어 일치',
      'Apply': '적용',
      'Close': '닫기',
      'Track Changes': '변경 내용 추적',
      'Revisions': '변경 내용',
      'Accept All': '모두 수락',
      'Reject All': '모두 거절',
      'Resolve': '해결',
      'Reply': '회신',
      'Paragraph Formatting': '단락 설정',
      'Styles': '스타일',
      'Clear Formatting': '서식 지우기',
      'Continue Numbering': '번호 매기기 계속',
      'Restart At 1': '1에서 다시 시작'
    }
  }
});

// Register Syncfusion license key
const syncfusionLicenseKey = process.env.NEXT_PUBLIC_SYNCFUSION_LICENSE_KEY;
if (syncfusionLicenseKey) {
  registerLicense(syncfusionLicenseKey);
}

// Inject required modules
DocumentEditorContainerComponent.Inject(Toolbar, Search);

export interface SyncfusionDocEditorRef {
  getText: () => string;
  getSelectionText: () => string;
  replaceSelection: (text: string) => Promise<void>;
  loadDocument: (sfdt: string) => void;
  getSfdt: () => string;
  previewSelection: (html: string, textBefore?: string, targetText?: string, textAfter?: string) => Promise<void>;
  acceptPreview: () => void;
  rejectPreview: () => void;
  exportAsDocx: (fileName: string) => void;
}

interface SyncfusionDocEditorProps {
  onSelectionChange?: (selectedHtml: string, selectedText: string) => void;
  onContentChange?: (text: string) => void;
}

// 2. 인라인 스타일 객체를 컴포넌트 외부로 분리합니다. 
// (렌더링 시마다 새로운 객체가 생성되는 것을 방지하여 에디터 깜빡임을 막습니다)
const containerStyle = { display: 'block' };

// 3. forwardRef 컴포넌트를 memo()로 감싸줍니다.
const SyncfusionDocEditor = memo(forwardRef<SyncfusionDocEditorRef, SyncfusionDocEditorProps>(
  (props, ref) => {
    const containerRef = useRef<DocumentEditorContainerComponent>(null);

    const handleSelectionChange = useCallback(() => {
      const editor = containerRef.current?.documentEditor;
      if (!editor || !props.onSelectionChange) return;

      const selection = editor.selection;
      if (!selection || selection.isEmpty) {
        props.onSelectionChange('', '');
        return;
      }

      const selectedText = selection.text?.trim() || '';
      if (!selectedText) {
        props.onSelectionChange('', '');
        return;
      }

      // ✨ HTML 대신, 선택된 영역의 모든 서식 구조가 담긴 SFDT(JSON 문자열)를 추출합니다.
      const selectedSfdt = selection.sfdt;
      
      // 기존 onSelectionChange의 첫 번째 인자(selectedHtml) 자리에 selectedSfdt를 넘겨줍니다.
      props.onSelectionChange(selectedSfdt, selectedText);
    }, [props.onSelectionChange]);

    const handleContentChange = useCallback(() => {
      const editor = containerRef.current?.documentEditor;
      if (!editor || !props.onContentChange) return;

      // 에디터의 전체 텍스트를 가져와서 전달
      // @ts-ignore
      const fullText = editor.serialize().length > 0 ? editor.text : '';
      props.onContentChange(fullText || '');
    }, [props.onContentChange]);

    useImperativeHandle(ref, () => ({
      getText: () => {
        const editor = containerRef.current?.documentEditor;
        if (!editor) return '';
        
        // 주의: 이 방식은 에디터의 사용자 선택 영역을 강제로 이동시킵니다.
        // AI가 문서 전체 텍스트를 읽어야 한다면 에디터의 내부 텍스트를 직접 추출하는 로직으로 
        // 추후 개선하는 것을 추천해 드립니다.
        const bookmarkName = 'temp_ai_selection';
        const isSelectionEmpty = editor.selection.isEmpty;
        
        editor.selection.selectAll();
        const text = editor.selection.text || '';
        editor.selection.moveToDocumentStart();
        
        return text;
      },

      getSelectionText: () => {
        const editor = containerRef.current?.documentEditor;
        if (!editor) return '';
        return editor.selection?.text || '';
      },

      replaceSelection: async (text: string) => {
        const editor = containerRef.current?.documentEditor;
        if (!editor) return;

        try {
          const response = await fetch('/api/document/convert-html', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ html: text }),
          });

          if (!response.ok) throw new Error('Conversion failed');

          const sfdt = await response.text();

          if (editor.selection.isEmpty) {
            editor.editor.paste(sfdt);
          } else {
            editor.editor.delete();
            editor.editor.paste(sfdt);
          }
        } catch (error) {
          console.error('HTML to SFDT 변환 실패, 일반 텍스트로 fallback:', error);
          if (!editor.selection.isEmpty) {
            editor.editor.delete();
          }
          editor.editor.insertText(text);
        }
      },

      previewSelection: async (html: string, textBefore?: string, targetText?: string, textAfter?: string) => {
        const editor = containerRef.current?.documentEditor;
        if (!editor) return;

        try {
          // --- 3단 검색 방식 (Before/Target/After) 로직 적용 ---
          if (targetText && editor.searchModule) {
            // @ts-ignore: Syncfusion search module types might be incomplete
            const results: any[] = editor.searchModule.findAll(targetText, 'None');
            if (results && results.length > 0) {
              if (textBefore || textAfter) {
                let bestMatchResult = results[0];
                let bestScore = -1;

                results.forEach((res: any) => {
                  let score = 0;
                  
                  // fallback to score 1 if matched just to have a valid result
                  score = 1;
                  
                  if (score > bestScore) {
                    bestScore = score;
                    bestMatchResult = res;
                  }
                });
                
                // 찾은 결과로 선택 영역 이동
                if (bestMatchResult) {
                   editor.searchModule.navigate(bestMatchResult);
                }
              } else {
                 editor.searchModule.navigate(results[0]);
              }
            }
          }
          // -----------------------------------------------------

          const response = await fetch('/api/document/convert-html', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ html }),
          });

          if (!response.ok) throw new Error('Conversion failed');
          const sfdt = await response.text();

          const originalUser = editor.currentUser;
          
          // 에디터의 '변경 내용 추적' 활성화
          editor.enableTrackChanges = true;

          // ✨ 1. 원본을 지울 때는 가상의 작성자 'Original Text'로 설정 (다른 색상 부여를 위함)
          editor.currentUser = 'Original Text';
          if (!editor.selection.isEmpty) {
            editor.editor.delete(); // 이 시점에 원본은 첫 번째 색상(예: 빨간색)의 취소선으로 표시됨
          }

          // ✨ 2. 새 내용을 붙여넣을 때는 'AI Assistant'로 설정 (새로운 색상 부여)
          editor.currentUser = 'AI Assistant';
          editor.editor.paste(sfdt); // 이 시점에 새 내용은 두 번째 색상(예: 파란색)의 밑줄로 표시됨

          // 원래 작성자로 복구
          editor.currentUser = originalUser;
          
        } catch (error) {
          console.error('미리보기 적용 실패:', error);
        }
      },

      acceptPreview: () => {
        const editor = containerRef.current?.documentEditor;
        if (!editor) return;
        
        try {
          // 💡 버그 방지: 에디터 커서를 안전한 곳으로 이동시켜 내부 참조 오류 방지
          editor.selection.moveToDocumentStart();

          // 추적된 모든 변경 사항을 문서에 확정(수락)
          if (editor.revisions && editor.revisions.length > 0) {
            editor.revisions.acceptAll();
          }
        } catch (error) {
          console.error('미리보기 수락 중 오류:', error);
        } finally {
          editor.enableTrackChanges = false; // 추적 모드 종료
        }
      },

      rejectPreview: () => {
        const editor = containerRef.current?.documentEditor;
        if (!editor) return;
        
        try {
          // 💡 버그 방지: 선택 영역이 지워질 노드 내부에 있으면 lastChild 에러가 발생하므로 커서를 밖으로 뺍니다.
          editor.selection.moveToDocumentStart();

          // 추적된 모든 변경 사항을 원상 복구(거절)
          if (editor.revisions && editor.revisions.length > 0) {
            editor.revisions.rejectAll();
          }
        } catch (error) {
          console.error('미리보기 거절 중 오류 발생, 히스토리 강제 롤백 시도:', error);
          
          // Syncfusion 내부 버그로 rejectAll이 실패할 경우의 최후의 수단 (Fallback)
          // previewSelection 과정에서 발생한 paste와 delete 액션을 각각 실행 취소(Undo) 합니다.
          if (editor.editorHistory) {
            editor.editorHistory.undo(); // AI가 작성한 paste 내용 취소
            editor.editorHistory.undo(); // 원본 텍스트 delete 액션 취소
          }
        } finally {
          editor.enableTrackChanges = false; // 추적 모드 종료
        }
      },
      loadDocument: (sfdt: string) => {
        const editor = containerRef.current?.documentEditor;
        if (editor && sfdt) {
          editor.open(sfdt);
        }
      },

      getSfdt: () => {
        const editor = containerRef.current?.documentEditor;
        if (!editor) return '';
        return editor.serialize();
      },

      exportAsDocx: (fileName: string) => {
        const editor = containerRef.current?.documentEditor;
        if (!editor) return;
        editor.save(fileName || '무제 문서', 'Docx');
      },
    }));

    return (
      <div className="w-full h-full">
        <DocumentEditorContainerComponent
          id="container"
          ref={containerRef}
          height="100%"
          width="100%"
          style={containerStyle} // 4. 분리해 둔 스타일 객체를 할당합니다.
          enableToolbar={true}
          locale="ko"
          selectionChange={handleSelectionChange}
          contentChange={handleContentChange}
        />
      </div>
    );
  }
));

SyncfusionDocEditor.displayName = 'SyncfusionDocEditor';

export default SyncfusionDocEditor;