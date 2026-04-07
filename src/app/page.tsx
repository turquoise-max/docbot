'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { parseDocxToRetainedHtml } from '@/lib/utils/document'

export default function EntryPage() {
  const router = useRouter()
  const [selectedOption, setSelectedOption] = useState<'A' | null>(null)
  
  // Option A State
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedToc, setGeneratedToc] = useState<any>(null)

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
        if (data.toc) {
          setGeneratedToc(data.toc)
        } else {
          console.error('Invalid response format:', data)
          alert('목차 데이터를 불러오는 데 실패했습니다.')
        }
      } else {
        console.error('API Error:', res.status, res.statusText)
        alert('목차 생성에 실패했습니다. 잠시 후 다시 시도해주세요.')
      }
    } catch (e) {
      console.error('Fetch Error:', e)
      alert('네트워크 오류가 발생했습니다. 연결을 확인해주세요.')
    } finally {
      setIsGenerating(false)
    }
  }

  const generateHtmlFromToc = (tocData: any[]): string => {
    let html = '<h1>새 문서</h1>\n'
    tocData.forEach((item) => {
      if (item.level === 1) {
        html += `<h2>${item.text}</h2>\n<p><br/></p>\n`
      } else if (item.level === 2) {
        html += `<h3>${item.text}</h3>\n<p><br/></p>\n`
      } else {
        html += `<h4>${item.text}</h4>\n<p><br/></p>\n`
      }
    })
    return html
  }

  const openEditorWithToc = () => {
    if (!generatedToc) return
    const htmlString = generateHtmlFromToc(generatedToc)
    sessionStorage.setItem('docbot_initial_content', htmlString)
    router.push('/editor')
  }

  const renderToc = (items: any[]) => {
    return (
      <ul className="space-y-2">
        {items.map((item, idx) => (
          <li key={idx} className={`text-sm ${item.level === 1 ? 'ml-0 font-bold' : item.level === 2 ? 'ml-4 font-semibold' : 'ml-8 text-gray-600'}`}>
            {item.text}
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
                <h2 className="text-xl font-bold text-gray-900 mb-2">AI로 새 문서 시작 (키워드로 목차 구성)</h2>
                <p className="text-gray-500 text-sm">키워드를 입력하면 AI가 목차를 추천해줍니다.</p>
              </div>
            </button>
            <button 
              onClick={() => router.push('/templates')}
              className="p-8 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-200 flex flex-col items-center text-center gap-4"
            >
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-2xl font-bold">B</div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">템플릿으로 시작</h2>
                <p className="text-gray-500 text-sm">표준 양식을 제공받아 문서를 작성합니다.</p>
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

      </div>
    </div>
  )
}
