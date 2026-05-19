import { useState, useMemo } from 'react'
import { Check, Bot, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export function AskClarificationWizard({
  args,
  toolCallId,
  addToolResult,
  append,
  editorContext,
  selectedHtml,
  selectedText,
}: {
  args: {
    questions?: {
      question: string;
      options: { label: string; value: string }[];
      allowMultiple?: boolean;
    }[];
    // 하위 호환성 (단일 질문)
    question?: string;
    options?: { label: string; value: string }[];
    allowMultiple?: boolean;
  };
  toolCallId: string;
  addToolResult: (options: { toolCallId: string; result: any }) => void;
  append?: any;
  editorContext: string;
  selectedHtml: string | null;
  selectedText: string;
}) {
  const questions = useMemo(() => {
    if (args.questions && args.questions.length > 0) return args.questions;
    if (args.question && args.options) {
      return [{ question: args.question, options: args.options, allowMultiple: args.allowMultiple }];
    }
    return [];
  }, [args]);

  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string[]>>({});
  const [customInput, setCustomInput] = useState('');

  if (questions.length === 0) return null;

  const currentQ = questions[currentStep];
  const isMultiple = currentQ.allowMultiple;
  const currentAnswers = answers[currentStep] || [];
  const isLastStep = currentStep === questions.length - 1;

  const handleToggleOption = (value: string) => {
    if (isMultiple) {
      setAnswers(prev => {
        const selected = prev[currentStep] || [];
        if (selected.includes(value)) {
          return { ...prev, [currentStep]: selected.filter(v => v !== value) };
        } else {
          return { ...prev, [currentStep]: [...selected, value] };
        }
      });
    } else {
      setAnswers(prev => ({ ...prev, [currentStep]: [value] }));
    }
  };

  const handleNextOrSubmit = (immediateValue?: string) => {
    const finalSelection = immediateValue 
      ? [immediateValue] 
      : customInput.trim() 
        ? [...currentAnswers, customInput.trim()] 
        : currentAnswers;

    const newAnswers = { ...answers, [currentStep]: finalSelection };
    setAnswers(newAnswers);
    setCustomInput('');

    if (isLastStep) {
      // 1. 도구를 명시적으로 종료 처리 (위저드를 완전히 닫고 대기 상태 해제)
      let displayMessageText = '';
      
      questions.forEach((q, idx) => {
        const ans = newAnswers[idx] || [];
        const labels = ans.map(val => {
          const option = q.options?.find(o => o.value === val);
          return option ? option.label : val;
        });
        displayMessageText += `[질문] ${q.question}\n- ${labels.join(', ')}\n\n`;
      });

      addToolResult({
        toolCallId,
        result: '유저가 폼 응답을 완료하고 일반 메시지로 전송했습니다.'
      });

      // 2. 도구가 상태에 반영될 시간을 잠깐 주고, 진짜 유저 메시지를 전송하여 기획 트리거
      if (append) {
        setTimeout(() => {
          append(
            { role: 'user', parts: [{ type: 'text', text: displayMessageText.trim() }] }, 
            { body: { editorContext, selectedHtml, selectedText } }
          );
        }, 100);
      }

    } else {
      // 다음 스텝
      setCurrentStep(prev => prev + 1);
    }
  };

  return (
    <div className="px-4 pb-4 flex flex-col gap-3 animate-in slide-in-from-bottom-2 fade-in">
      <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 shadow-sm w-full relative">
        {questions.length > 1 && (
          <div className="absolute top-4 right-4 flex items-center gap-0.5 bg-white border border-blue-100 rounded-full px-1 py-0.5 shadow-sm">
            <button 
              onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
              disabled={currentStep === 0}
              className="p-1 rounded-full text-blue-500 hover:bg-blue-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs font-bold text-blue-700 px-1">
              {currentStep + 1} / {questions.length}
            </span>
            <button 
              onClick={() => handleNextOrSubmit()}
              disabled={currentAnswers.length === 0 && !customInput.trim()}
              className="p-1 rounded-full text-blue-500 hover:bg-blue-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
        
        <div className="flex items-center gap-2 mb-3 pr-24">
          <div className="bg-blue-100 p-1.5 rounded-full text-blue-700">
            <Bot size={16} />
          </div>
          <span className="text-sm font-semibold text-blue-900">
            {isMultiple ? '복수 선택 가능' : '추가 정보가 필요합니다'}
          </span>
        </div>
        
        <p className="text-sm text-blue-800 font-medium mb-4 ml-1">
          {currentQ.question}
        </p>
        
        <div className="flex flex-col gap-2">
          {currentQ.options?.map((opt, i) => {
            const isSelected = currentAnswers.includes(opt.value);
            return (
              <button
                key={i}
                onClick={() => {
                  if (isMultiple) {
                    handleToggleOption(opt.value);
                  } else {
                    handleNextOrSubmit(opt.value);
                  }
                }}
                className={cn(
                  "w-full text-left px-4 py-3 bg-white text-sm font-medium rounded-lg border transition-all shadow-sm active:scale-[0.99]",
                  isSelected 
                    ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-200" 
                    : "border-blue-100 text-blue-700 hover:border-blue-300 hover:shadow"
                )}
              >
                <div className="flex items-center justify-between">
                  <span>{opt.label}</span>
                  {isMultiple && (
                    <div className={cn("w-4 h-4 rounded border flex items-center justify-center", isSelected ? "bg-blue-500 border-blue-500 text-white" : "border-gray-300")}>
                      {isSelected && <Check size={12} strokeWidth={3} />}
                    </div>
                  )}
                  {!isMultiple && <span className="text-blue-300">→</span>}
                </div>
              </button>
            );
          })}
          
          {/* 직접 입력란 */}
          <div className="relative mt-1">
            <input 
              type="text"
              placeholder="기타 (직접 입력)"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customInput.trim()) {
                  e.preventDefault();
                  handleNextOrSubmit();
                }
              }}
              className="w-full pl-4 pr-12 py-3 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all shadow-sm"
            />
            {!isMultiple && (
              <button 
                onClick={() => handleNextOrSubmit()}
                disabled={!customInput.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-md font-bold transition-colors disabled:text-gray-300 text-blue-600 hover:bg-blue-50 disabled:hover:bg-transparent"
              >
                →
              </button>
            )}
          </div>
        </div>

        {/* 다중 선택 시에만 하단 완료 버튼 제공 */}
        {isMultiple && (
          <div className="mt-4 pt-3 border-t border-blue-100/50 flex justify-end">
            <button
              onClick={() => handleNextOrSubmit()}
              disabled={currentAnswers.length === 0 && !customInput.trim()}
              className="flex items-center gap-1.5 text-sm font-bold px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors shadow-sm"
            >
              {isLastStep ? <><Check size={16}/> 선택 완료</> : '다음 단계 →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}