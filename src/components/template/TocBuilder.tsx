import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2 } from 'lucide-react';

export type TocItem = {
  id: string;
  level: 1 | 2 | 3;
  text: string;
};

interface TocBuilderProps {
  items: TocItem[];
  onChange: (items: TocItem[]) => void;
}

const SortableItem = ({ item, onDelete, onUpdate }: { item: TocItem, onDelete: (id: string) => void, onUpdate: (id: string, text: string) => void }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    marginLeft: `${(item.level - 1) * 2}rem`,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 bg-white p-2 border rounded mb-2 shadow-sm">
      <button {...attributes} {...listeners} className="cursor-grab text-gray-400 hover:text-gray-600">
        <GripVertical size={16} />
      </button>
      <div className="text-xs font-mono text-gray-500 w-8">{item.level === 1 ? 'H1' : item.level === 2 ? 'H2' : 'H3'}</div>
      <input
        type="text"
        value={item.text}
        onChange={(e) => onUpdate(item.id, e.target.value)}
        className="flex-1 border-none focus:ring-0 text-sm bg-transparent outline-none"
      />
      <button onClick={() => onDelete(item.id)} className="text-gray-400 hover:text-red-500">
        <Trash2 size={16} />
      </button>
    </div>
  );
};

export const TocBuilder: React.FC<TocBuilderProps> = ({ items, onChange }) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      onChange(arrayMove(items, oldIndex, newIndex));
    }
  };

  const handleDelete = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };

  const handleUpdate = (id: string, text: string) => {
    onChange(items.map((item) => (item.id === id ? { ...item, text } : item)));
  };

  const handleAdd = () => {
    const newItem: TocItem = {
      id: crypto.randomUUID(),
      level: 1,
      text: '새 항목',
    };
    onChange([...items, newItem]);
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4 bg-gray-50 rounded-lg border">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">목차 편집</h3>
        <button
          onClick={handleAdd}
          className="flex items-center gap-1 text-sm bg-blue-500 text-white px-3 py-1.5 rounded hover:bg-blue-600 transition-colors"
        >
          <Plus size={16} /> 추가
        </button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((item) => (
            <SortableItem key={item.id} item={item} onDelete={handleDelete} onUpdate={handleUpdate} />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
};