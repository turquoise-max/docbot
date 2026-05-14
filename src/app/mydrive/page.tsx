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
  Folder,
  FolderPlus,
  Edit2,
  Check,
  FolderOutput,
  LayoutGrid,
  List as ListIcon,
  ChevronDown,
  CheckSquare,
  Square,
  FilePlus
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import AppSidebar from '@/components/layout/AppSidebar'
import Header from '@/components/layout/Header'
import ErrorBoundary from '@/components/common/ErrorBoundary'
import { Button } from '@/components/ui/button'
import { Star } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { creationIntentStore } from '@/lib/store/creationIntent'

export default function ArchivePage() {
  const supabase = createClient()
  const router = useRouter()

  const [user, setUser] = useState<any>(null)
  const [documents, setDocuments] = useState<any[]>([])
  const [folders, setFolders] = useState<any[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  
  // View & Selection States
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [sortBy, setSortBy] = useState<'updated_at' | 'title' | 'created_at'>('updated_at')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  
  // Folder Management States
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingFolderName, setEditingFolderName] = useState('')
  const [openFolderMenuId, setOpenFolderMenuId] = useState<string | null>(null)
  const [folderMenuPosition, setFolderMenuPosition] = useState({ top: 0, left: 0 })
  
  // Modal states
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false)
  const [movingDocId, setMovingDocId] = useState<string | null>(null)
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
      .select('id, title, updated_at, created_at, folder_id, content_html, file_path, is_favorite')
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

  const handleCreateFolder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!newFolderName.trim() || !user) {
      setIsCreatingFolder(false)
      return
    }

    const { data, error } = await supabase
      .from('folders')
      .insert({ name: newFolderName.trim(), user_id: user.id })
      .select()
      .single()

    if (error) {
      alert('폴더 생성 중 오류가 발생했습니다.')
    } else if (data) {
      setFolders(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    }
    
    setNewFolderName('')
    setIsCreatingFolder(false)
  }

  const handleUpdateFolder = async (id: string) => {
    if (!editingFolderName.trim()) {
      setEditingFolderId(null)
      return
    }

    const { error } = await supabase
      .from('folders')
      .update({ name: editingFolderName.trim() })
      .eq('id', id)

    if (error) {
      alert('폴더 이름 수정 중 오류가 발생했습니다.')
    } else {
      setFolders(prev => prev.map(f => f.id === id ? { ...f, name: editingFolderName.trim() } : f))
    }
    setEditingFolderId(null)
  }

  const handleDeleteFolder = async (id: string) => {
    if (!window.confirm('폴더를 삭제하면 폴더 안의 모든 문서도 함께 삭제됩니다. 정말 삭제하시겠습니까?')) return

    const { error } = await supabase.from('folders').delete().eq('id', id)
    if (error) {
      alert('폴더 삭제 중 오류가 발생했습니다.')
      return
    }

    setFolders(prev => prev.filter(f => f.id !== id))
    if (selectedFolderId === id) setSelectedFolderId(null)
    setDocuments(prev => prev.filter(doc => doc.folder_id !== id))
    setOpenFolderMenuId(null)
  }

  const handleMoveDocument = async (folderId: string | null) => {
    if (!movingDocId) return
    
    if (movingDocId === 'bulk') {
      await executeBulkMove(folderId)
      return
    }

    const { error } = await supabase
      .from('documents')
      .update({ folder_id: folderId, updated_at: new Date().toISOString() })
      .eq('id', movingDocId)

    if (error) {
      alert('문서 이동 중 오류가 발생했습니다.')
    } else {
      setDocuments(prev => prev.map(doc => doc.id === movingDocId ? { ...doc, folder_id: folderId } : doc))
      setIsMoveModalOpen(false)
      setMovingDocId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('정말 이 문서를 삭제하시겠습니까?')) return

    const { error } = await supabase.from('documents').delete().eq('id', id)
    if (error) {
      alert('삭제 중 오류가 발생했습니다.')
      return
    }

    setDocuments(prev => prev.filter(doc => doc.id !== id))
    setSelectedIds(prev => prev.filter(selectedId => selectedId !== id))
  }

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return
    if (!window.confirm(`선택한 ${selectedIds.length}개의 문서를 정말 삭제하시겠습니까?`)) return

    const { error } = await supabase.from('documents').delete().in('id', selectedIds)
    if (error) {
      alert('삭제 중 오류가 발생했습니다.')
      return
    }

    setDocuments(prev => prev.filter(doc => !selectedIds.includes(doc.id)))
    setSelectedIds([])
  }

  const handleBulkMove = () => {
    if (selectedIds.length === 0) return
    // 기존 단일 문서 이동 모달 재사용
    setMovingDocId('bulk') 
    setIsMoveModalOpen(true)
  }

  const executeBulkMove = async (folderId: string | null) => {
    const { error } = await supabase
      .from('documents')
      .update({ folder_id: folderId, updated_at: new Date().toISOString() })
      .in('id', selectedIds)

    if (error) {
      alert('문서 이동 중 오류가 발생했습니다.')
    } else {
      setDocuments(prev => prev.map(doc => selectedIds.includes(doc.id) ? { ...doc, folder_id: folderId } : doc))
      setIsMoveModalOpen(false)
      setMovingDocId(null)
      setSelectedIds([])
    }
  }

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  const toggleAll = (currentDocs: any[]) => {
    const isAllSelected = currentDocs.length > 0 && currentDocs.every(doc => selectedIds.includes(doc.id))
    if (isAllSelected) {
      // 현재 보이는 문서들의 선택 해제
      setSelectedIds(prev => prev.filter(id => !currentDocs.find(d => d.id === id)))
    } else {
      // 현재 보이는 문서들 모두 선택
      const newIds = new Set([...selectedIds, ...currentDocs.map(d => d.id)])
      setSelectedIds(Array.from(newIds))
    }
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

  const handleCreateEmptyDocument = () => {
    if (!user || isCreating) return
    setIsCreating(true)
    
    const id = uuidv4()
    creationIntentStore.setIntent(id, {
      type: 'empty',
      title: '제목 없는 문서',
      html: '<p><br/></p>'
    })
    
    router.push(`/editor/${id}`)
    // Note: 페이지가 전환되므로 isCreating을 false로 명시적으로 바꿀 필요가 없음 (오히려 뷰 유지)
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

  const toggleFavorite = async (e: React.MouseEvent, docId: string, currentStatus: boolean) => {
    e.stopPropagation()
    e.preventDefault()
    
    const newStatus = !currentStatus
    const { error } = await supabase
      .from('documents')
      .update({ is_favorite: newStatus })
      .eq('id', docId)

    if (!error) {
      setDocuments(prev => prev.map(doc => doc.id === docId ? { ...doc, is_favorite: newStatus } : doc))
    }
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

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = (doc.title || '').toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFolder = !selectedFolderId || doc.folder_id === selectedFolderId
    return matchesSearch && matchesFolder
  }).sort((a, b) => {
    if (sortBy === 'title') {
      return (a.title || '').localeCompare(b.title || '')
    } else if (sortBy === 'created_at') {
      return new Date(b.created_at || b.updated_at).getTime() - new Date(a.created_at || a.updated_at).getTime()
    } else {
      // default: updated_at
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    }
  })

  return (
    <div className="flex h-screen bg-white" onClick={() => { setOpenFolderMenuId(null); }}>
      <AppSidebar variant="wide" />

      {/* Main Content Area Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Global Header spans across folder sidebar and main content */}
        <Header />

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar Folders Section */}
          <aside className="w-64 border-r flex flex-col bg-gray-50/50 shrink-0 overflow-hidden">
            <div className="p-4 pb-2 border-b border-gray-200/50 flex items-center justify-between">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2">폴더</h2>
              <div className="flex items-center gap-1">
            <button 
              onClick={() => setIsCreatingFolder(true)}
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="새 폴더"
            >
              <FolderPlus size={16} />
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="새 문서"
            >
              <FilePlus size={16} />
            </button>
          </div>
        </div>
        <div className="p-4 flex-1 overflow-y-auto">
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

            {isCreatingFolder && (
              <form onSubmit={handleCreateFolder} className="px-3 py-2">
                <div className="flex items-center gap-2 bg-white border border-blue-300 rounded-lg px-2 py-1 shadow-sm">
                  <Folder size={18} className="text-blue-500 shrink-0" />
                  <input
                    autoFocus
                    type="text"
                    value={newFolderName}
                    onChange={e => setNewFolderName(e.target.value)}
                    onBlur={() => handleCreateFolder()}
                    placeholder="폴더 이름"
                    className="w-full text-sm outline-none bg-transparent"
                  />
                </div>
              </form>
            )}

            {folders.map(folder => (
              <div key={folder.id} className="relative group">
                {editingFolderId === folder.id ? (
                  <div className="px-3 py-2">
                    <div className="flex items-center gap-2 bg-white border border-blue-300 rounded-lg px-2 py-1 shadow-sm">
                      <Folder size={18} className="text-blue-500 shrink-0" />
                      <input
                        autoFocus
                        type="text"
                        value={editingFolderName}
                        onChange={e => setEditingFolderName(e.target.value)}
                        onBlur={() => handleUpdateFolder(folder.id)}
                        onKeyDown={e => e.key === 'Enter' && handleUpdateFolder(folder.id)}
                        className="w-full text-sm outline-none bg-transparent"
                      />
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setSelectedFolderId(folder.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors pr-8 ${
                      selectedFolderId === folder.id 
                        ? 'bg-blue-50 text-blue-700' 
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <Folder size={18} className="shrink-0" />
                      <span className="truncate">{folder.name}</span>
                    </div>
                  </button>
                )}

                {editingFolderId !== folder.id && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (openFolderMenuId === folder.id) {
                            setOpenFolderMenuId(null)
                          } else {
                            const rect = e.currentTarget.getBoundingClientRect()
                            setFolderMenuPosition({ top: rect.top, left: rect.right + 4 })
                            setOpenFolderMenuId(folder.id)
                          }
                        }}
                        className={`p-1 rounded text-gray-400 hover:text-gray-900 hover:bg-gray-200 transition-colors ${openFolderMenuId === folder.id ? 'opacity-100 bg-gray-200 text-gray-900' : ''}`}
                      >
                        <MoreVertical size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
                ))}
              </nav>
            </div>
          </aside>

          <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Content */}
            <div className="flex-1 overflow-auto p-8">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                {selectedFolderId 
                  ? folders.find(f => f.id === selectedFolderId)?.name || '폴더'
                  : '모든 문서'
                }
                <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{filteredDocuments.length}</span>
              </h2>
            </div>
            
            {/* Controls (Sort & View Toggle) */}
            <div className="flex items-center gap-3">
              <div className="relative group">
                <select 
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="appearance-none flex items-center gap-2 pl-3 pr-8 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="updated_at">최종 수정일 순</option>
                  <option value="created_at">생성일 순</option>
                  <option value="title">이름 순</option>
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
              
              <div className="flex items-center bg-gray-100 rounded-md p-0.5 border border-gray-200">
                <button 
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-sm transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                  title="리스트 뷰"
                >
                  <ListIcon size={16} />
                </button>
                <button 
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-sm transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                  title="그리드 뷰"
                >
                  <LayoutGrid size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Selection Toolbar (Inline) */}
          {selectedIds.length > 0 && (
            <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-900 px-4 py-2.5 rounded-lg flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-3">
                <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">{selectedIds.length}</span>
                <span className="text-sm font-medium">개 선택됨</span>
              </div>
              
              <div className="flex items-center gap-1">
                <button onClick={handleBulkMove} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md hover:bg-blue-100 transition-colors text-blue-700">
                  <FolderOutput size={16} />
                  이동
                </button>
                <button 
                  onClick={() => {
                    selectedIds.forEach(id => {
                      const doc = documents.find(d => d.id === id)
                      if (doc) handleDownload(doc)
                    })
                  }} 
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md hover:bg-blue-100 transition-colors text-blue-700"
                >
                  <Download size={16} />
                  다운로드
                </button>
                <button onClick={handleBulkDelete} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md hover:bg-red-50 transition-colors text-red-600">
                  <Trash2 size={16} />
                  삭제
                </button>
                <div className="border-l border-blue-200 pl-2 ml-1 flex items-center">
                   <button onClick={() => setSelectedIds([])} className="p-1.5 hover:bg-blue-100 rounded-md text-blue-400 hover:text-blue-700 transition-colors" title="선택 해제">
                     <X size={18} />
                   </button>
                </div>
              </div>
            </div>
          )}

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
                <>
                {viewMode === 'list' ? (
                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                        <th className="px-4 py-4 w-12 text-center">
                          <button onClick={() => toggleAll(filteredDocuments)} className="text-gray-400 hover:text-blue-600">
                            {filteredDocuments.length > 0 && filteredDocuments.every(doc => selectedIds.includes(doc.id)) 
                              ? <CheckSquare size={18} className="text-blue-600" /> 
                              : <Square size={18} />}
                          </button>
                        </th>
                        <th className="px-4 py-4 font-semibold">제목</th>
                        <th className="px-6 py-4 font-semibold w-32 whitespace-nowrap">최종 수정일</th>
                        <th className="px-6 py-4 font-semibold w-32 whitespace-nowrap">생성일</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {filteredDocuments.map(doc => {
                        const isSelected = selectedIds.includes(doc.id)
                        return (
                        <tr key={doc.id} className={`border-b transition-colors group ${isSelected ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}>
                          <td className="px-4 py-4 text-center w-12">
                            <button onClick={() => toggleSelection(doc.id)} className="text-gray-400 hover:text-blue-600">
                              {isSelected ? <CheckSquare size={18} className="text-blue-600" /> : <Square size={18} />}
                            </button>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => toggleFavorite(e, doc.id, !!doc.is_favorite)}
                                  className={`p-1 rounded-full transition-colors ${doc.is_favorite ? 'text-yellow-400 hover:text-yellow-500' : 'text-gray-300 hover:text-gray-400'}`}
                                >
                                  <Star size={16} fill={doc.is_favorite ? "currentColor" : "none"} />
                                </button>
                                <div className={`p-2 rounded ${isSelected ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors'}`}>
                                  <FileText size={18} />
                                </div>
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
                        <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                          {new Date(doc.updated_at).toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </td>
                        <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                          {new Date(doc.created_at || doc.updated_at).toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {filteredDocuments.map(doc => {
                    const isSelected = selectedIds.includes(doc.id)
                    return (
                      <div 
                        key={doc.id} 
                        className={`relative group rounded-xl p-4 flex flex-col h-48 transition-all shadow-sm ${isSelected ? 'bg-blue-50/30 ring-2 ring-blue-500' : 'bg-white hover:shadow-md'}`}
                      >
                        <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
                          <button onClick={() => toggleSelection(doc.id)} className={`bg-white rounded ${isSelected ? 'text-blue-600' : 'text-gray-300 opacity-0 group-hover:opacity-100 hover:text-blue-600'}`}>
                            {isSelected ? <CheckSquare size={20} className="text-blue-600" /> : <Square size={20} />}
                          </button>
                        </div>
                        <div className="absolute top-3 right-3 z-20 flex items-center gap-1">
                          <button
                            onClick={(e) => toggleFavorite(e, doc.id, !!doc.is_favorite)}
                            className={`p-1 bg-white/80 backdrop-blur rounded transition-opacity ${doc.is_favorite ? 'text-yellow-400 opacity-100' : 'text-gray-300 opacity-0 group-hover:opacity-100 hover:text-yellow-400'}`}
                          >
                            <Star size={16} fill={doc.is_favorite ? "currentColor" : "none"} />
                          </button>
                        </div>
                        
                        <Link href={`/editor/${doc.id}`} className="flex-1 flex flex-col items-center justify-center mb-2">
                          <div className={`p-4 rounded-2xl ${isSelected ? 'bg-blue-100 text-blue-600' : 'bg-gray-50 text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors'}`}>
                            <FileText size={40} strokeWidth={1.5} />
                          </div>
                        </Link>
                        
                        <div className="mt-auto pt-3 border-t border-gray-100/50 relative z-10">
                          {editingId === doc.id ? (
                            <input
                              autoFocus
                              className="border rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm mb-1"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onBlur={() => handleUpdateTitle(doc.id)}
                              onKeyDown={(e) => e.key === 'Enter' && handleUpdateTitle(doc.id)}
                            />
                          ) : (
                            <h3 
                              className="font-medium text-gray-900 text-sm truncate mb-1 cursor-pointer hover:text-blue-600" 
                              title={doc.title}
                              onDoubleClick={(e) => {
                                e.stopPropagation()
                                e.preventDefault()
                                setEditingId(doc.id)
                                setEditingTitle(doc.title)
                              }}
                            >
                              <Link href={`/editor/${doc.id}`}>{doc.title}</Link>
                            </h3>
                          )}
                          <p className="text-xs text-gray-500">
                            {new Date(doc.updated_at).toLocaleDateString('ko-KR')}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              </>
            )}
          </ErrorBoundary>
        )}
      </div>
          </main>
        </div>
      </div>

      {openFolderMenuId && (
        <div 
          className="fixed bg-white border rounded shadow-xl z-50 py-1 w-28"
          style={{ top: folderMenuPosition.top, left: folderMenuPosition.left }}
        >
          {folders.find(f => f.id === openFolderMenuId) && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  const folder = folders.find(f => f.id === openFolderMenuId)!
                  setEditingFolderId(folder.id)
                  setEditingFolderName(folder.name)
                  setOpenFolderMenuId(null)
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              >
                <Edit2 size={12} />
                이름 변경
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteFolder(openFolderMenuId)
                  setOpenFolderMenuId(null)
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 size={12} />
                삭제
              </button>
            </>
          )}
        </div>
      )}

      {/* Move Document Modal */}
      {isMoveModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b flex items-center justify-between bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">문서 이동</h3>
              <button 
                onClick={() => {
                  setIsMoveModalOpen(false)
                  setMovingDocId(null)
                }}
                className="p-1 hover:bg-gray-200 rounded-md transition-colors text-gray-500"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <div className="space-y-1">
                <button
                  onClick={() => handleMoveDocument(null)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <FileText size={18} className="text-gray-400" />
                  모든 문서 (최상위)
                  {movingDocId !== 'bulk' && documents.find(d => d.id === movingDocId)?.folder_id === null && (
                    <Check size={16} className="ml-auto text-blue-600" />
                  )}
                </button>
                
                {folders.map(folder => (
                  <button
                    key={folder.id}
                    onClick={() => handleMoveDocument(folder.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <Folder size={18} className="text-blue-400" />
                    <span className="truncate">{folder.name}</span>
                    {movingDocId !== 'bulk' && documents.find(d => d.id === movingDocId)?.folder_id === folder.id && (
                      <Check size={16} className="ml-auto text-blue-600" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

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