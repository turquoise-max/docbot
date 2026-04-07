'use client';

import Link from 'next/link'
import { FileText, Upload, Plus, Loader2, ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TocBuilder, TocItem } from '@/components/template/TocBuilder'
import { createClient } from '@/lib/supabase/client'
import { parseDocxToRetainedHtml } from '@/lib/utils/document'

type Mode = 'default' | 'prompt' | 'toc'

export default function TemplatesPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [mode, setMode] = useState<Mode>('default')
  const [promptInput, setPromptInput] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [tocData, setTocData] = useState<TocItem[]>([])
  const [docTitle, setDocTitle] = useState('')

  const handleGenerate = async () => {
    if (!promptInput.trim()) return
    setIsGenerating(true)
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptInput }),
      })
      const data = await res.json()
      if (data.toc) {
        setTocData(data.toc)
        setDocTitle(data.title || promptInput)
        setMode('toc')
      }
    } catch (error) {
      console.error('Failed to generate TOC:', error)
      alert('목차 생성에 실패했습니다.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCreateDocument = async () => {
    if (tocData.length === 0) return

    let contentHtml = `<h1>${docTitle || '제목 없는 문서'}</h1>\n`
    tocData.forEach((item) => {
      const tag = `h${item.level + 1}` // H1 is docTitle, so TOC H1 -> H2, etc.
      contentHtml += `<${tag}>${item.text}</${tag}>\n<p></p>\n`
    })

    const { data, error } = await supabase
      .from('documents')
      .insert({ title: docTitle || '제목 없는 문서', content: contentHtml })
      .select()
      .single()

    if (error || !data) {
      console.error('Failed to create document:', error)
      alert('문서 생성에 실패했습니다.')
      return
    }

    router.push(`/editor/${data.id}`)
  }

  const handleCancel = () => {
    setMode('default')
    setPromptInput('')
    setTocData([])
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const htmlContent = await parseDocxToRetainedHtml(file)
      const title = file.name.replace(/\.docx$/i, '')

      const { data, error } = await supabase
        .from('documents')
        .insert({ title, content: htmlContent })
        .select()
        .single()

      if (error || !data) {
        console.error('Failed to create document:', error)
        alert('문서 생성에 실패했습니다.')
        return
      }

      router.push(`/editor/${data.id}`)
    } catch (error) {
      console.error('Failed to parse docx:', error)
      alert('파일 파싱에 실패했습니다.')
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
        {mode === 'default' && (
          <button 
            onClick={() => setMode('prompt')}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            빈 문서로 시작
          </button>
        )}
      </div>

      {mode === 'prompt' && (
        <div className="mb-8 bg-white p-6 rounded-xl border shadow-sm transition-all duration-300">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-900">AI로 문서 목차 생성</h3>
            <button onClick={handleCancel} className="text-gray-500 hover:text-gray-700 text-sm font-medium">
              취소
            </button>
          </div>
          <textarea
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            disabled={isGenerating}
            placeholder="어떤 문서를 작성할지 입력해주세요 (예: B2B SaaS 신규 서비스 제안서)"
            className="w-full h-24 p-3 border rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 outline-none resize-none disabled:bg-gray-50 disabled:text-gray-500"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={handleCancel}
              disabled={isGenerating}
              className="px-4 py-2 rounded-lg border hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              취소
            </button>
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !promptInput.trim()}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
            >
              {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <FileText size={20} />}
              {isGenerating ? '생성 중...' : '목차 생성하기'}
            </button>
          </div>
        </div>
      )}

      {mode === 'toc' && (
        <div className="mb-8 bg-white p-6 rounded-xl border shadow-sm transition-all duration-300">
          <div className="flex justify-between items-center mb-6 border-b pb-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">목차 구조 확인</h3>
              <p className="text-sm text-gray-500">생성된 목차를 확인하고 순서를 변경할 수 있습니다.</p>
            </div>
            <button onClick={handleCancel} className="text-gray-500 hover:text-gray-700 text-sm font-medium flex items-center gap-1">
              <ArrowLeft size={16} />
              다시 작성하기
            </button>
          </div>
          <TocBuilder items={tocData} onChange={setTocData} />
          <div className="flex justify-end mt-8 pt-4 border-t gap-3">
            <button
              onClick={handleCancel}
              className="px-4 py-2 rounded-lg border hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleCreateDocument}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors font-semibold flex items-center gap-2"
            >
              이 구조로 에디터 열기
            </button>
          </div>
        </div>
      )}

      {mode === 'default' && (
        <>
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
        </>
      )}
    </div>
  )
}