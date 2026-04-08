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
}

export const DocEditor = forwardRef<DocEditorRef, DocEditorProps>(
  ({ content, onChange, onSelection, margins, headerHtml, footerHtml }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef(content);
    const initialContent = useRef(content);

    const saveSelection = (containerEl: HTMLElement) => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return null;
      const range = selection.getRangeAt(0);
      const preSelectionRange = range.cloneRange();
      preSelectionRange.selectNodeContents(containerEl);
      preSelectionRange.setEnd(range.startContainer, range.startOffset);
      const start = preSelectionRange.toString().length;

      return {
        start,
        end: start + range.toString().length
      };
    };

    const restoreSelection = (containerEl: HTMLElement, savedSel: any) => {
      if (!savedSel) return;
      let charIndex = 0, range = document.createRange();
      range.setStart(containerEl, 0);
      range.collapse(true);
      let nodeStack: Node[] = [containerEl], node, foundStart = false, stop = false;

      while (!stop && (node = nodeStack.pop())) {
        if (node.nodeType === 3) {
          const textNode = node as Text;
          const nextCharIndex = charIndex + textNode.length;
          if (!foundStart && savedSel.start >= charIndex && savedSel.start <= nextCharIndex) {
            range.setStart(textNode, savedSel.start - charIndex);
            foundStart = true;
          }
          if (foundStart && savedSel.end >= charIndex && savedSel.end <= nextCharIndex) {
            range.setEnd(textNode, savedSel.end - charIndex);
            stop = true;
          }
          charIndex = nextCharIndex;
        } else {
          let i = node.childNodes.length;
          while (i--) {
            nodeStack.push(node.childNodes[i]);
          }
        }
      }

      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
        
        // Ensure the restored selection is visible
        if (range.startContainer && range.startContainer.parentElement) {
          range.startContainer.parentElement.scrollIntoView({ block: 'nearest' });
        }
      }
    };

    const isTypingRef = useRef(false);

    useEffect(() => {
      if (editorRef.current && content !== contentRef.current) {
        // If the user is currently typing in the editor, NEVER overwrite innerHTML
        // as this will destroy the browser's native caret and node references.
        if (isTypingRef.current) {
            contentRef.current = content;
            return;
        }

        // Only update if it's actually different
        if (editorRef.current.innerHTML !== content) {
          const isFocused = document.activeElement === editorRef.current;
          const savedSel = isFocused ? saveSelection(editorRef.current) : null;
          
          editorRef.current.innerHTML = content;
          
          if (savedSel && isFocused) {
            setTimeout(() => {
                if (editorRef.current) {
                    restoreSelection(editorRef.current, savedSel);
                }
            }, 0);
          }
        }
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
      const PAGE_HEIGHT = 1122.5; // 297mm
      const GAP = 32; // gap-8 = 32px

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

      // Calculate absolute positions using getBoundingClientRect to ensure accuracy relative to the editor
      const editorRect = editor.getBoundingClientRect();
      
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const rect = child.getBoundingClientRect();
        
        // Calculate position relative to the top of the editor content area
        const childTop = rect.top - editorRect.top; 
        const childHeight = rect.height;
        // absoluteTop represents the position on the virtual paper including top margin
        const absoluteTop = childTop + topMargin;
        const absoluteBottom = absoluteTop + childHeight;

        // Determine which page this element starts on
        const pageIndex = Math.floor(absoluteTop / (PAGE_HEIGHT + GAP));
        
        const pageStart = pageIndex * (PAGE_HEIGHT + GAP);
        const pageContentBottom = pageStart + PAGE_HEIGHT - bottomMargin;
        
        // If element overlaps bottom margin (침범 방지)
        if (absoluteBottom > pageContentBottom && childHeight < (PAGE_HEIGHT - topMargin - bottomMargin)) {
          // Push down to the next page's content start area
          const nextPageContentStart = (pageIndex + 1) * (PAGE_HEIGHT + GAP) + topMargin;
          
          const pushAmount = Math.max(0, nextPageContentStart - absoluteTop);
          
          if (pushAmount > 0) {
             const currentMarginTop = window.getComputedStyle(child).marginTop;
             child.dataset.origMarginTop = child.style.marginTop || '';
             child.dataset.pushDown = 'true';
             
             const currentMarginTopPx = parseFloat(currentMarginTop) || 0;
             child.style.marginTop = `${currentMarginTopPx + pushAmount}px`;
             layoutChanged = true;
             
             // After changing layout, we must recount editorRect as things may shift
             // Actually, getBoundingClientRect on subsequent elements will reflect the push naturally on next iteration
          }
        }
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
        }, 300); // Debounce to prevent lag
      });

      if (editorRef.current) {
        observer.observe(editorRef.current, {
          childList: true,
          subtree: true,
          characterData: true
        });
        // Initial calculation
        setTimeout(calculatePageBreaks, 100);
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
        isTypingRef.current = true;
        const newHtml = editorRef.current.innerHTML;
        contentRef.current = newHtml;
        onChange(newHtml);
        
        // Reset typing flag after a short delay so external updates can apply if they aren't from typing
        setTimeout(() => {
          isTypingRef.current = false;
        }, 100);
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
          <PageLayout margins={margins} headerHtml={headerHtml as any} footerHtml={footerHtml as any}>
            <div
              ref={editorRef}
              contentEditable
              onInput={handleInput}
              onMouseUp={handleSelect}
              onKeyUp={handleSelect}
              dangerouslySetInnerHTML={{ __html: initialContent.current }}
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