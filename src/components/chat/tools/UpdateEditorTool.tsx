import { useEffect, useRef, useState } from 'react'
import { Check, X, AlertCircle } from 'lucide-react'
import { useEditor } from '@/contexts/EditorContext'

export function UpdateEditorTool({ 
  args, 
  toolCallId, 
  toolName,
  addToolResult
}: { 
  args: { 
    modifiedHtml?: string;
    isDraftMode?: boolean;
  }
  toolCallId: string
  toolName: string
  addToolResult: (options: { toolCallId: string; result: any }) => void
}) {
  const { editorRef } = useEditor()
  const [status, setStatus] = useState<'pending' | 'applied' | 'rejected'>('pending')
  const hasPreviewed = useRef(false)

  useEffect(() => {
    if (!args?.modifiedHtml) return
    if (status === 'pending' && !hasPreviewed.current && editorRef?.current) {
      hasPreviewed.current = true
      
      if (args.isDraftMode) {
        console.log('[DEBUG-CHAT] isDraftMode 전체 내용 삽입');
        editorRef.current.replaceSelection(args.modifiedHtml)
          .then(() => {
            setStatus('applied');
            addToolResult({ toolCallId, result: '시스템 알림: 새 문서에 초안이 성공적으로 삽입되었습니다.' });
          });
      } else {
        // 단일 수정 - 프론트엔드 Selection 보존 방식
        editorRef.current.previewSelection(args.modifiedHtml)
          .then((success: boolean | void) => {
            if (success === false) {
              setStatus('rejected')
            }
          })
      }
    }
  }, [args, editorRef, status, toolCallId, toolName, addToolResult])

  if (!args?.modifiedHtml) {
    return <div className="max-w-[85%] w-full p-4 bg-blue-50 border border-blue-100 rounded-lg animate-in slide-in-from-bottom-2 mt-2">
      <p className="text-sm font-medium text-blue-600 animate-pulse">수정 내용을 생성하는 중입니다...</p>
    </div>
  }

  if (status === 'applied') {
    return (
      <div className="max-w-[85%] w-full p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700 mt-2">
        <Check size={16} />
        <span className="text-sm font-medium">수정 내용이 적용되었습니다.</span>
      </div>
    )
  }

  if (status === 'rejected') {
    return (
      <div className="max-w-[85%] w-full p-4 bg-yellow-50 border border-yellow-200 rounded-lg mt-2">
        <div className="flex items-center gap-2 text-yellow-800 mb-2">
          <AlertCircle size={16} />
          <p className="text-sm font-bold">수정할 위치를 찾지 못했습니다.</p>
        </div>
        <p className="text-xs text-yellow-700 mb-4 leading-relaxed">
          수정할 텍스트를 드래그로 선택 후 아래 버튼을 클릭하거나, 수정을 포기할 수 있습니다.
        </p>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              hasPreviewed.current = false
              setStatus('pending')
            }}
            className="flex-1 bg-yellow-600 text-white py-2 rounded-md text-xs font-medium hover:bg-yellow-700 transition-colors"
          >
            다시 시도
          </button>
          <button 
            onClick={() => {
              addToolResult({
                toolCallId,
                result: '시스템 알림: 텍스트를 찾지 못해 사용자가 수정을 포기했습니다.'
              })
            }}
            className="flex-1 bg-white border border-yellow-200 text-yellow-700 py-2 rounded-md text-xs font-medium hover:bg-yellow-50 transition-colors"
          >
            포기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[85%] w-full p-4 bg-blue-50 border border-blue-100 rounded-lg animate-in slide-in-from-bottom-2 mt-2">
      <p className="text-sm font-bold text-blue-700 mb-3">AI가 수정한 내용을 적용할까요?</p>
      <div className="flex gap-2">
        <button 
          onClick={() => {
            if (editorRef?.current) editorRef.current.acceptPreview()
            setStatus('applied')
            addToolResult({ toolCallId, result: '사용자가 수정 사항을 수락했습니다.' })
          }}
          className="flex-1 flex items-center justify-center gap-1 bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Check size={16} /> 수락
        </button>
        <button 
          onClick={() => {
            if (editorRef?.current) editorRef.current.rejectPreview()
            setStatus('rejected')
          }}
          className="flex-1 flex items-center justify-center gap-1 bg-white border border-gray-200 text-gray-600 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <X size={16} /> 거절
        </button>
      </div>
    </div>
  )
}