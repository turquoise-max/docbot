import React, { ReactNode } from 'react';

interface PageLayoutProps {
  children: ReactNode;
  margins?: { top: string; right: string; bottom: string; left: string };
  headerHtml?: string | { first?: string; default?: string };
  footerHtml?: string | { first?: string; default?: string };
  hasTitlePg?: boolean;
}

import { useEffect, useRef, useState } from 'react';

export function PageLayout({ children, margins, headerHtml, footerHtml, hasTitlePg }: PageLayoutProps) {
  const defaultMargins = { top: '25.4mm', right: '25.4mm', bottom: '25.4mm', left: '25.4mm' };
  const currentMargins = margins || defaultMargins;
  const contentRef = useRef<HTMLDivElement>(null);
  const [pageCount, setPageCount] = useState(1);

  useEffect(() => {
    const updatePageCount = () => {
      if (contentRef.current) {
        // Calculate page count based on scrollHeight of the content.
        // A4 height is roughly 1122px (297mm at 96dpi).
        // To be safe and responsive to actual rendering, we use mm directly in CSS
        // but need px for JS calculations. We can create a hidden ruler element or estimate.
        // 297mm * 3.7795275591 px/mm ≈ 1122.52px
        const A4_HEIGHT_PX = 1122.52; 
        const height = contentRef.current.scrollHeight;
        const newPageCount = Math.max(1, Math.ceil(height / A4_HEIGHT_PX));
        if (newPageCount !== pageCount) {
          setPageCount(newPageCount);
        }
      }
    };

    updatePageCount();
    
    // Setup ResizeObserver to detect changes in content height dynamically
    const resizeObserver = new ResizeObserver(() => {
      updatePageCount();
    });

    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
      // Also observe children to catch internal changes quickly
      Array.from(contentRef.current.children).forEach(child => resizeObserver.observe(child));
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [pageCount]);

  const pages = Array.from({ length: pageCount }, (_, i) => i);

  return (
    <div className="flex flex-col items-center bg-[#F8F9FA] min-h-full py-8 gap-8 relative">
      {/* Background Pages Layer */}
      {/* py-8 = 32px top, gap-8 = 32px between pages */}
      <div className="absolute top-8 left-0 right-0 flex flex-col items-center gap-8 pointer-events-none">
        {pages.map((pageIndex) => (
          <div
            key={`page-bg-${pageIndex}`}
            className="bg-white relative flex flex-col"
            style={{
              width: '210mm',
              height: '297mm', // Fixed height for each A4 paper
              boxSizing: 'border-box',
              boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
            }}
          >
            {/* Header */}
            {(() => {
                let htmlToRender: string | null = null;
                if (typeof headerHtml === 'string') {
                    try {
                        const headerData = JSON.parse(headerHtml);
                        if (headerData && typeof headerData === 'object') {
                            if (pageIndex === 0 && hasTitlePg) {
                                htmlToRender = headerData.first || '';
                            } else {
                                htmlToRender = headerData.default || '';
                            }
                        } else {
                            htmlToRender = headerHtml;
                        }
                    } catch (e) {
                        htmlToRender = headerHtml;
                    }
                } else if (headerHtml) {
                    if (pageIndex === 0 && hasTitlePg) {
                        htmlToRender = headerHtml.first !== undefined ? headerHtml.first : '';
                    } else {
                        htmlToRender = headerHtml.default || '';
                    }
                }

                if (htmlToRender === null || htmlToRender === undefined || htmlToRender === '') return null;

                htmlToRender = htmlToRender.replace(/{{PAGE_NUMBER}}/g, String(pageIndex + 1));

                return (
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            paddingTop: '12.7mm',
                            paddingRight: currentMargins.right,
                            paddingLeft: currentMargins.left,
                            color: '#666',
                            fontSize: '9pt',
                            height: currentMargins.top,
                            boxSizing: 'border-box',
                            overflow: 'hidden',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'flex-start'
                            }}
                        >
                          <div dangerouslySetInnerHTML={{ __html: htmlToRender }} className="[&>p]:w-full [&>p]:m-0 [&>p]:min-h-[1em] [&>p]:leading-[1.15] [&>div]:w-full [&>div]:m-0 [&>div]:min-h-[1em]" />
                        </div>
                );
            })()}

            {/* Footer */}
            {(() => {
                let htmlToRender: string | null = null;
                if (typeof footerHtml === 'string') {
                    try {
                        const footerData = JSON.parse(footerHtml);
                        if (footerData && typeof footerData === 'object') {
                            if (pageIndex === 0 && hasTitlePg) {
                                htmlToRender = footerData.first || '';
                            } else {
                                htmlToRender = footerData.default || '';
                            }
                        } else {
                            htmlToRender = footerHtml;
                        }
                    } catch (e) {
                        htmlToRender = footerHtml;
                    }
                } else if (footerHtml) {
                    if (pageIndex === 0 && hasTitlePg) {
                        htmlToRender = footerHtml.first !== undefined ? footerHtml.first : '';
                    } else {
                        htmlToRender = footerHtml.default || '';
                    }
                }

                if (htmlToRender === null || htmlToRender === undefined || htmlToRender === '') return null;

                htmlToRender = htmlToRender.replace(/{{PAGE_NUMBER}}/g, String(pageIndex + 1));

                return (
                    <div
                        style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            paddingBottom: '12.7mm',
                            paddingRight: currentMargins.right,
                            paddingLeft: currentMargins.left,
                            color: '#666',
                            fontSize: '9pt',
                            minHeight: currentMargins.bottom,
                            boxSizing: 'border-box',
                            overflow: 'visible',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'flex-start'
                        }}
                    >
                       <div dangerouslySetInnerHTML={{ __html: htmlToRender }} className="[&>p]:w-full [&>p]:!m-0 [&>p]:min-h-[1em] [&>p]:!leading-[1.15] [&>div]:w-full [&>div]:!m-0 [&>div]:min-h-[1em]" />
                    </div>
                );
            })()}
          </div>
        ))}
      </div>

      {/* Foreground Content Layer */}
      <div
        ref={contentRef}
        className="relative z-10 [&_p]:!m-0 [&_p]:!leading-[1.15]"
        style={{
          width: '210mm',
          minHeight: '297mm',
          boxSizing: 'border-box',
          fontFamily: '"Malgun Gothic", "맑은 고딕", sans-serif',
          fontSize: '11pt',
          lineHeight: 1.15,
          paddingTop: currentMargins.top,
          paddingRight: currentMargins.right,
          paddingBottom: currentMargins.bottom,
          paddingLeft: currentMargins.left,
          outline: 'none',
          // Transparent background so we can see the paper backgrounds underneath
          backgroundColor: 'transparent',
        }}
      >
          {children}
      </div>
    </div>
  );
}
