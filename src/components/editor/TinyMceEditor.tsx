'use client'

import React, { forwardRef, useImperativeHandle, useRef } from 'react'
import { Editor } from '@tinymce/tinymce-react'

export interface TinyMceEditorRef {
  getHtml: () => string
  setHtml: (html: string) => void
  getSelectionHtml: () => string
  replaceSelectionHtml: (newHtml: string) => void
}

export interface TinyMceEditorProps {
  content: string
  onChange: (content: string) => void
  onSelection?: (html: string, text: string) => void
}

const TinyMceEditor = forwardRef<TinyMceEditorRef, TinyMceEditorProps>(
  ({ content, onChange, onSelection }, ref) => {
    const editorRef = useRef<any>(null)

    useImperativeHandle(ref, () => ({
      getHtml: () => {
        if (editorRef.current) {
          return editorRef.current.getContent()
        }
        return ''
      },
      setHtml: (html: string) => {
        if (editorRef.current) {
          editorRef.current.setContent(html)
        }
      },
      getSelectionHtml: () => {
        if (editorRef.current) {
          return editorRef.current.selection.getContent()
        }
        return ''
      },
      replaceSelectionHtml: (newHtml: string) => {
        if (editorRef.current) {
          editorRef.current.selection.setContent(newHtml)
        }
      }
    }))

    return (
      <div className="w-full h-full min-h-[842px] max-w-[595px] sm:max-w-[794px] mx-auto bg-white shadow-lg border border-gray-200">
        <Editor
          apiKey={process.env.NEXT_PUBLIC_TINYMCE_API_KEY || ''}
          onInit={(_evt: any, editor: any) => {
            editorRef.current = editor
          }}
          value={content}
          onEditorChange={(newContent: string) => {
            onChange(newContent)
          }}
          onSelectionChange={() => {
            if (onSelection && editorRef.current) {
              const selectedHtml = editorRef.current.selection.getContent()
              const selectedText = editorRef.current.selection.getContent({ format: 'text' })
              onSelection(selectedHtml, selectedText)
            }
          }}
          init={{
            height: '100%',
            menubar: true,
            plugins: [
              'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
              'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
              'insertdatetime', 'media', 'table', 'code', 'help', 'wordcount'
            ],
            toolbar: 'undo redo | blocks | ' +
              'bold italic forecolor | alignleft aligncenter ' +
              'alignright alignjustify | bullist numlist outdent indent | ' +
              'removeformat | help',
            content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px; margin: 1rem; }',
            resize: false,
            statusbar: false,
          }}
        />
      </div>
    )
  }
)

TinyMceEditor.displayName = 'TinyMceEditor'

export default TinyMceEditor