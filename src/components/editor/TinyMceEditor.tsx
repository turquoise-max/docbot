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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      <div className="w-full h-full bg-gray-100 overflow-y-auto">
        <Editor
          apiKey={process.env.NEXT_PUBLIC_TINYMCE_API_KEY || ''}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
              'insertdatetime', 'media', 'table', 'code', 'help', 'wordcount', 'pagebreak'
            ],
            toolbar: 'undo redo | blocks | ' +
              'bold italic forecolor | alignleft aligncenter ' +
              'alignright alignjustify | bullist numlist outdent indent | ' +
              'removeformat | pagebreak | help',
            content_style: 'body { font-family:"Malgun Gothic", "맑은 고딕", sans-serif; font-size:14px; width: 210mm; min-height: 297mm; padding: 25.4mm; margin: 2rem auto; box-shadow: 0 4px 10px rgba(0,0,0,0.1); background-color: #ffffff; box-sizing: border-box; } .mce-pagebreak { cursor: default; display: block; border: 0; width: 100%; height: 5px; border-top: 2px dashed #ccc; margin-top: 15px; page-break-before: always; } html { background-color: #f0f0f0; }',
            language: 'ko_KR',
            // 다운로드 받은 한국어 언어팩을 public/langs/ko_KR.js 에 위치시키고 주석을 해제하세요.
            language_url: '/langs/ko_KR.js',
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