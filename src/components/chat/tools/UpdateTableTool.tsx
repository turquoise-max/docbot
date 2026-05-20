import { useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { useEditor } from '@/contexts/EditorContext'

export function UpdateTableTool({ 
  args, 
  toolCallId, 
  toolName,
  isCompleted,
  addToolResult
}: { 
  args: { targetKeyword?: string; tableData?: string[][] }
  toolCallId: string
  toolName: string
  isCompleted?: boolean;
  addToolResult: (options: { toolCallId: string; result: any }) => void
}) {
  const { editorRef } = useEditor()
  const [status, setStatus] = useState<'pending' | 'previewing' | 'applied' | 'rejected'>(isCompleted ? 'applied' : 'pending')
  const hasPreviewed = useRef(false)

  useEffect(() => {
    if (!args?.tableData || !args?.targetKeyword) return
    if (status === 'pending' && !hasPreviewed.current && editorRef?.current && !isCompleted) {
      hasPreviewed.current = true
      
      // SyncfusionDocEditor의 표 전용 함수 호출
      editorRef.current.updateTableData(args.targetKeyword, args.tableData)
        .then((success: boolean | void) => {
          if (success === false) {
            setStatus('rejected')
            addToolResult({
              toolCallId,
              result: '시스템 알림: 표를 찾지 못했습니다. 사용자에게 "수정하실 표를 직접 드래그한 후 다시 요청해주세요."라고 안내하세요.'
            })
          } else {
            setStatus('previewing')
          }
        })
    }
  }, [args, editorRef, status, toolCallId, toolName, addToolResult])

  if (!args?.tableData || !args?.targetKeyword) {
    return <div className="max-w-[85%] w-full p-4 bg-blue-50 border border-blue-100 rounded-lg animate-in slide-in-from-bottom-2 mt-2">
      <p className="text-sm font-medium text-blue-600 animate-pulse">표 데이터를 구성하는 중입니다...</p>
    </div>
  }

  if (status === 'applied') {
    return (
      <div className="max-w-[85%] w-full p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700 mt-2">
        <Check size={16} />
        <span className="text-sm font-medium">표 데이터가 적용되었습니다.</span>
      </div>
    )
  }

  if (status === 'rejected') {
    return (
      <div className="max-w-[85%] w-full p-3 bg-yellow-50 border border-yellow-200 rounded-lg mt-2">
        <p className="text-xs font-medium text-yellow-800">
          표를 찾지 못했습니다.
        </p>
        <p className="text-xs text-yellow-700 mt-1">
          수정하실 표를 직접 드래그로 선택한 후 
          같은 요청을 다시 해주세요.
        </p>
      </div>
    )
  }

  if (status === 'previewing') {
    return (
      <div className="max-w-[85%] w-full p-4 bg-blue-50 border border-blue-100 rounded-lg animate-in slide-in-from-bottom-2 mt-2">
        <p className="text-sm font-bold text-blue-700 mb-1">AI가 생성한 표 데이터를 적용할까요?</p>
        <p className="text-xs text-blue-600 mb-3">
          {args.tableData.length}행 × {args.tableData[0]?.length || 0}열 표가 에디터에 반영되었습니다. 변경 내용을 확인 후 수락하세요.
        </p>
        
        <div className="flex gap-2">
          <button 
            onClick={() => {
              if (editorRef?.current) editorRef.current.acceptPreview()
              setStatus('applied')
              addToolResult({ toolCallId, result: '사용자가 표 수정 사항을 수락했습니다.' })
            }}
          className="flex-1 flex items-center justify-center gap-1 bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Check size={16} /> 수락
        </button>
        <button 
          onClick={() => {
            if (editorRef?.current) editorRef.current.rejectPreview()
            setStatus('rejected')
            addToolResult({ toolCallId, result: '사용자가 표 수정 사항을 거절했습니다.' })
          }}
          className="flex-1 flex items-center justify-center gap-1 bg-white border border-gray-200 text-gray-600 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <X size={16} /> 거절
        </button>
      </div>
    </div>
    )
  }

  return null
}