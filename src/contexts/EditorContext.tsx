import React, { createContext, useContext, useRef, useState, ReactNode, RefObject } from 'react';
import { SyncfusionDocEditorRef } from '@/components/editor/SyncfusionDocEditor';

interface EditorContextValue {
  editorRef: RefObject<SyncfusionDocEditorRef>;
  documentId: string;
  title: string;
  setTitle: (t: string) => void;
  // 선택 영역 상태도 여기서 관리
  selectedHtml: string;
  selectedText: string;
  setSelection: (html: string, text: string) => void;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export function EditorProvider({ children, documentId }: { children: ReactNode; documentId: string }) {
  const editorRef = useRef<SyncfusionDocEditorRef>(null);
  const [title, setTitle] = useState('무제 문서');
  const [selection, setSelection] = useState({ html: '', text: '' });

  const setSelectionHandler = (html: string, text: string) => {
    setSelection({ html, text });
  };

  return (
    <EditorContext.Provider value={{ 
      editorRef, 
      documentId, 
      title, 
      setTitle,
      selectedHtml: selection.html,
      selectedText: selection.text,
      setSelection: setSelectionHandler
    }}>
      {children}
    </EditorContext.Provider>
  );
}

export const useEditor = () => {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditor must be used within EditorProvider');
  return ctx;
};