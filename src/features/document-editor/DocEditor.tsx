'use client';

import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { PageLayout } from './PageLayout';
import { Toolbar } from './Toolbar';

export interface DocEditorRef {
  getHtml: () => string;
  setHtml: (html: string) => void;
  getSelectionHtml: () => string;
  replaceSelectionHtml: (newHtml: string) => void;
}

export interface DocEditorProps {
  content: string;
  onChange: (content: string) => void;
  onSelection?: (html: string, text: string) => void;
  margins?: { top: string; right: string; bottom: string; left: string };
  headerHtml?: string;
  footerHtml?: string;
}

export const DocEditor = forwardRef<DocEditorRef, DocEditorProps>(
  ({ content, onChange, onSelection, margins, headerHtml, footerHtml }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef(content);

    useEffect(() => {
      if (editorRef.current && content !== contentRef.current) {
        editorRef.current.innerHTML = content;
        contentRef.current = content;
      }
    }, [content]);

    useImperativeHandle(ref, () => ({
      getHtml: () => {
        return editorRef.current?.innerHTML || '';
      },
      setHtml: (html: string) => {
        if (editorRef.current) {
          editorRef.current.innerHTML = html;
          contentRef.current = html;
          onChange(html);
        }
      },
      getSelectionHtml: () => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return '';
        const div = document.createElement('div');
        div.appendChild(selection.getRangeAt(0).cloneContents());
        return div.innerHTML;
      },
      replaceSelectionHtml: (newHtml: string) => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const el = document.createElement('div');
        el.innerHTML = newHtml;
        const frag = document.createDocumentFragment();
        let node, lastNode;
        while ((node = el.firstChild)) {
          lastNode = frag.appendChild(node);
        }
        range.insertNode(frag);
        if (lastNode) {
          range.setStartAfter(lastNode);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        }
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
      }
    }));

    const handleInput = () => {
      if (editorRef.current) {
        const newHtml = editorRef.current.innerHTML;
        contentRef.current = newHtml;
        onChange(newHtml);
      }
    };

    const handleSelect = () => {
      if (onSelection && editorRef.current) {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
          const div = document.createElement('div');
          div.appendChild(selection.getRangeAt(0).cloneContents());
          onSelection(div.innerHTML, selection.toString());
        } else {
            onSelection('', '');
        }
      }
    };

    return (
      <div className="flex flex-col h-full w-full bg-[#f0f0f0]">
        <Toolbar />
        <div className="flex-1 overflow-y-auto">
          <PageLayout margins={margins} headerHtml={headerHtml} footerHtml={footerHtml}>
            <div
              ref={editorRef}
              contentEditable
              onInput={handleInput}
              onMouseUp={handleSelect}
              onKeyUp={handleSelect}
              dangerouslySetInnerHTML={{ __html: content }}
              className="outline-none h-full w-full"
              style={{
                margin: 0,
                padding: 0,
                minHeight: '100%',
                // Added baseline typography matching word defaults more closely
                fontFamily: '"Malgun Gothic", "맑은 고딕", sans-serif',
                fontSize: '11pt',
                lineHeight: '1.6', // Improved readability matching Google Docs
                color: '#000000'
              }}
            />
          </PageLayout>
        </div>
      </div>
    );
  }
);

DocEditor.displayName = 'DocEditor';