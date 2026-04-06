import Link from 'next/link'
import { FileText, Upload, Plus } from 'lucide-react'

export default function TemplatesPage() {
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
        <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          <Plus size={20} />
          빈 문서로 시작
        </button>
      </div>

      <div className="mb-12">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 flex flex-col items-center justify-center text-center border-dashed cursor-pointer hover:bg-blue-100 transition-colors">
          <div className="bg-white p-3 rounded-full shadow-sm mb-4">
            <Upload className="text-blue-600" size={24} />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">커스텀 DOCX 파일 업로드</h3>
          <p className="text-sm text-gray-600 mb-4">
            사용하시던 워드 파일의 <span className="font-semibold text-blue-600">글꼴, 표, 여백 등 서식을 그대로 유지</span>하면서<br/>
            AI의 도움을 받아 문서를 편집할 수 있습니다.
          </p>
          <input type="file" accept=".docx" className="hidden" id="docx-upload" />
          <label htmlFor="docx-upload" className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 cursor-pointer transition-colors">
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