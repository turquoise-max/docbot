'use client';

import Link from 'next/link'
import { FileText, Upload, Plus, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
// import { parseDocxToRetainedHtml } from '@/lib/utils/document' // removed legacy parser

export default function HomePage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [isCreating, setIsCreating] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const handleCreateEmptyDocument = async () => {
    setIsCreating(true)
    try {
      const { data, error } = await supabase
        .from('documents')
        .insert({ title: '제목 없는 문서', content_html: '<h1>제목 없는 문서</h1><p><br/></p>', user_id: null })
        .select()
        .single()

      if (error || !data) {
        console.error('Failed to create document:', error)
        alert('문서 생성에 실패했습니다.')
        setIsCreating(false)
        return
      }

      router.push(`/editor/${data.id}`)
    } catch (error) {
      console.error('Error creating document:', error)
      alert('오류가 발생했습니다.')
      setIsCreating(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const title = file.name.replace(/\.docx$/i, '')

      // 1. Upload DOCX file to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}`
      const filePath = `documents/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('files') // assuming a bucket named 'files' exists
        .upload(filePath, file)

      if (uploadError) {
        console.error('Failed to upload file to storage:', uploadError)
        alert('파일 업로드에 실패했습니다.')
        return
      }

      // 2. Create document record in database with storage path
      const { data, error } = await supabase
        .from('documents')
        .insert({
            title,
            content_html: '', // Will be loaded from sfdt via Syncfusion
            file_path: filePath, // Requires adding file_path column to documents table
            user_id: null
        })
        .select()
        .single()

      if (error || !data) {
        console.error('Failed to create document record:', error)
        alert('문서 생성에 실패했습니다.')
        return
      }

      router.push(`/editor/${data.id}`)
    } catch (error) {
      console.error('Failed to process upload:', error)
      alert('업로드 처리 중 오류가 발생했습니다.')
    } finally {
      setIsUploading(false)
      // Reset input
      event.target.value = ''
    }
  }

  const officialTemplates = [
    { id: '1', title: '사업계획서', desc: '표준 사업계획서 양식' },
    { id: '2', title: '운영계획서', desc: '주간/월간 운영계획서 양식' },
    { id: '3', title: '회의록', desc: '공식 회의록 양식' },
    { id: '4', title: '제안서', desc: '프로젝트 제안서 양식' },
  ]

  return (
    <div className="max-w-5xl mx-auto p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">새 문서 시작</h1>
          <p className="text-gray-600">템플릿을 선택하거나 기존 DOCX 파일을 업로드하여 시작하세요.</p>
        </div>
        <button 
          onClick={handleCreateEmptyDocument}
          disabled={isCreating}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400"
        >
          {isCreating ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
          빈 문서로 시작
        </button>
      </div>

      <div className="mb-12">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 flex flex-col items-center justify-center text-center border-dashed cursor-pointer hover:bg-blue-100 transition-colors relative">
          {isUploading && (
            <div className="absolute inset-0 bg-white/80 rounded-xl flex flex-col items-center justify-center z-10 backdrop-blur-sm">
              <Loader2 className="animate-spin text-blue-600 mb-2" size={32} />
              <p className="text-blue-800 font-medium">문서 구조를 분석하고 서식을 추출하는 중입니다...</p>
            </div>
          )}
          <div className="bg-white p-3 rounded-full shadow-sm mb-4">
            <Upload className="text-blue-600" size={24} />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">커스텀 DOCX 파일 업로드</h3>
          <p className="text-sm text-gray-600 mb-4">
            사용하시던 워드 파일의 <span className="font-semibold text-blue-600">글꼴, 표, 여백 등 서식을 그대로 유지</span>하면서<br/>
            AI의 도움을 받아 문서를 편집할 수 있습니다.
          </p>
          <input 
            type="file" 
            accept=".docx" 
            className="hidden" 
            id="docx-upload" 
            onChange={handleFileUpload}
            disabled={isUploading}
          />
          <label htmlFor="docx-upload" className={`bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
            파일 선택하기
          </label>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">공식 템플릿</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {officialTemplates.map(template => (
            <Link key={template.id} href={`/editor?templateId=${template.id}`} className="block group">
              <div className="border rounded-xl p-6 h-full hover:border-blue-500 hover:shadow-md transition-all bg-white">
                <div className="bg-gray-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                  <FileText size={24} className="text-gray-500 group-hover:text-blue-600" />
                </div>
                <h3 className="font-bold text-gray-900 mb-1">{template.title}</h3>
                <p className="text-sm text-gray-500">{template.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}