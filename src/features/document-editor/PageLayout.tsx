import React, { ReactNode } from 'react';

interface PageLayoutProps {
  children: ReactNode;
  margins?: { top: string; right: string; bottom: string; left: string };
  headerHtml?: string;
  footerHtml?: string;
}

export function PageLayout({ children, margins, headerHtml, footerHtml }: PageLayoutProps) {
  const defaultMargins = { top: '25.4mm', right: '25.4mm', bottom: '25.4mm', left: '25.4mm' };
  const currentMargins = margins || defaultMargins;

  return (
    <div className="flex flex-col items-center bg-[#F8F9FA] min-h-full py-8 gap-8">
      <div
        className="bg-white relative flex flex-col"
        style={{
          width: '210mm',
          minHeight: '297mm',
          boxSizing: 'border-box',
          fontFamily: '"Malgun Gothic", "맑은 고딕", sans-serif',
          fontSize: '11pt',
          lineHeight: '1.6',
          boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
          margin: '0 auto',
        }}
      >
        {/* Header - Fixed at the top of the page boundaries */}
        {headerHtml && (
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    paddingTop: '12.7mm', // Standard header distance from edge
                    paddingRight: currentMargins.right,
                    paddingLeft: currentMargins.left,
                    color: '#666',
                    fontSize: '9pt',
                    height: currentMargins.top, // Header occupies the top margin space
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-start'
                }}
            >
              {/* Added div wrapper to handle flex layouts within parsed HTML */}
              <div dangerouslySetInnerHTML={{ __html: headerHtml }} className="[&>p]:flex [&>p]:justify-between [&>p]:w-full [&>p]:m-0" />
            </div>
        )}

        {/* Content Body - Respects all margins */}
        <div
            style={{
                flex: 1,
                paddingTop: currentMargins.top,
                paddingRight: currentMargins.right,
                paddingBottom: currentMargins.bottom,
                paddingLeft: currentMargins.left,
                boxSizing: 'border-box',
                outline: 'none',
            }}
        >
            {children}
        </div>

        {/* Footer - Fixed at the bottom of the page boundaries */}
        {footerHtml && (
            <div
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    paddingBottom: '12.7mm', // Standard footer distance from edge
                    paddingRight: currentMargins.right,
                    paddingLeft: currentMargins.left,
                    color: '#666',
                    fontSize: '9pt',
                    height: currentMargins.bottom, // Footer occupies the bottom margin space
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end'
                }}
            >
               {/* Added div wrapper to handle flex layouts within parsed HTML */}
               <div dangerouslySetInnerHTML={{ __html: footerHtml }} className="[&>p]:flex [&>p]:justify-between [&>p]:w-full [&>p]:m-0" />
            </div>
        )}
      </div>
    </div>
  );
}