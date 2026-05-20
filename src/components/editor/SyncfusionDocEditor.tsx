'use client';

import React, { forwardRef, useImperativeHandle, useRef, useCallback, memo } from 'react';
import {
  DocumentEditorContainerComponent,
  Toolbar,
  Search,
} from '@syncfusion/ej2-react-documenteditor';
import { registerLicense, L10n } from '@syncfusion/ej2-base';
import { useState, useEffect } from 'react';

// Module level cache for license key
let cachedLicenseKey: string | null = null;

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

// Inject required modules
DocumentEditorContainerComponent.Inject(Toolbar, Search);

// 간소화된 툴바 설정 (Syncfusion 컨테이너에서 공식 지원하는 항목들만 배치)
const CUSTOM_TOOLBAR_ITEMS = [
  'Undo', 'Redo', 'Separator',
  'Image', 'Table', 'Hyperlink', 'Separator',
  'Header', 'Footer', 'PageSetup', 'PageNumber', 'Break', 'Separator',
  'Find', 'Separator',
  'LocalClipboard'
];

export interface SyncfusionDocEditorRef {
  getText: () => string;
  getSelectionText: () => string;
  replaceSelection: (text: string) => Promise<void>;
  loadDocument: (content: string) => Promise<void>;
  getSfdt: () => string;
  previewSelection: (
    html: string,
    textBefore?: string,
    targetText?: string,
    textAfter?: string,
    targetType?: 'text' | 'table',
    targetKeyword?: string
  ) => Promise<boolean>;
  acceptPreview: () => void;
  rejectPreview: () => void;
  exportAsDocx: (fileName: string) => void;
  updateTableData: (targetKeyword: string, tableData: string[][]) => Promise<boolean>;
}

interface SyncfusionDocEditorProps {
  onSelectionChange?: (selectedHtml: string, selectedText: string, isSelectionActive: boolean) => void;
  onContentChange?: (text: string) => void;
}

const containerStyle = { display: 'block' };

