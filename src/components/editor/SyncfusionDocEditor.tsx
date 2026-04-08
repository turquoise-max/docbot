'use client';

import React, { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
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
  replaceSelection: (text: string) => void;
  loadDocument: (sfdt: string) => void;
}

interface SyncfusionDocEditorProps {
  // Add props if needed
}

const SyncfusionDocEditor = forwardRef<SyncfusionDocEditorRef, SyncfusionDocEditorProps>(
  (props, ref) => {
    const containerRef = useRef<DocumentEditorContainerComponent>(null);

    useImperativeHandle(ref, () => ({
      getText: () => {
        const editor = containerRef.current?.documentEditor;
        if (!editor) return '';
        // @ts-ignore
        return editor.text || '';
      },
      getSelectionText: () => {
        const editor = containerRef.current?.documentEditor;
        if (!editor) return '';
        return editor.selection.text;
      },
      replaceSelection: (text: string) => {
        const editor = containerRef.current?.documentEditor;
        if (!editor) return;
        // Insert text at the current selection
        editor.editor.insertText(text);
      },
      loadDocument: (sfdt: string) => {
         const editor = containerRef.current?.documentEditor;
         if (editor && sfdt) {
             editor.open(sfdt);
         }
      }
    }));

    return (
      <div className="w-full h-full">
        <DocumentEditorContainerComponent
          id="container"
          ref={containerRef}
          height={'100%'}
          width={'100%'}
          style={{ display: 'block' }}
          enableToolbar={true}
          locale="ko"
        />
      </div>
    );
  }
);

SyncfusionDocEditor.displayName = 'SyncfusionDocEditor';

export default SyncfusionDocEditor;