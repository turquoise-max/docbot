'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { parseDocxToRetainedHtml } from '@/lib/utils/document'

export default function EntryPage() {
  const router = useRouter()
  const [selectedOption, setSelectedOption] = useState<'A' | 'B' | null>(null)
  
  // Option A State
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedToc, setGeneratedToc] = useState<any>(null)

  // Option B State
  const [isUploading, setIsUploading] = useState(false)

  const handleGenerateToc = async () => {
    if (!prompt.trim()) return
    setIsGenerating(true)
    try {
      const res = await fetch('/api/ai/generate-toc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      })
      if (res.ok) {
        const data = await res.json()
        setGeneratedToc(data.toc)
      } else {
        alert('목차 생성에 실패했습니다.')
      }
    } catch (e) {
      console.error(e)
      alert('오류가 발생했습니다.')
    } finally {
      setIsGenerating(false)
    }
  }

  const openEditorWithToc = () => {
    if (!generatedToc) return
    sessionStorage.setItem('docbot_initial_content', JSON.stringify({ type: 'toc', data: generatedToc }))
    router.push('/editor')
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    try {
      const html = await parseDocxToRetainedHtml(file)
      sessionStorage.setItem('docbot_initial_content', JSON.stringify({ type: 'html', data: html, isDocxUpload: true }))
      router.push('/editor')
    } catch (error) {
      console.error(error)
      alert('파일 처리 중 오류가 발생했습니다.')
    } finally {
      setIsUploading(false)
    }
  }

  const renderToc = (items: any[], level = 1) => {
    return (
      <ul className={`pl-${level === 1 ? 0 : 4} space-y-2`}>
        {items.map((item, idx) => (
          <li key={idx} className="text-sm">
            <span className="font-semibold text-gray-800">{item.title}</span>
            {item.description && <p className="text-gray-500 text-xs ml-2 mt-1">{item.description}</p>}
            {item.children && item.children.length > 0 && renderToc(item.children, level + 1)}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="max-w-4xl w-full">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-900">새 문서 시작하기</h1>
        
        {!selectedOption && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button 
              onClick={() => setSelectedOption('A')}
              className="p-8 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-200 flex flex-col items-center text-center gap-4"
            >
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-2xl font-bold">A</div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">AI로 새 문서 시작</h2>
                <p className="text-gray-500 text-sm">키워드를 입력하면 AI가 목차를 추천해줍니다.</p>
              </div>
            </button>
            <button 
              onClick={() => setSelectedOption('B')}
              className="p-8 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-200 flex flex-col items-center text-center gap-4"
            >
              <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-2xl font-bold">B</div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">기존 DOCX 템플릿 업로드</h2>
                <p className="text-gray-500 text-sm">내 양식을 업로드하여 서식을 보존한 채로 시작합니다.</p>
              </div>
            </button>
          </div>
        )}

        {selectedOption === 'A' && (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
            <button onClick={() => { setSelectedOption(null); setGeneratedToc(null); setPrompt(''); }} className="text-sm text-gray-500 mb-4 hover:text-gray-700">← 뒤로 가기</button>
            <h2 className="text-xl font-bold mb-4">어떤 문서를 작성하시나요?</h2>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="예: 배달 앱 신규 런칭 사업계획서"
                className="flex-1 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => e.key === 'Enter' && handleGenerateToc()}
                disabled={isGenerating}
              />
              <button 
                onClick={handleGenerateToc}
                disabled={isGenerating || !prompt.trim()}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {isGenerating ? '생성 중...' : '목차 생성'}
              </button>
            </div>

            {generatedToc && (
              <div className="mt-8 border-t pt-8">
                <h3 className="text-lg font-bold mb-4">추천 목차</h3>
                <div className="bg-gray-50 p-6 rounded-lg border">
                  {renderToc(generatedToc)}
                </div>
                <div className="mt-6 flex justify-end">
                  <button onClick={openEditorWithToc} className="bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700">
                    이 목차로 에디터 열기
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {selectedOption === 'B' && (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center">
            <button onClick={() => setSelectedOption(null)} className="text-sm text-gray-500 mb-4 hover:text-gray-700 block text-left">← 뒤로 가기</button>
            <h2 className="text-xl font-bold mb-6">DOCX 파일 업로드</h2>
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 bg-gray-50 hover:bg-gray-100 transition-colors relative">
              <input 
                type="file" 
                accept=".docx" 
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={isUploading}
              />
              <div className="text-gray-500">
                {isUploading ? (
                  <p>파일을 처리 중입니다...</p>
                ) : (
                  <>
                    <p className="text-lg font-medium mb-2">클릭하거나 파일을 드래그하여 업로드하세요</p>
                    <p className="text-sm">.docx 파일만 지원됩니다</p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}