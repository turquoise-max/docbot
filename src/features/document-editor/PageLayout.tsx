import React, { ReactNode } from 'react';

interface PageLayoutProps {
  children: ReactNode;
  margins?: { top: string; right: string; bottom: string; left: string };
}

export function PageLayout({ children, margins }: PageLayoutProps) {
  const defaultMargins = { top: '25.4mm', right: '25.4mm', bottom: '25.4mm', left: '25.4mm' };
  const currentMargins = margins || defaultMargins;

  return (
    <div className="flex flex-col items-center bg-[#f0f0f0] min-h-screen py-8 overflow-y-auto">
      <div 
        className="bg-white shadow-md relative"
        style={{
          width: '210mm',
          minHeight: '297mm',
          paddingTop: currentMargins.top,
          paddingRight: currentMargins.right,
          paddingBottom: currentMargins.bottom,
          paddingLeft: currentMargins.left,
          boxSizing: 'border-box',
          fontFamily: '"Malgun Gothic", "맑은 고딕", sans-serif',
          fontSize: '11pt',
          lineHeight: '1.5',
        }}
      >
        {children}
      </div>
    </div>
  );
}