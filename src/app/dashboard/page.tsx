'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { 
  FileText, 
  Star, 
  Plus, 
  Upload, 
  Clock, 
  Loader2,
  Sparkles,
  ArrowRight
} from 'lucide-react'
import AppSidebar from '@/components/layout/AppSidebar'
import Header from '@/components/layout/Header'
import { v4 as uuidv4 } from 'uuid'
import { creationIntentStore } from '@/lib/store/creationIntent'

export default function NewDashboardPage() {
  const supabase = createClient()
  const router = useRouter()

  const [user, setUser] = useState<any>(null)
  const [recentDocs, setRecentDocs] = useState<any[]>([])
  const [favoriteDocs, setFavoriteDocs] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [prompt, setPrompt] = useState('')

  const officialTemplates = [
    { id: '1', title: '사업계획서', desc: '표준 사업계획서 양식' },
    { id: '2', title: '운영계획서', desc: '주간/월간 운영계획서 양식' },
    { id: '3', title: '회의록', desc: '공식 회의록 양식' },
    { id: '4', title: '제안서', desc: '프로젝트 제안서 양식' },
  ]

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    setUser(user)

    // 최근 문서 가져오기
    const { data: recent } = await supabase
      .from('documents')
      .select('id, title, updated_at, is_favorite, folders(name)')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(5)

    // 즐겨찾기 가져오기
    const { data: favorites } = await supabase
      .from('documents')
      .select('id, title, updated_at, is_favorite, folders(name)')
      .eq('user_id', user.id)
      .eq('is_favorite', true)
      .order('updated_at', { ascending: false })

    setRecentDocs(recent || [])
    setFavoriteDocs(favorites || [])
    setIsLoading(false)
  }, [supabase, router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleAiSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !prompt.trim() || isCreating) return
    setIsCreating(true)
    
    const id = uuidv4()
    creationIntentStore.setIntent(id, {
      type: 'ai_prompt',
      title: 'AI 생성 문서',
      prompt: prompt.trim()
    })
    
    router.push(`/editor/${id}`)
  }

  const handleCreateEmptyDocument = () => {
    if (!user || isCreating) return
    setIsCreating(true)
    
    const id = uuidv4()
    creationIntentStore.setIntent(id, {
      type: 'empty',
      title: '제목 없는 문서',
      html: '<h1>제목 없는 문서</h1><p><br/></p>'
    })
    
    router.push(`/editor/${id}`)
  }

  const handleTemplateClick = (template: any) => {
    if (!user || isCreating) return
    setIsCreating(true)
    
    const id = uuidv4()
    creationIntentStore.setIntent(id, {
      type: 'template',
      title: `${template.title} - ${new Date().toLocaleDateString()}`,
      html: `<h1>${template.title}</h1><p>본 내용을 입력하세요.</p>`
    })
    
    router.push(`/editor/${id}`)
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !user || isUploading) return

    setIsUploading(true)
    
    const id = uuidv4()
    const title = file.name.replace(/\.docx$/i, '')
    
    creationIntentStore.setIntent(id, {
      type: 'upload',
      title,
      file
    })
    
    router.push(`/editor/${id}`)
  }

  const toggleFavorite = async (e: React.MouseEvent, docId: string, currentStatus: boolean) => {
    e.stopPropagation()
    e.preventDefault()
    
    const newStatus = !currentStatus
    const { error } = await supabase
      .from('documents')
      .update({ is_favorite: newStatus })
      .eq('id', docId)

    if (!error) {
      setRecentDocs(prev => prev.map(doc => doc.id === docId ? { ...doc, is_favorite: newStatus } : doc))
      if (newStatus) {
        const docToAdd = recentDocs.find(d => d.id === docId)
        if (docToAdd) setFavoriteDocs(prev => [{...docToAdd, is_favorite: true}, ...prev])
      } else {
        setFavoriteDocs(prev => prev.filter(doc => doc.id !== docId))
      }
    }
  }

  return (
    <div className="flex h-screen bg-gray-50/50">
      <AppSidebar variant="wide" />

      <main className="flex-1 overflow-auto flex flex-col min-w-0">
        <Header />

        {isUploading && (
          <div className="fixed inset-0 bg-white/80 flex flex-col items-center justify-center z-50 backdrop-blur-sm">
            <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
            <p className="text-blue-800 font-bold text-lg">문서 구조를 분석하고 있습니다...</p>
          </div>
        )}

        <div className="p-6 max-w-5xl mx-auto w-full flex-1 flex flex-col space-y-6 min-h-0">
          
          {/* 1. AI 프롬프트 (가장 돋보이게) */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
            <div className="mb-4 flex flex-col items-center">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-full mb-2">
                <Sparkles size={24} />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">어떤 문서를 작성할까요?</h2>
              <p className="text-sm text-gray-500">주제나 핵심 내용을 입력하시면 AI가 초안을 완성해 드립니다.</p>
            </div>
            
            <form onSubmit={handleAiSubmit} className="max-w-3xl mx-auto relative group">
              <input 
                type="text" 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="예: 신규 모바일 앱 서비스 출시 마케팅 기획서 작성해줘" 
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-base rounded-full px-5 py-3 pr-14 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm group-hover:shadow"
                disabled={isCreating}
              />
              <button 
                type="submit"
                disabled={!prompt.trim() || isCreating}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
              >
                {isCreating ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
              </button>
            </form>
          </section>

          {/* 2. 빠른 시작 */}
          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Plus size={18} className="text-blue-600" /> 빠른 시작
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button 
                onClick={handleCreateEmptyDocument}
                className="border border-gray-200 rounded-xl p-4 hover:border-blue-500 hover:shadow-md transition-all bg-white flex items-center gap-4 group"
              >
                <div className="bg-blue-50 text-blue-600 w-10 h-10 rounded-full flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <Plus size={20} />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-gray-900 text-sm">새 문서</h3>
                  <p className="text-xs text-gray-500">백지에서 시작하기</p>
                </div>
              </button>

              <div className="relative group">
                <input 
                  type="file" 
                  accept=".docx" 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                  onChange={handleFileUpload}
                  title="워드 파일(.docx) 가져오기"
                />
                <div className="border border-gray-200 rounded-xl p-4 hover:border-blue-500 hover:shadow-md transition-all bg-white flex items-center gap-4">
                  <div className="bg-green-50 text-green-600 w-10 h-10 rounded-full flex items-center justify-center shrink-0 group-hover:-translate-y-1 transition-transform">
                    <Upload size={20} />
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-gray-900 text-sm">문서 가져오기</h3>
                    <p className="text-xs text-gray-500">기존 Word 파일 업로드</p>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => router.push('/templates')}
                className="border border-gray-200 rounded-xl p-4 hover:border-blue-500 hover:shadow-md transition-all bg-white flex items-center gap-4 group"
              >
                <div className="bg-purple-50 text-purple-600 w-10 h-10 rounded-full flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <FileText size={20} />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-gray-900 text-sm">템플릿 둘러보기</h3>
                  <p className="text-xs text-gray-500">상황에 맞는 양식 선택</p>
                </div>
              </button>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
            {/* 3. 최근 수정 문서 Top 5 */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full min-h-[200px]">
              <div className="p-5 border-b flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Clock size={18} className="text-gray-400" /> 최근 작업
                </h2>
                <Link href="/mydrive" className="text-sm font-medium text-blue-600 hover:text-blue-700">
                  전체보기
                </Link>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {isLoading ? (
                  <div className="space-y-2 p-3">
                    {Array(4).fill(0).map((_, i) => (
                      <div key={i} className="h-12 bg-gray-50 animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : recentDocs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6">
                    <FileText size={32} className="text-gray-300 mb-2" />
                    <p className="text-gray-500 text-sm">최근 작업한 문서가 없습니다.</p>
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {recentDocs.map(doc => (
                      <li key={doc.id}>
                        <Link 
                          href={`/editor/${doc.id}`}
                          className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="p-2 text-gray-400 group-hover:text-blue-600 transition-colors">
                              <FileText size={16} />
                            </div>
                            <div className="truncate">
                              <h3 className="text-sm font-semibold text-gray-900 truncate mb-0.5">{doc.title}</h3>
                              <p className="text-xs text-gray-500">
                                {new Date(doc.updated_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <button 
                            onClick={(e) => toggleFavorite(e, doc.id, !!doc.is_favorite)}
                            className={`p-2 rounded-full transition-colors shrink-0 ${doc.is_favorite ? 'text-yellow-400' : 'text-gray-300 opacity-0 group-hover:opacity-100 hover:text-yellow-400'}`}
                          >
                            <Star size={16} fill={doc.is_favorite ? "currentColor" : "none"} />
                          </button>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {/* 4. 즐겨찾기 */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full min-h-[200px]">
              <div className="p-5 border-b flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Star size={18} className="text-yellow-500" fill="currentColor" /> 즐겨찾기
                </h2>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {isLoading ? (
                  <div className="space-y-2 p-3">
                    {Array(3).fill(0).map((_, i) => (
                      <div key={i} className="h-12 bg-gray-50 animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : favoriteDocs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6">
                    <Star size={32} className="text-gray-300 mb-2" />
                    <p className="text-gray-500 text-sm">중요한 문서를 즐겨찾기 해보세요.</p>
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {favoriteDocs.map(doc => (
                      <li key={`fav-${doc.id}`}>
                        <Link 
                          href={`/editor/${doc.id}`}
                          className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="p-2 text-yellow-500">
                              <FileText size={16} />
                            </div>
                            <div className="truncate">
                              <h3 className="text-sm font-semibold text-gray-900 truncate mb-0.5">{doc.title}</h3>
                              <p className="text-xs text-gray-500">
                                {new Date(doc.updated_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <button 
                            onClick={(e) => toggleFavorite(e, doc.id, true)}
                            className="p-2 rounded-full text-yellow-400 hover:text-gray-400 transition-colors shrink-0"
                          >
                            <Star size={16} fill="currentColor" />
                          </button>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>

        </div>
      </main>
    </div>
  )
}