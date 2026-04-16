'use client';

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
  previewSelection: (html: string, textBefore?: string, targetText?: string, textAfter?: string, targetType?: 'text' | 'table') => Promise<boolean>;
  acceptPreview: () => void;
  rejectPreview: () => void;
  exportAsDocx: (fileName: string) => void;
  updateTableData: (targetKeyword: string, tableData: string[][]) => Promise<boolean>;
}

interface SyncfusionDocEditorProps {
  onSelectionChange?: (selectedHtml: string, selectedText: string) => void;
  onContentChange?: (text: string) => void;
}

const containerStyle = { display: 'block' };

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

      const selectedSfdt = selection.sfdt;
      props.onSelectionChange(selectedSfdt, selectedText);
    }, [props.onSelectionChange]);

    const handleContentChange = useCallback(() => {
      const editor = containerRef.current?.documentEditor;
      if (!editor || !props.onContentChange) return;

      // @ts-ignore
      const fullText = editor.serialize().length > 0 ? editor.text : '';
      props.onContentChange(fullText || '');
    }, [props.onContentChange]);

    useImperativeHandle(ref, () => ({
      getText: () => {
        const editor = containerRef.current?.documentEditor;
        if (!editor) return '';
        
        // 커서 이동 없이 에디터의 텍스트만 추출 (성능 최적화 및 깜빡임 방지)
        // @ts-ignore
        return editor.text || '';
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

      previewSelection: async (html: string, textBefore?: string, targetText?: string, textAfter?: string, targetType?: 'text' | 'table'): Promise<boolean> => {
        const editor = containerRef.current?.documentEditor;
        if (!editor) return false;

        let originalUser: string | undefined;

        try {
          const tempBookmark = 'ai_temp_position_' + Date.now();
          editor.editor.insertBookmark(tempBookmark);
          const hadSelection = !editor.selection.isEmpty;

          editor.selection.selectAll();
          const fullText = editor.selection.text || '';
          
          editor.selection.selectBookmark(tempBookmark);
          editor.editor.deleteBookmark(tempBookmark);

          let bestMatchResult: any = null;
          let bestScore = -1;
          let foundSomething = false;

          // --- ✨ 3단 검색 및 표(Table) 타겟팅 로직 ---
          if (editor.searchModule) {
            const searchQueries: string[] = [];
            
            if (targetText) {
              searchQueries.push(targetText); // 1순위
              // 2순위: 긴 줄바꿈 문장 추출
              const lines = targetText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 2);
              if (lines.length > 0) {
                const longestLine = lines.reduce((a, b) => a.length > b.length ? a : b, "");
                searchQueries.push(longestLine);
              }
            } else if (textBefore) {
              searchQueries.push(textBefore); // 3순위
            }

            for (const query of searchQueries) {
              if (!query) continue;
              // @ts-ignore
              const results: any[] = editor.searchModule.findAll(query, 'None');
              
              if (results && results.length > 0) {
                let searchStartIndex = 0;
                results.forEach((res: any) => {
                  let score = 1; 
                  const matchIndex = fullText.indexOf(query, searchStartIndex);
                  
                  if (matchIndex !== -1) {
                    if (textBefore) {
                      const actualBefore = fullText.substring(Math.max(0, matchIndex - textBefore.length - 20), matchIndex);
                      if (actualBefore.replace(/\s/g, '').includes(textBefore.replace(/\s/g, ''))) score += 10;
                    }
                    if (textAfter) {
                      const actualAfter = fullText.substring(matchIndex + query.length, matchIndex + query.length + textAfter.length + 20);
                      if (actualAfter.replace(/\s/g, '').includes(textAfter.replace(/\s/g, ''))) score += 10;
                    }
                    searchStartIndex = matchIndex + query.length;
                  }
                  if (score > bestScore) {
                    bestScore = score;
                    bestMatchResult = res;
                  }
                });
                if (bestMatchResult) break;
              }
            }

            if (bestMatchResult) {
              editor.searchModule.navigate(bestMatchResult);
              foundSomething = true;
              
              // 🚀 핵심: AI가 표(Table)를 타겟팅한 경우
              if (targetType === 'table') {
                try {
                  // 검색된 단어의 위치(표 내부)에서 '표 전체 선택' 명령 실행
                  // @ts-ignore
                  editor.selection.selectTable();
                } catch (e) {
                  console.warn("표 선택에 실패했습니다.", e);
                }
              } else if (!targetText && textBefore && bestMatchResult.text === textBefore) {
                // 문맥으로만 찾았을 땐 다음 위치로 넘어가기
                editor.selection.moveToNextCharacter();
              }
            }
          }
          // -----------------------------------------------------

          if (!foundSomething && hadSelection) {
            foundSomething = true;
          }

          if (!foundSomething) {
            console.warn('에디터에서 수정할 위치를 찾지 못했습니다.');
            return false;
          }

          // 8. SFDT 변환 호출
          const response = await fetch('/api/document/convert-html', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ html }),
          });

          if (!response.ok) throw new Error('Conversion failed');
          const sfdt = await response.text();

          originalUser = editor.currentUser;
          editor.enableTrackChanges = true;

          // 🌟 1. 스타일 복원을 위한 변수 선언
          let originalStyle: string | undefined;

          // 🌟 2. 덮어쓰기 전에 기존 스타일 이름 안전하게 저장
          if (!editor.selection.isEmpty && foundSomething) {
            originalStyle = editor.selection.paragraphFormat.styleName;
          }

          // 🌟 3. 툴바 크래시 방지: delete() 없이 paste()로 자동 덮어쓰기
          editor.currentUser = 'AI Assistant';
          
          if (!editor.selection.isEmpty && foundSomething) {
            // 레이아웃 엔진과 툴바 상태가 꼬이지 않도록 10ms의 미세한 딜레이 부여
            await new Promise(resolve => setTimeout(resolve, 10));
          }
          
          // 선택 영역이 있으면 지우고 붙여넣기, 없으면 그냥 붙여넣기가 자동으로 수행됨
          editor.editor.paste(sfdt); 

          // 🌟 4. 새로운 내용을 붙여넣은 직후, 저장해둔 스타일 복원
          if (originalStyle && originalStyle !== 'Normal') {
            try {
              editor.editor.applyStyle(originalStyle);
            } catch (e) {
              console.warn("스타일 복원 실패:", e);
            }
          }

          return true;
          
        } catch (error) {
          console.error('미리보기 적용 실패:', error);
          return false;
        } finally {
          if (editor) {
            if (originalUser !== undefined) {
              editor.currentUser = originalUser;
            }
            editor.enableTrackChanges = false;
          }
        }
      },

      acceptPreview: () => {
        const editor = containerRef.current?.documentEditor;
        if (!editor) return;
        
        try {
          editor.selection.moveToDocumentStart();
          if (editor.revisions && editor.revisions.length > 0) {
            editor.revisions.acceptAll();
          }
        } catch (error) {
          console.error('미리보기 수락 중 오류:', error);
        } finally {
          editor.enableTrackChanges = false;
        }
      },

      rejectPreview: () => {
        const editor = containerRef.current?.documentEditor;
        if (!editor) return;
        
        try {
          editor.selection.moveToDocumentStart();
          if (editor.revisions && editor.revisions.length > 0) {
            editor.revisions.rejectAll();
          }
        } catch (error) {
          console.error('미리보기 거절 중 오류 발생, 히스토리 강제 롤백 시도:', error);
          if (editor.editorHistory) {
            editor.editorHistory.undo(); 
            editor.editorHistory.undo(); 
          }
        } finally {
          editor.enableTrackChanges = false;
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

      updateTableData: async (targetKeyword: string, tableData: string[][]): Promise<boolean> => {
        const editor = containerRef.current?.documentEditor;
        if (!editor) return false;

        try {
          let foundTable = false;
          if (editor.searchModule) {
            // @ts-ignore
            const results: any[] = editor.searchModule.findAll(targetKeyword, 'None');
            if (results && results.length > 0) {
              editor.searchModule.navigate(results[0]);
              foundTable = true;
            }
          }

          if (!foundTable) {
            console.warn('표를 찾지 못했습니다.');
            return false;
          }

          // 해당 표의 첫 번째 셀로 이동
          // @ts-ignore
          editor.selection.navigateTable('FirstCell');

          const originalUser = editor.currentUser;
          editor.enableTrackChanges = true;
          editor.currentUser = 'AI Assistant';

          for (let r = 0; r < tableData.length; r++) {
            for (let c = 0; c < tableData[r].length; c++) {
              // @ts-ignore
              editor.selection.selectCell();
              editor.editor.delete();
              editor.editor.insertText(tableData[r][c]);
              
              if (c < tableData[r].length - 1) {
                // @ts-ignore
                editor.selection.navigateTable('NextCell');
              }
            }
            if (r < tableData.length - 1) {
              // @ts-ignore
              editor.selection.navigateTable('NextRow');
            }
          }

          editor.currentUser = originalUser;
          // 셀 단위 업데이트에서는 track changes를 끄는 것이 안전할 수 있음
          editor.enableTrackChanges = false;
          return true;
        } catch (error) {
          console.error('표 업데이트 실패:', error);
          if (editor) {
            editor.enableTrackChanges = false;
          }
          return false;
        }
      },
    }));

    return (
      <div className="w-full h-full">
        <DocumentEditorContainerComponent
          id="container"
          ref={containerRef}
          height="100%"
          width="100%"
          style={containerStyle}
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