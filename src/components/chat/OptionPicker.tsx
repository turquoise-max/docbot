import React, { useState } from 'react';

interface Option {
  label: string;
  value: string;
}

interface OptionPickerProps {
  question: string;
  options: Option[];
  allowMultiple?: boolean;
  onSelect: (value: string) => void;
  onCancel?: () => void;
}

import { X } from 'lucide-react';

export const OptionPicker: React.FC<OptionPickerProps> = ({ question, options, allowMultiple, onSelect, onCancel }) => {
  const [selected, setSelected] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  if (!question || !options || !Array.isArray(options)) {
    return (
      <div className="flex flex-col gap-3 my-4 p-4 border rounded-xl bg-blue-50 border-blue-100 shadow-sm">
        <div className="text-sm font-medium text-blue-600 animate-pulse">AI가 질문을 구성하는 중입니다...</div>
      </div>
    );
  }

  const handleClick = (value: string) => {
    if (submitted) return;

    if (allowMultiple) {
      const newSelected = selected.includes(value)
        ? selected.filter(v => v !== value)
        : [...selected, value];
      setSelected(newSelected);
    } else {
      setSelected([value]);
      setSubmitted(true);
      onSelect(value);
    }
  };

  const handleMultipleSubmit = () => {
    if (submitted) return;
    setSubmitted(true);
    // JSON 문자열로 묶어서 하나의 텍스트로 보냅니다.
    onSelect(JSON.stringify(selected));
  };

  return (
    <div className="flex flex-col gap-3 my-4 p-4 border rounded-xl bg-white shadow-sm border-gray-200">
      <div className="font-medium text-gray-800">{question}</div>
      <div className="flex flex-col gap-2">
        {options.map((opt, i) => {
          const isSelected = selected.includes(opt.value);
          return (
            <button
              key={i}
              disabled={submitted && (!allowMultiple || (allowMultiple && isSelected))}
              onClick={() => handleClick(opt.value)}
              className={`text-left px-4 py-2 border rounded-lg transition-colors duration-200 ${
                isSelected 
                  ? 'bg-blue-50 border-blue-500 text-blue-700' 
                  : 'bg-white border-gray-200 hover:border-blue-500 text-gray-700'
              } ${submitted ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {allowMultiple && !submitted && (
        <button
          onClick={handleMultipleSubmit}
          disabled={selected.length === 0}
          className="mt-2 w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          선택 완료
        </button>
      )}
      {!submitted && onCancel && (
        <button
          onClick={() => {
            setSubmitted(true);
            onCancel();
          }}
          className="mt-2 w-full flex items-center justify-center gap-1 py-2 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
        >
          <X size={16} /> 건너뛰기
        </button>
      )}
    </div>
  );
};
