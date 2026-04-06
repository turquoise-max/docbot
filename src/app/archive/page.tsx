import Link from 'next/link'
import { Folder, FileText, Download, MoreVertical, ChevronRight, Search } from 'lucide-react'

export default function ArchivePage() {
  const dummyDocuments = [
    { id: '1', title: '2024년 1분기 사업계획서_v2', folder: '사업계획', updatedAt: '2024-03-15' },
    { id: '2', title: '신규 서비스 런칭 제안서', folder: '제안서', updatedAt: '2024-03-14' },
    { id: '3', title: '주간 운영 보고 (3월 2주차)', folder: '보고서', updatedAt: '2024-03-10' },
  ]

  const dummyFolders = [
    { id: 'f1', name: '사업계획', count: 3 },
    { id: 'f2', name: '제안서', count: 5 },
    { id: 'f3', name: '보고서', count: 12 },
    { id: 'f4', name: '회의록', count: 8 },
  ]

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar: Folder Tree */}
      <div className="w-64 border-r bg-gray-50 flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-bold text-gray-800">보관함</h2>
        </div>
        <div className="p-2">
          <button className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 text-sm text-gray-700 flex items-center gap-2 font-medium">
            <Folder size={16} className="text-gray-400" />
            모든 문서
          </button>
          <div className="mt-4">
            <p className="px-3 text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">폴더</p>
            <div className="space-y-1">
              {dummyFolders.map(folder => (
                <button key={folder.id} className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 text-sm text-gray-700 flex items-center justify-between group">
                  <div className="flex items-center gap-2">
                    <ChevronRight size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Folder size={16} className="text-blue-500" />
                    <span className="truncate">{folder.name}</span>
                  </div>
                  <span className="text-xs text-gray-400">{folder.count}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: Document List */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="relative w-96">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="문서 검색..." 
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <Link href="/templates" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            새 문서 작성
          </Link>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">모든 문서</h1>
            <span className="text-sm text-gray-500">총 {dummyDocuments.length}개</span>
          </div>

          <div className="bg-white border rounded-lg shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b bg-gray-50 text-sm text-gray-500">
                  <th className="px-6 py-3 font-medium">제목</th>
                  <th className="px-6 py-3 font-medium w-32">위치</th>
                  <th className="px-6 py-3 font-medium w-40">최종 수정일</th>
                  <th className="px-6 py-3 font-medium w-24 text-center">액션</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {dummyDocuments.map(doc => (
                  <tr key={doc.id} className="border-b hover:bg-gray-50 group transition-colors">
                    <td className="px-6 py-4">
                      <Link href={`/editor/${doc.id}`} className="flex items-center gap-3 font-medium text-gray-900 hover:text-blue-600">
                        <FileText size={18} className="text-blue-500" />
                        {doc.title}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      <span className="bg-gray-100 px-2 py-1 rounded text-xs">{doc.folder}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{doc.updatedAt}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded" title="DOCX 다운로드">
                          <Download size={16} />
                        </button>
                        <button className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-200 rounded">
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}