/**
 * SFDT JSON에서 커서/선택 상태를 전혀 건드리지 않고 순수하게 텍스트를 추출합니다.
 * 
 * SFDT 구조:
 * { sections: [ { blocks: [ { inlines: [ { text: "..." }, ... ] } ] } ] }
 * 
 * block 안의 inlines 배열을 순회하며 text 필드를 모아 줄바꿈으로 연결합니다.
 * 표(table) 안의 셀도 재귀적으로 처리합니다.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTextFromSfdt(sfdt: string): string {
  try {
    const doc = JSON.parse(sfdt);
    const lines: string[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const collectBlocks = (blocks: any[]): void => {
      if (!Array.isArray(blocks)) return;
      for (const block of blocks) {
        if (block.rows) {
          // 표(table): rows > cells > blocks 재귀
          for (const row of block.rows) {
            for (const cell of row.cells) {
              collectBlocks(cell.blocks);
            }
          }
        } else if (block.inlines) {
          // 일반 단락
          const lineText = block.inlines
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((inline: any) => inline.text ?? '')
            .join('');
          lines.push(lineText);
        }
      }
    };

    for (const section of doc.sections ?? []) {
      collectBlocks(section.blocks ?? []);
    }

    return lines.join('\n').trim();
  } catch (err) {
    console.error('SFDT 텍스트 파싱 실패:', err);
    return '';
  }
}

const SyncfusionDocEditor = memo(forwardRef<SyncfusionDocEditorRef, SyncfusionDocEditorProps>(
  (props, ref) => {
    const containerRef = useRef<DocumentEditorContainerComponent>(null);
    const isMouseSelectingRef = useRef(false);
    const [isLicenseLoaded, setIsLicenseLoaded] = useState(false);

    useEffect(() => {
      const loadLicense = async () => {
        if (cachedLicenseKey) {
          registerLicense(cachedLicenseKey);
          setIsLicenseLoaded(true);
          return;
        }

        try {
          const res = await fetch('/api/editor/license');
          if (res.ok) {
            const data = await res.json();
            if (data.key) {
              cachedLicenseKey = data.key;
              registerLicense(cachedLicenseKey!);
            }
          } else {
            console.error('Failed to load Syncfusion license');
          }
        } catch (error) {
          console.error('Error fetching Syncfusion license:', error);
        } finally {
          setIsLicenseLoaded(true);
        }
      };

      loadLicense();
    }, []);

    const handleSelectionChange = useCallback(() => {
      const editor = containerRef.current?.documentEditor;
      if (!editor || !props.onSelectionChange) return;

      const selection = editor.selection;
      if (!selection || selection.isEmpty) {
        props.onSelectionChange('', '', false);
        return;
      }

      // 마우스로 드래그 중일 때만 선택으로 인정
      if (!isMouseSelectingRef.current) {
        props.onSelectionChange('', '', false);
        return;
      }

      const selectedText = selection.text?.trim() || '';
      if (!selectedText) {
        props.onSelectionChange('', '', false);
        return;
      }

      const selectedSfdt = selection.sfdt;
      props.onSelectionChange(selectedSfdt, selectedText, true);
    }, [props]);

    /**
     * 커서/선택 상태를 건드리지 않고 전체 텍스트를 추출합니다.
     * serialize()는 현재 선택 영역에 영향을 주지 않습니다.
     */
    const extractFullTextDirectly = useCallback(() => {
      const editor = containerRef.current?.documentEditor;
      if (!editor) return '';
      try {
        const sfdt = editor.serialize();
        return extractTextFromSfdt(sfdt);
      } catch (err) {
        console.error('텍스트 직접 추출 실패:', err);
        return '';
      }
    }, []);

    const handleContentChange = useCallback(() => {
      if (!props.onContentChange) return;
      const text = extractFullTextDirectly();
      props.onContentChange(text);
    }, [props, extractFullTextDirectly]);

    const handleDocumentChange = useCallback(() => {
      // 문서 로드 완료 시에도 확실하게 텍스트 추출
      handleContentChange();
    }, [handleContentChange]);

    useImperativeHandle(ref, () => ({
      getText: () => {
        return extractFullTextDirectly();
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

          try {
            editor.selection.selectBookmark('AI_TARGET');
            editor.editor.deleteBookmark('AI_TARGET');
          } catch (e) {}

          if (!editor.selection.isEmpty) {
            editor.editor.delete();
          }
          editor.editor.paste(sfdt);
        } catch (error) {
          console.error('HTML to SFDT 변환 실패, 일반 텍스트로 fallback:', error);
          try {
            editor.selection.selectBookmark('AI_TARGET');
            editor.editor.deleteBookmark('AI_TARGET');
          } catch (e) {}

          if (!editor.selection.isEmpty) {
            editor.editor.delete();
          }
          editor.editor.insertText(text.replace(/<[^>]+>/g, ''));
        }
      },

      previewSelection: async (
        html: string,
        _textBefore?: string,
        _targetText?: string,
        _textAfter?: string,
        _targetType?: 'text' | 'table',
        _targetKeyword?: string
      ): Promise<boolean> => {
        const editor = containerRef.current?.documentEditor;
        if (!editor) return false;

        try {
          const response = await fetch('/api/document/convert-html', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ html }),
          });

          if (!response.ok) throw new Error('Conversion failed');
          const sfdt = await response.text();

          try {
            editor.selection.selectBookmark('AI_TARGET');
            editor.editor.deleteBookmark('AI_TARGET');
          } catch (e) {}

          if (!editor.selection.isEmpty) {
            editor.editor.delete(); 
          }

          editor.editor.paste(sfdt); 

          return true;
        } catch (error) {
          console.error('적용 실패:', error);
          return false;
        }
      },

      acceptPreview: () => {
        // 더 이상 변경 추적(TrackChanges)을 사용하지 않으므로 수락 시 할 작업이 없습니다.
      },

      rejectPreview: () => {
        const editor = containerRef.current?.documentEditor;
        if (!editor) return;
        
        try {
          if (editor.editorHistory) {
            editor.editorHistory.undo(); 
          }
        } catch (error) {
          console.error('실행 취소 중 오류 발생:', error);
        }
      },

      loadDocument: async (content: string) => {
        const editor = containerRef.current?.documentEditor;
        if (editor && content) {
          try {
            // 내용이 JSON 객체의 시작인 '{' 로 시작하는지 아주 간단히 판별
            const trimmed = content.trim();
            if (trimmed.startsWith('{')) {
              // SFDT (Syncfusion Document Format) JSON
              editor.open(content);
            } else {
              // 일반 HTML 문자열인 경우 변환 API를 통해 SFDT로 로드
              editor.openBlank(); // 빈 문서로 초기화
              try {
                const response = await fetch('/api/document/convert-html', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ html: content }),
                });
                if (!response.ok) throw new Error('Conversion failed');
                const sfdt = await response.text();
                editor.open(sfdt);
              } catch (convErr) {
                console.error('HTML 변환 실패 후 일반 텍스트로 폴백:', convErr);
                // HTML 파싱이 안되는 에러가 났을 때 최후의 보루로 그냥 텍스트로 삽입
                editor.editor.insertText(content);
              }
            }
          } catch (e) {
            console.error('문서 로드 중 오류:', e);
          }
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

        let originalUser: string | undefined;
        try {
          let foundTable = false;
          if (editor.searchModule) {
            // @ts-expect-error syncfusion types might be incomplete
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
          // @ts-expect-error syncfusion types might be incomplete
          editor.selection.navigateTable('FirstCell');

          originalUser = editor.currentUser;
          editor.enableTrackChanges = true;
          editor.currentUser = 'AI Assistant';

          for (let r = 0; r < tableData.length; r++) {
            for (let c = 0; c < tableData[r].length; c++) {
              editor.selection.selectCell();
              editor.editor.delete();
              editor.editor.insertText(tableData[r][c]);

              if (c < tableData[r].length - 1) {
                // @ts-expect-error syncfusion types might be incomplete
                editor.selection.navigateTable('NextCell');
              }
            }
            if (r < tableData.length - 1) {
              // @ts-expect-error syncfusion types might be incomplete
              editor.selection.navigateTable('NextRow');
            }
          }

          // enableTrackChanges = false를 제거하여 수락/거절 시점에 끄도록 위임
          return true;
        } catch (error) {
          console.error('표 업데이트 실패:', error);
          if (editor) {
            editor.enableTrackChanges = false;
          }
          return false;
        } finally {
          if (editor && originalUser !== undefined) {
            editor.currentUser = originalUser;
          }
        }
      },
    }));

    if (!isLicenseLoaded) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-[#f4f4f4]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      );
    }

    return (
      <div 
        className="w-full h-full"
        onMouseDown={() => {
          isMouseSelectingRef.current = true;
        }}
        onMouseUp={() => {
          const editor = containerRef.current?.documentEditor;
          const hasSelection = editor && !editor.selection?.isEmpty;
          
          if (hasSelection) {
            try {
              editor.editor.deleteBookmark('AI_TARGET');
            } catch (e) {}
            try {
              editor.editor.insertBookmark('AI_TARGET');
            } catch (e) {}
          }
          
          if (!hasSelection) {
            isMouseSelectingRef.current = false;
          }
        }}
        style={{ height: '100%' }}
      >
        <DocumentEditorContainerComponent
          id="container"
          ref={containerRef}
          height="100%"
          width="100%"
          style={containerStyle}
          enableToolbar={true}
          toolbarItems={CUSTOM_TOOLBAR_ITEMS as (import('@syncfusion/ej2-documenteditor').CustomToolbarItemModel | import('@syncfusion/ej2-documenteditor').ToolbarItem)[]}
          locale="ko"
          selectionChange={handleSelectionChange}
          contentChange={handleContentChange}
          documentChange={handleDocumentChange}
        />
      </div>
    );
  }
));

SyncfusionDocEditor.displayName = 'SyncfusionDocEditor';

export default SyncfusionDocEditor;