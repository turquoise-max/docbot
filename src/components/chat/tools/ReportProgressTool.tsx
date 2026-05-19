import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ReportProgressTool({ 
  args, 
  isCompleted
}: { 
  args: { agent?: string; status?: string; details?: string }
  isCompleted?: boolean
}) {
  // 서버 사이드 도구(execute) 처리로 변경됨에 따라 클라이언트에서는 UI 렌더링 역할만 수행합니다.

  if (!args?.agent || !args?.status) return null;

  return (
    <div className="flex items-start gap-3 py-2 px-2 my-1 animate-in fade-in duration-300 self-start w-full">
      <div className="shrink-0 flex items-center justify-center mt-0.5">
        {isCompleted ? (
          <div className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
            <Check size={12} strokeWidth={3} />
          </div>
        ) : (
          <div className="w-5 h-5 text-blue-500 animate-spin flex items-center justify-center">
            <Loader2 size={16} strokeWidth={2.5} />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 w-full">
        <div className={cn("text-sm transition-colors duration-300", isCompleted ? "text-gray-500" : "text-gray-900 font-medium")}>
          <span className="font-bold mr-1.5 opacity-80">[{args.agent}]</span>
          <span>{args.status}</span>
        </div>
        {args.details && (
          <div className={cn(
            "text-[13px] mt-0.5 transition-colors duration-300 relative",
            isCompleted ? "text-gray-400" : "text-gray-600"
          )}>
            <div className="flex">
              <span className="mr-1.5 shrink-0">└</span>
              <span className={cn(
                "whitespace-pre-wrap break-words leading-relaxed",
                !isCompleted && "animate-pulse"
              )}>
                {args.details}
                {!isCompleted && <span className="ml-1 inline-block w-1.5 h-3 bg-blue-500 animate-ping rounded-sm align-middle" />}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}