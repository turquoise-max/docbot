'use client'

import React, { useState } from 'react'
import { Check, Plus, GripVertical, Trash2, Edit2 } from 'lucide-react'

interface TocItem { id: string; level: number; text: string }

export default function TocBuilder({ 
  title: initialTitle, 
  items: initialItems, 
  recommendations, 
  onApply 
}: { 
  title: string, 
  items: TocItem[], 
  recommendations: {id: string, text: string}[],
  onApply: (finalHtml: string) => void 
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
    // 서식을 적용한 HTML 생성 (에디터 반영용)
    let html = `<h1>${initialTitle}</h1>\n`;
    items.forEach(item => {
      const headingTag = item.level === 1 ? 'h2' : 'h3';
      const marginTop = item.level === 1 ? '24pt' : '16pt';
      html += `<${headingTag} style="margin-top: ${marginTop};">${item.text}</${headingTag}>\n`;
      html += `<p><span style="color: #9ca3af;">[내용을 입력하거나 AI에게 작성을 요청하세요]</span></p>\n`;
    });
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

      <button
        onClick={handleApply}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-shadow shadow-md active:scale-[0.98]"
      >
        <Check size={18} /> 에디터에 적용하기
      </button>
    </div>
  )
}