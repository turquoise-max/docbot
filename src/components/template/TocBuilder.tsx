'use client'

import React, { useState, useMemo } from 'react'
import { Check, Plus, GripVertical, Trash2, Edit2, X } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  DragStartEvent,
  DragMoveEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export interface TocItem { 
  id: string; 
  level: number; 
  text: string; 
  templateHtml?: string; 
}

const INDENT_WIDTH = 24; // 1.5rem in pixels roughly

// Sortable Item Component
interface SortableTocItemProps {
  item: TocItem;
  depth: number;
  isEditing: boolean;
  onEdit: (id: string) => void;
  onUpdateText: (id: string, text: string) => void;
  onStopEdit: () => void;
  onRemove: (id: string) => void;
  isClone?: boolean;
  isGhost?: boolean;
}

function SortableTocItem({
  item,
  depth,
  isEditing,
  onEdit,
  onUpdateText,
  onStopEdit,
  onRemove,
  isClone,
  isGhost
}: SortableTocItemProps) {
  const {
    attributes,
    listeners,
    setDraggableNodeRef,
    setDroppableNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    marginLeft: `${(depth - 1) * 1.5}rem`,
    opacity: isGhost ? 0.3 : 1,
  };

  const wrapperClass = `flex items-center gap-2 p-2 bg-gray-50 rounded-md border border-transparent transition-colors group
    ${isClone ? 'shadow-xl bg-blue-50 border-blue-300' : 'hover:border-blue-300 hover:bg-blue-50'}
    ${isDragging && !isClone ? 'opacity-30' : ''}
  `;

  return (
    <div
      ref={setDroppableNodeRef}
      style={style}
      className={isGhost ? 'relative' : ''}
    >
      <div
        ref={setDraggableNodeRef}
        className={wrapperClass}
      >
        <div 
          {...attributes} 
          {...listeners} 
          className="cursor-move p-1 -m-1"
        >
          <GripVertical size={14} className="text-gray-400 group-hover:text-blue-400" />
        </div>
        
        {isEditing ? (
          <input
            type="text"
            value={item.text}
            onChange={(e) => onUpdateText(item.id, e.target.value)}
            onBlur={onStopEdit}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === 'Enter') onStopEdit();
            }}
            autoFocus
            className="flex-1 text-sm font-medium text-gray-700 bg-transparent outline-none border-b border-blue-300 px-1"
          />
        ) : (
          <span className="flex-1 text-sm font-medium text-gray-700">{item.text}</span>
        )}

        <div className={`flex items-center gap-1 ${isClone ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <button onClick={() => onEdit(item.id)} className="p-1 text-blue-400 hover:text-blue-600">
            <Edit2 size={14} />
          </button>
          <button onClick={() => onRemove(item.id)} className="p-1 text-red-400 hover:text-red-600">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newItemText, setNewItemText] = useState('');
  
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [offsetLeft, setOffsetLeft] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activeItem = useMemo(
    () => items.find((item) => item.id === activeId),
    [activeId, items]
  );

  const getProjectedDepth = () => {
    if (!activeId || !overId) return null;
    
    const activeIndex = items.findIndex((item) => item.id === activeId);
    const overIndex = items.findIndex((item) => item.id === overId);
    
    const activeItem = items[activeIndex];
    const newItems = arrayMove(items, activeIndex, overIndex);
    
    const previousItem = newItems[overIndex - 1];
    
    const dragDepth = Math.round(offsetLeft / INDENT_WIDTH);
    const projectedDepth = activeItem.level + dragDepth;
    
    const maxDepth = Math.min(3, previousItem ? previousItem.level + 1 : 1);
    const minDepth = 1;
    
    let depth = projectedDepth;
    if (depth > maxDepth) depth = maxDepth;
    if (depth < minDepth) depth = minDepth;
    
    return { depth, newIndex: overIndex };
  };

  const projectedInfo = getProjectedDepth();

  // 특정 항목 텍스트 변경
  const updateItemText = (id: string, newText: string) => {
    setItems(items.map(item => item.id === id ? { ...item, text: newText } : item));
  };

  // 항목 추가 (추천 항목에서 클릭 시)
  const addItem = (text: string) => {
    const newItem = { id: Math.random().toString(), level: 2, text };
    setItems([...items, newItem]);
  };

  const handleAddCustomItem = () => {
    if (!newItemText.trim()) return;
    addItem(newItemText.trim());
    setNewItemText('');
  };

  // 항목 삭제
  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setOverId(event.active.id as string);
  };

  const handleDragMove = (event: DragMoveEvent) => {
    setOffsetLeft(event.delta.x);
    if (event.over?.id) {
      setOverId(event.over.id as string);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (event.over?.id) {
      setOverId(event.over.id as string);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (projectedInfo && over) {
      const { depth, newIndex } = projectedInfo;
      const activeIndex = items.findIndex((item) => item.id === active.id);
      
      const newItems = arrayMove(items, activeIndex, newIndex);
      newItems[newIndex] = { ...newItems[newIndex], level: depth };
      
      setItems(newItems);
    }
    
    setActiveId(null);
    setOverId(null);
    setOffsetLeft(0);
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setOverId(null);
    setOffsetLeft(0);
  };

const handleApply = () => {
    const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    
    let html = `<div style="font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; line-height: 1.6; color: #111827;">\n`;
    
    // 문서 커버 템플릿
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
      <div className="space-y-2 mb-4 relative">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
            {items.map((item) => {
              const isGhost = activeId === item.id;
              let depth = item.level;
              
              if (projectedInfo && activeId === item.id) {
                depth = projectedInfo.depth;
              }

              return (
                <SortableTocItem
                  key={item.id}
                  item={item}
                  depth={depth}
                  isEditing={editingId === item.id}
                  onEdit={setEditingId}
                  onUpdateText={updateItemText}
                  onStopEdit={() => setEditingId(null)}
                  onRemove={removeItem}
                  isGhost={isGhost}
                />
              );
            })}
          </SortableContext>

          {/* Indicator for projected drop location */}
          {projectedInfo && activeId && (
            <div
              className="absolute left-0 right-0 h-0.5 bg-blue-500 pointer-events-none transition-all duration-150 z-10"
              style={{
                top: `${projectedInfo.newIndex * 48}px`, // Approximate item height
                marginLeft: `${(projectedInfo.depth - 1) * 1.5}rem`,
                marginTop: projectedInfo.newIndex === 0 ? '-4px' : '44px',
              }}
            />
          )}

          <DragOverlay>
            {activeId && activeItem ? (
              <SortableTocItem
                item={activeItem}
                depth={projectedInfo?.depth ?? activeItem.level}
                isEditing={false}
                onEdit={() => {}}
                onUpdateText={() => {}}
                onStopEdit={() => {}}
                onRemove={() => {}}
                isClone
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* 사용자 직접 입력 폼 추가 */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === 'Enter') handleAddCustomItem();
          }}
          placeholder="새 목차 항목 직접 입력..."
          className="flex-1 text-sm font-medium text-gray-700 bg-white outline-none border border-gray-200 focus:border-blue-400 rounded-md px-3 py-2 transition-colors shadow-sm"
        />
        <button
          onClick={handleAddCustomItem}
          disabled={!newItemText.trim()}
          className="flex items-center gap-1 bg-blue-50 text-blue-600 px-3 py-2 rounded-md text-sm font-bold hover:bg-blue-100 disabled:opacity-50 transition-colors"
        >
          <Plus size={16} /> 추가
        </button>
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