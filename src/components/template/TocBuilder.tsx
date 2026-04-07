import React from 'react'
import { Check } from 'lucide-react'

interface TocItem {
  id: string
  level: number
  text: string
}

interface TocBuilderProps {
  title: string
  items: TocItem[]
  onApply: () => void
}

export default function TocBuilder({ title, items, onApply }: TocBuilderProps) {
  return (
    <div className="bg-white border rounded-lg p-4 mt-2 text-sm shadow-sm w-full">
      <h3 className="font-bold text-lg mb-3 text-gray-800">{title}</h3>
      <ul className="space-y-1 mb-4">
        {items?.map((item) => (
          <li
            key={item.id}
            className="text-gray-700"
            style={{ paddingLeft: `${(item.level - 1) * 1.5}rem` }}
          >
            • {item.text}
          </li>
        ))}
      </ul>
      <button
        onClick={onApply}
        className="w-full flex items-center justify-center gap-1 bg-blue-600 text-white py-2 rounded-md font-medium hover:bg-blue-700 transition-colors"
      >
        <Check size={16} /> 이 목차를 에디터에 적용하기
      </button>
    </div>
  )
}