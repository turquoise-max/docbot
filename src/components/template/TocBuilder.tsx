'use client'

import React, { useState } from 'react'
import { Check, Plus, GripVertical, Trash2, Edit2, X } from 'lucide-react'

// ✨ 인터페이스에 templateHtml 추가
interface TocItem { 
  id: string; 
  level: number; 
  text: string; 
  templateHtml?: string; 
}

export default function TocBuilder({ 
  title: initialTitle, 
  items: initialItems, 
  recommendations, 
  onApply,
  onCancel
}: { 
  title: string, 
  items: TocItem[], 
  recommendations: {id: string, text: string}[],
  onApply: (finalHtml: string) => void,
  onCancel?: () => void
}) {
  const [items, setItems] = useState<TocItem[]>(initialItems);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 특정 항목 텍스트 변경
  const updateItemText = (id: string, newText: string) => {
    setItems(items.map(item => item.id === id ? { ...item, text: newText } : item));
  };

  // 항목 추가 (추천 항목에서 클릭 시)
  const addItem = (text: string) => {
    const newItem = { id: Math.random().toString(), level: 2, text };
    setItems([...items, newItem]);
  };

  // 항목 삭제
  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  // 드래그 앤 드롭 로직 (Native HTML5)
  const handleDragStart = (index: number) => setDraggedItemIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === index) return;
    const newItems = [...items];
    const draggedItem = newItems.splice(draggedItemIndex, 1)[0];
    newItems.splice(index, 0, draggedItem);
    setDraggedItemIndex(index);
    setItems(newItems);
  };

const handleApply = () => {
    const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    
    let html = `<div style="font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; line-height: 1.6; color: #111827;">\n`;
    
    // 문서 커버 템플릿 (이 부분은 문서의 공통 규격이므로 남겨두는 것을 권장합니다)
    html += `
      <div style="text-align: center; padding: 60pt 0; border-bottom: 2pt solid #1e3a8a; margin-bottom: 40pt;">
        <h1 style="font-size: 36pt; font-weight: bold; color: #1e3a8a; margin-bottom: 60pt;">${initialTitle}</h1>
        <table style="width: 280pt; margin: 0 auto; border-collapse: collapse; text-align: left;">
          <tr>
            <td style="padding: 6pt; color: #64748b; width: 80pt;">작성일자</td>
            <td style="padding: 6pt; font-weight: bold;">${today}</td>
          </tr>
          <tr>
            <td style="padding: 6pt; color: #64748b;">작성자</td>
            <td style="padding: 6pt; font-weight: bold;">[작성자명 입력]</td>
          </tr>
        </table>
      </div>
      <br style="page-break-after: always;" />\n`;

    items.forEach(item => {
        // 레벨별 제목 생성
        const headingStyle = item.level === 1 
          ? "font-size: 18pt; border-bottom: 2pt solid #1e40af; padding-bottom: 5pt;" 
          : "font-size: 14pt; border-left: 4pt solid #3b82f6; padding-left: 10pt;";
        
        html += `<h${item.level + 1} style="${headingStyle} margin-top: 30pt;">${item.text}</h${item.level + 1}>\n`;
        
        // ✨ AI가 판단해서 보낸 맞춤형 컨텐츠(표, 리스트 등)를 그대로 삽입
        html += item.templateHtml || `<p>[내용 없음]</p>`;
      });

      html += `</div>`;
      onApply(html);
    };

  return (
    <div className="bg-white border-2 border-blue-100 rounded-xl p-5 shadow-lg w-full animate-in fade-in zoom-in duration-300">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg text-blue-900">{initialTitle}</h3>
        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full font-bold">편집 모드</span>
      </div>

      {/* 목차 리스트 (드래그 가능 영역) */}
      <div className="space-y-2 mb-6">
        {items.map((item, index) => (
          <div 
            key={item.id}
            draggable={editingId !== item.id}
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            className={`flex items-center gap-2 p-2 bg-gray-50 rounded-md border border-transparent hover:border-blue-300 hover:bg-blue-50 transition-all group ${editingId !== item.id ? 'cursor-move' : ''}`}
            style={{ marginLeft: `${(item.level - 1) * 1.5}rem` }}
          >
            <GripVertical size={14} className="text-gray-400 group-hover:text-blue-400" />
            
            {editingId === item.id ? (
              <input
                type="text"
                value={item.text}
                onChange={(e) => updateItemText(item.id, e.target.value)}
                onBlur={() => setEditingId(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setEditingId(null);
                }}
                autoFocus
                className="flex-1 text-sm font-medium text-gray-700 bg-transparent outline-none border-b border-blue-300 px-1"
              />
            ) : (
              <span className="flex-1 text-sm font-medium text-gray-700">{item.text}</span>
            )}

            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
              <button onClick={() => setEditingId(item.id)} className="p-1 text-blue-400 hover:text-blue-600">
                <Edit2 size={14} />
              </button>
              <button onClick={() => removeItem(item.id)} className="p-1 text-red-400 hover:text-red-600">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 추천 항목 영역 */}
      <div className="border-t pt-4">
        <p className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-tight">문서 종류에 따른 추천 항목</p>
        <div className="flex flex-wrap gap-2 mb-6">
          {recommendations.map((rec) => (
            <button
              key={rec.id}
              onClick={() => addItem(rec.text)}
              className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-sm"
            >
              <Plus size={12} /> {rec.text}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <button
          onClick={handleApply}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-shadow shadow-md active:scale-[0.98]"
        >
          <Check size={18} /> 에디터에 적용하기
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="w-full flex items-center justify-center gap-1 bg-gray-100 text-gray-500 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            <X size={16} /> 건너뛰기
          </button>
        )}
      </div>
    </div>
  )
}
