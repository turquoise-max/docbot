'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { 
  Plus, 
  Search, 
  FileText, 
  Download, 
  MoreVertical, 
  Trash2, 
  Upload, 
  Loader2,
  X,
  AlertTriangle,
  Folder
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import AppSidebar from '@/components/layout/AppSidebar'
import ErrorBoundary from '@/components/common/ErrorBoundary'
import { Button } from '@/components/ui/button'

export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()

  const [user, setUser] = useState<any>(null)
  const [documents, setDocuments] = useState<any[]>([])
  const [folders, setFolders] = useState<any[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

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

    const { data: docs } = await supabase
      .from('documents')
      .select('id, title, updated_at, folder_id, content_html, file_path')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    setDocuments(docs || [])

    const { data: folderList } = await supabase
      .from('folders')
      .select('*')
      .eq('user_id', user.id)
      .order('name', { ascending: true })

    setFolders(folderList || [])
    setIsLoading(false)
  }, [supabase, router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleDelete = async (id: string) => {
    if (!window.confirm('정말 이 문서를 삭제하시겠습니까?')) return

    const { error } = await supabase.from('documents').delete().eq('id', id)
    if (error) {
      alert('삭제 중 오류가 발생했습니다.')
      return
    }

    setDocuments(prev => prev.filter(doc => doc.id !== id))
    setOpenMenuId(null)
  }

  const handleUpdateTitle = async (id: string) => {
    if (!editingTitle.trim()) {
      setEditingId(null)
      return
    }

    const { error } = await supabase
      .from('documents')
      .update({ title: editingTitle, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      alert('제목 수정 중 오류가 발생했습니다.')
    } else {
      setDocuments(prev => prev.map(doc => doc.id === id ? { ...doc, title: editingTitle } : doc))
    }
    setEditingId(null)
  }

  const handleDownload = async (doc: any) => {
    if (!doc.file_path) {
      alert('에디터에서 내보내기를 이용해주세요.')
      return
    }

    try {
      const { data, error } = await supabase.storage
        .from('files')
        .download(doc.file_path)

      if (error) throw error

      const url = window.URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = `${doc.title}.docx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Download error:', error)
      alert('다운로드 중 오류가 발생했습니다.')
    }
  }

  const handleCreateEmptyDocument = async () => {
    if (!user) return
    setIsCreating(true)
    try {
      const { data, error } = await supabase
        .from('documents')
        .insert({ 
          title: '제목 없는 문서', 
          content_html: '<h1>제목 없는 문서</h1><p><br/></p>', 
          user_id: user.id 
        })
        .select()
        .single()

      if (error || !data) {
        console.error('Failed to create document:', error)
        alert('문서 생성에 실패했습니다.')
        return
      }

      router.push(`/editor/${data.id}`)
    } catch (error) {
      console.error('Error creating document:', error)
      alert('오류가 발생했습니다.')
    } finally {
      setIsCreating(false)
    }
  }

  const handleTemplateClick = async (template: any) => {
    if (!user) return
    setIsCreating(true)
    try {
      const { data, error } = await supabase
        .from('documents')
        .insert({ 
          title: `${template.title} - ${new Date().toLocaleDateString()}`, 
          content_html: `<h1>${template.title}</h1><p>본 내용을 입력하세요.</p>`, 
          user_id: user.id 
        })
        .select()
        .single()

      if (error || !data) {
        console.error('Failed to create document from template:', error)
        alert('문서 생성에 실패했습니다.')
        return
      }

      router.push(`/editor/${data.id}`)
    } catch (error) {
      console.error('Error creating document:', error)
      alert('오류가 발생했습니다.')
    } finally {
      setIsCreating(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !user) return

    setIsUploading(true)
    try {
      const title = file.name.replace(/\.docx$/i, '')
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}`
      const filePath = `${user.id}/documents/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('files')
        .upload(filePath, file)

      if (uploadError) {
        console.error('Failed to upload file to storage:', uploadError)
        alert('파일 업로드에 실패했습니다.')
        return
      }

      const { data, error } = await supabase
        .from('documents')
        .insert({
            title,
            content_html: '',
            file_path: filePath,
            user_id: user.id
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
      event.target.value = ''
    }
  }

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFolder = !selectedFolderId || doc.folder_id === selectedFolderId
    return matchesSearch && matchesFolder
  })

  return (
    <div className="flex h-screen bg-white" onClick={() => setOpenMenuId(null)}>
      <AppSidebar variant="wide" />

      {/* Sidebar Folders Section */}
      <aside className="w-64 border-r flex flex-col bg-gray-50/50 shrink-0">
        <div className="p-6">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 px-2">폴더</h2>
          <nav className="space-y-1">
            <button
              onClick={() => setSelectedFolderId(null)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                selectedFolderId === null 
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <FileText size={18} />
              모든 문서
            </button>
            {folders.map(folder => (
              <button
                key={folder.id}
                onClick={() => setSelectedFolderId(folder.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  selectedFolderId === folder.id 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Folder size={18} />
                <span className="truncate">{folder.name}</span>
              </button>
            ))}
          </nav>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 border-b flex items-center justify-between px-8 bg-white shrink-0">
          <div className="flex items-center gap-4 flex-1 max-w-xl">
            <h1 className="text-lg font-semibold text-gray-900 shrink-0">
              안녕하세요, {user?.email?.split('@')[0]}님
            </h1>
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="문서 검색..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium ml-4"
          >
            <Plus size={18} />
            새 문서
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto p-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              {selectedFolderId 
                ? folders.find(f => f.id === selectedFolderId)?.name || '폴더'
                : '모든 문서'
              }
            </h2>
            <span className="text-sm text-gray-500">총 {filteredDocuments.length}개</span>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {Array(3).fill(0).map((_, i) => (
                <div key={i} className="h-16 bg-gray-50 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : (
            <ErrorBoundary
              fallback={
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-100 shadow-sm text-center">
                  <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                    <AlertTriangle className="w-8 h-8 text-red-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">문서 목록을 불러오지 못했습니다</h3>
                  <p className="text-gray-500 mb-6">일시적인 오류입니다. 페이지를 새로고침해주세요.</p>
                  <Button 
                    variant="outline" 
                    onClick={() => window.location.reload()}
                    className="px-8"
                  >
                    새로고침
                  </Button>
                </div>
              }
            >
              {filteredDocuments.length === 0 ? (
                selectedFolderId ? (
                  <div className="flex flex-col items-center justify-center py-24 bg-gray-50/50 rounded-xl border-2 border-dashed border-gray-200 text-center">
                    <Folder size={48} className="text-gray-300 mb-4" />
                    <h3 className="text-lg font-bold text-gray-900 mb-2">이 폴더에 문서가 없어요</h3>
                    <p className="text-gray-500">다른 폴더를 선택하거나 새 문서를 만들어보세요.</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-24 bg-gray-50/50 rounded-xl border-2 border-dashed border-gray-200 text-center">
                    <FileText size={48} className="text-gray-300 mb-4" />
                    <h3 className="text-lg font-bold text-gray-900 mb-2">아직 작성한 문서가 없어요</h3>
                    <p className="text-gray-500 mb-8">새 문서를 만들거나 DOCX 파일을 업로드해서 시작해보세요.</p>
                    <Button 
                      onClick={() => setIsModalOpen(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-8 h-11 rounded-lg shadow-sm"
                    >
                      <Plus className="mr-2 h-4 w-4" /> 첫 문서 만들기
                    </Button>
                  </div>
                )
              ) : (
                <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                    <th className="px-6 py-4 font-semibold">제목</th>
                    <th className="px-6 py-4 font-semibold w-48">최종 수정일</th>
                    <th className="px-6 py-4 font-semibold w-24 text-center">액션</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {filteredDocuments.map(doc => (
                    <tr key={doc.id} className="border-b hover:bg-blue-50/30 group transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-blue-100 p-2 rounded text-blue-600">
                            <FileText size={18} />
                          </div>
                          {editingId === doc.id ? (
                            <input
                              autoFocus
                              className="border rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onBlur={() => handleUpdateTitle(doc.id)}
                              onKeyDown={(e) => e.key === 'Enter' && handleUpdateTitle(doc.id)}
                            />
                          ) : (
                            <Link 
                              href={`/editor/${doc.id}`} 
                              className="font-medium text-gray-900 hover:text-blue-600 truncate block max-w-md"
                              onDoubleClick={(e) => {
                                e.preventDefault()
                                setEditingId(doc.id)
                                setEditingTitle(doc.title)
                              }}
                            >
                              {doc.title}
                            </Link>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {new Date(doc.updated_at).toLocaleDateString('ko-KR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </td>
                      <td className="px-6 py-4 relative text-center">
                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleDownload(doc)}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" 
                            title="다운로드"
                          >
                            <Download size={16} />
                          </button>
                          <div className="relative">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation()
                                setOpenMenuId(openMenuId === doc.id ? null : doc.id)
                              }}
                              className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                            >
                              <MoreVertical size={16} />
                            </button>
                            {openMenuId === doc.id && (
                              <div className="absolute right-0 mt-1 w-36 bg-white border rounded shadow-xl z-20 py-1 overflow-hidden">
                                <button
                                  onClick={() => {
                                    setEditingId(doc.id)
                                    setEditingTitle(doc.title)
                                    setOpenMenuId(null)
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  제목 수정
                                </button>
                                <button
                                  onClick={() => handleDelete(doc.id)}
                                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                  <Trash2 size={14} />
                                  삭제
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            )}
          </ErrorBoundary>
        )}
      </div>
      </main>

      {/* New Document Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b flex items-center justify-between bg-gray-50">
              <h3 className="text-xl font-bold text-gray-900">새 문서 시작</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-8 overflow-auto">
              {(isCreating || isUploading) && (
                <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center z-10 backdrop-blur-sm">
                  <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
                  <p className="text-blue-800 font-bold text-lg">
                    {isUploading ? '문서 구조를 분석하고 있습니다...' : '문서를 생성하고 있습니다...'}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                {/* Empty Document Card */}
                <button 
                  onClick={handleCreateEmptyDocument}
                  className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-200 rounded-2xl hover:border-blue-500 hover:bg-blue-50 transition-all group"
                >
                  <div className="bg-white p-4 rounded-full shadow-md mb-4 group-hover:scale-110 transition-transform">
                    <Plus className="text-blue-600" size={32} />
                  </div>
                  <h4 className="text-lg font-bold text-gray-900 mb-2">빈 문서로 시작</h4>
                  <p className="text-sm text-gray-500 text-center">새로운 백지 상태에서 문서를 작성합니다.</p>
                </button>

                {/* Upload Card */}
                <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-200 rounded-2xl hover:border-blue-500 hover:bg-blue-50 transition-all group relative">
                  <input 
                    type="file" 
                    accept=".docx" 
                    className="absolute inset-0 opacity-0 cursor-pointer" 
                    onChange={handleFileUpload}
                  />
                  <div className="bg-white p-4 rounded-full shadow-md mb-4 group-hover:scale-110 transition-transform">
                    <Upload className="text-blue-600" size={32} />
                  </div>
                  <h4 className="text-lg font-bold text-gray-900 mb-2">워드 파일(.docx) 업로드</h4>
                  <p className="text-sm text-gray-500 text-center">기존 문서의 서식을 유지한 채로 가져옵니다.</p>
                </div>
              </div>

              <div>
                <h4 className="text-base font-bold text-gray-900 mb-4">공식 템플릿</h4>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {officialTemplates.map(template => (
                    <button 
                      key={template.id} 
                      onClick={() => handleTemplateClick(template)}
                      className="block group text-left h-full"
                    >
                      <div className="border rounded-xl p-5 h-full hover:border-blue-500 hover:shadow-md transition-all bg-white flex flex-col">
                        <div className="bg-gray-50 w-10 h-10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-50 transition-colors shrink-0">
                          <FileText size={20} className="text-gray-400 group-hover:text-blue-600" />
                        </div>
                        <h5 className="font-bold text-gray-900 text-sm mb-1">{template.title}</h5>
                        <p className="text-xs text-gray-500 leading-relaxed">{template.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}