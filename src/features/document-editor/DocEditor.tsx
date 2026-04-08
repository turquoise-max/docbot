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
  headerHtml?: string | { first?: string; default?: string };
  footerHtml?: string | { first?: string; default?: string };
  hasTitlePg?: boolean;
}

export const DocEditor = forwardRef<DocEditorRef, DocEditorProps>(
  ({ content, onChange, onSelection, margins, headerHtml, footerHtml, hasTitlePg }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef(content);
    const isInitialized = useRef(false);

    const saveSelection = (containerEl: HTMLElement) => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return null;
      const range = selection.getRangeAt(0);

      const getNodePath = (node: Node, container: HTMLElement) => {
        const path: number[] = [];
        let current = node;
        while (current && current !== container && current.parentNode) {
          let index = 0;
          let prev = current.previousSibling;
          while (prev) {
            index++;
            prev = prev.previousSibling;
          }
          path.unshift(index);
          current = current.parentNode;
        }
        return path;
      };

      return {
        startPath: getNodePath(range.startContainer, containerEl),
        startOffset: range.startOffset,
        endPath: getNodePath(range.endContainer, containerEl),
        endOffset: range.endOffset,
      };
    };

    const restoreSelection = (containerEl: HTMLElement, savedSel: any) => {
      if (!savedSel) return;

      const getNodeByPath = (container: HTMLElement, path: number[]) => {
        let current: Node = container;
        for (let i = 0; i < path.length; i++) {
          if (!current.childNodes || current.childNodes.length === 0) {
            return current;
          }
          const index = Math.min(path[i], current.childNodes.length - 1);
          current = current.childNodes[index];
        }
        return current;
      };

      try {
        const startNode = getNodeByPath(containerEl, savedSel.startPath);
        const endNode = getNodeByPath(containerEl, savedSel.endPath);

        const range = document.createRange();
        
        const getValidOffset = (node: Node, offset: number) => {
          if (node.nodeType === Node.TEXT_NODE) {
            return Math.min(offset, (node as Text).length);
          }
          return Math.min(offset, node.childNodes.length);
        };

        range.setStart(startNode, getValidOffset(startNode, savedSel.startOffset));
        range.setEnd(endNode, getValidOffset(endNode, savedSel.endOffset));

        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
          
          // Ensure the restored selection is visible
          if (range.startContainer && range.startContainer.parentElement) {
            range.startContainer.parentElement.scrollIntoView({ block: 'nearest' });
          }
        }
      } catch (e) {
        console.error('Failed to restore selection:', e);
      }
    };

    useEffect(() => {
      if (!editorRef.current) return;
      
      // 1. 최초 마운트 시 HTML 주입
      if (!isInitialized.current) {
        editorRef.current.innerHTML = content;
        isInitialized.current = true;
        contentRef.current = content;
        return;
      }

      // 2. 외부에서 content가 변경되었을 때 (AI 챗봇 적용 등)
      // 단, 현재 사용자가 에디터에 포커스(타이핑) 중일 때는 절대 덮어쓰지 않음
      if (editorRef.current.innerHTML !== content && document.activeElement !== editorRef.current) {
        editorRef.current.innerHTML = content;
        contentRef.current = content;
      }
    }, [content]);

    const calculatePageBreaks = () => {
      if (!editorRef.current) return;
      const editor = editorRef.current;
      
      // mm to px conversion (approximate for 96dpi)
      const mmToPx = (mmStr: string) => {
        const mm = parseFloat(mmStr.replace('mm', ''));
        return isNaN(mm) ? 0 : mm * 3.7795275591;
      };

      const topMargin = margins ? mmToPx(margins.top) : mmToPx('25.4mm');
      const bottomMargin = margins ? mmToPx(margins.bottom) : mmToPx('25.4mm');
      const PAGE_HEIGHT = 1122.52; // 297mm * 3.7795275591
      const GAP = 32; // gap-8 = 32px
      const EDITOR_TOP_PADDING = 32; // py-8 = 32px

      const isFocused = document.activeElement === editor;
      const savedSel = isFocused ? saveSelection(editor) : null;

      const children = Array.from(editor.children) as HTMLElement[];

      let layoutChanged = false;

      // Reset all previous push-down margins
      children.forEach(child => {
        if (child.dataset.pushDown) {
          child.style.marginTop = child.dataset.origMarginTop || '';
          delete child.dataset.pushDown;
          delete child.dataset.origMarginTop;
          layoutChanged = true;
        }
      });

      // Recalculate editor rect after reset
      const editorRect = editor.getBoundingClientRect();

      // 에디터의 상단 패딩(32px)을 절대 오프셋 계산에 반영
      let currentTopOffset = EDITOR_TOP_PADDING; // 누적 오차를 방지하기 위해 각 요소의 상대적 높이를 바탕으로 계산

      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        
        // 브라우저 렌더링 값 가져오기
        const rect = child.getBoundingClientRect();
        
        // 실제 요소의 높이 (마진 포함)
        const computedStyle = window.getComputedStyle(child);
        const marginTop = parseFloat(computedStyle.marginTop) || 0;
        const marginBottom = parseFloat(computedStyle.marginBottom) || 0;
        const childTotalHeight = rect.height + marginTop + marginBottom;
        
        // 현재 요소의 (가상 페이퍼 상) 절대 상단 위치 (마진 미포함, 실제 내용 시작점)
        // currentTopOffset은 이전 요소들까지의 누적 높이
        const absoluteTop = currentTopOffset + topMargin + marginTop;
        const absoluteBottom = absoluteTop + rect.height;

        const pageIndex = Math.floor(absoluteTop / (PAGE_HEIGHT + GAP));
        const pageStart = pageIndex * (PAGE_HEIGHT + GAP);
        const pageContentBottom = pageStart + PAGE_HEIGHT - bottomMargin;

        if (absoluteBottom > pageContentBottom && rect.height < (PAGE_HEIGHT - topMargin - bottomMargin)) {
          // Push down to next page
          const nextPageContentStart = (pageIndex + 1) * (PAGE_HEIGHT + GAP) + topMargin;
          const pushAmount = nextPageContentStart - absoluteTop;

          if (pushAmount > 0) {
             child.dataset.origMarginTop = child.style.marginTop || '';
             child.dataset.pushDown = 'true';

             child.style.marginTop = `${marginTop + pushAmount}px`;
             layoutChanged = true;
             
             // 다음 요소를 위한 오프셋 갱신 (pushAmount 만큼 추가됨)
             currentTopOffset += childTotalHeight + pushAmount;
             continue; // push 후에는 이 요소의 계산이 끝남
          }
        }
        
        currentTopOffset += childTotalHeight;
      }

      if (savedSel && layoutChanged) {
        // Only restore selection if the layout actually changed, to avoid unnecessary DOM updates that might disrupt typing
        setTimeout(() => {
             if (editorRef.current) {
                 restoreSelection(editorRef.current, savedSel);
             }
        }, 0);
      }
    };

    useEffect(() => {
      let timeoutId: NodeJS.Timeout;
      const observer = new MutationObserver(() => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          calculatePageBreaks();
        }, 300);
      });

      if (editorRef.current) {
        observer.observe(editorRef.current, {
          childList: true,
          subtree: true,
          characterData: true
        });
        calculatePageBreaks();
      }

      return () => {
        observer.disconnect();
        clearTimeout(timeoutId);
      };
    }, [margins]);

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
        onChange(editorRef.current.innerHTML);
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
          <PageLayout margins={margins} headerHtml={headerHtml as any} footerHtml={footerHtml as any} hasTitlePg={hasTitlePg}>
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning={true}
              onInput={handleInput}
              onMouseUp={handleSelect}
              onKeyUp={handleSelect}
              className="outline-none h-full w-full"
              style={{
                margin: 0,
                padding: 0,
                minHeight: '100%',
                 // Added baseline typography matching word defaults more closely
                 fontFamily: '"Malgun Gothic", "맑은 고딕", sans-serif',
                 fontSize: '11pt',
                 lineHeight: 'normal',
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