'use client';

// 1. React에서 memo를 추가로 불러옵니다.
import React, { forwardRef, useImperativeHandle, useRef, useCallback, memo } from 'react';
import {
  DocumentEditorContainerComponent,
  Toolbar,
} from '@syncfusion/ej2-react-documenteditor';
import { registerLicense, L10n } from '@syncfusion/ej2-base';

L10n.load({
  ko: {
    documenteditorcontainer: {
      New: '새로 만들기',
      Open: '열기',
      Undo: '실행 취소',
      Redo: '다시 실행',
      Image: '이미지',
      Table: '표',
      Link: '링크',
      Bookmark: '북마크',
      'Table of Contents': '목차',
      Header: '머리글',
      Footer: '바닥글',
      'Page Setup': '페이지 설정',
      'Page Number': '페이지 번호',
      Break: '나누기',
      Find: '찾기',
      'Local Clipboard': '로컬 클립보드',
      'Restrict Editing': '편집 제한',
      'Upload from computer': '컴퓨터에서 업로드',
      'By URL': 'URL로',
      Save: '저장',
      File: '파일',
      Home: '홈',
      Insert: '삽입',
      Layout: '레이아웃',
      References: '참조',
      Review: '검토',
      View: '보기',
      Format: '서식',
      Text: '텍스트',
      Styles: '스타일',
      Paragraph: '단락',
      Font: '글꼴',
      Clipboard: '클립보드',
      Properties: '속성',
    },
    documenteditor: {
      Table: '표',
      Row: '행',
      Cell: '셀',
      Ok: '확인',
      Cancel: '취소',
      Size: '크기',
      Alignment: '맞춤',
      Borders: '테두리',
      Shading: '음영',
      Font: '글꼴',
      Paragraph: '단락',
      Insert: '삽입',
      Delete: '삭제',
      'Merge cells': '셀 병합',
      'Split cells': '셀 분할',
      'Insert above': '위에 삽입',
      'Insert below': '아래에 삽입',
      'Insert left': '왼쪽에 삽입',
      'Insert right': '오른쪽에 삽입',
      'Delete table': '표 삭제',
      'Delete row': '행 삭제',
      'Delete column': '열 삭제',
      Cut: '잘라내기',
      Copy: '복사',
      Paste: '붙여넣기',
      Hyperlink: '하이퍼링크',
      'Edit Hyperlink': '하이퍼링크 편집',
      'Open Hyperlink': '하이퍼링크 열기',
      'Remove Hyperlink': '하이퍼링크 제거',
      AutoFit: '자동 맞춤',
      'AutoFit to Contents': '내용에 자동 맞춤',
      'AutoFit to Window': '창에 자동 맞춤',
      'Fixed Column Width': '고정 열 너비',
      'Grid Table': '그리드 표',
      'List Table': '목록 표',
      Search: '검색',
      Replace: '바꾸기',
      'Replace All': '모두 바꾸기',
      'Find next': '다음 찾기',
      'Match case': '대소문자 구분',
      'Whole words': '전체 단어 일치',
      Apply: '적용',
      Close: '닫기',
    },
  },
});

// Register Syncfusion license key
const syncfusionLicenseKey = process.env.NEXT_PUBLIC_SYNCFUSION_LICENSE_KEY;
if (syncfusionLicenseKey) {
  registerLicense(syncfusionLicenseKey);
}

// Inject required modules
DocumentEditorContainerComponent.Inject(Toolbar);

export interface SyncfusionDocEditorRef {
  getText: () => string;
  getSelectionText: () => string;
  replaceSelection: (text: string) => Promise<void>;
  loadDocument: (sfdt: string) => void;
  getSfdt: () => string;
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
      if (!selection) {
        props.onSelectionChange('', '');
        return;
      }

      const isEmpty = selection.isEmpty ?? true;
      const selectedText = selection.text?.trim() || '';

      if (isEmpty || !selectedText) {
        props.onSelectionChange('', '');
        return;
      }

      const selectedHtml = `<p>${selectedText.replace(/\n/g, '<br>')}</p>`;
      props.onSelectionChange(selectedHtml, selectedText);
    }, [props.onSelectionChange]);

    const handleContentChange = useCallback(() => {
      const editor = containerRef.current?.documentEditor;
      if (!editor || !props.onContentChange) return;

      // @ts-ignore
      const fullText = editor.text || '';
      props.onContentChange(fullText);
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