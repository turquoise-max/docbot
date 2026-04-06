'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useImperativeHandle, forwardRef } from 'react'
import { BlockId } from '@/features/tiptap-editor/extensions/BlockId'
import { AiPreview } from '@/features/tiptap-editor/extensions/AiPreview'

export interface TiptapEditorRef {
  getEditor: () => ReturnType<typeof useEditor>
}

interface TiptapEditorProps {
  content?: string
  onChange?: (content: string) => void
  onSelection?: (text: string, range: { from: number; to: number } | null) => void
}

const TiptapEditor = forwardRef<TiptapEditorRef, TiptapEditorProps>(({ content, onChange, onSelection }, ref) => {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      BlockId,
      AiPreview,
    ],
    content: content || '<p>문서 작성을 시작하세요...</p>',
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl focus:outline-none min-h-[500px] max-w-none p-4',
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML())
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection
      if (from === to) {
        onSelection?.('', null)
      } else {
        const selectedText = editor.state.doc.textBetween(from, to, ' ')
        onSelection?.(selectedText, { from, to })
      }
    },
  })

  // 외부에서 content가 변경될 때 반영 (예: AI 생성 결과)
  useEffect(() => {
    if (editor && content !== undefined && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  useImperativeHandle(ref, () => ({
    getEditor: () => editor
  }))

  return (
    <div className="w-full border rounded-lg bg-white shadow-sm overflow-y-auto">
      <EditorContent editor={editor} />
    </div>
  )
})

TiptapEditor.displayName = 'TiptapEditor'

export default TiptapEditor
