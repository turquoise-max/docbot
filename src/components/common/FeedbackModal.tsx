'use client'

import React, { useState } from 'react'
import { X, Upload, Check } from 'lucide-react'

interface FeedbackModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const [type, setType] = useState('bug')
  const [content, setContent] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  if (!isOpen) return null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('5MB 이하의 파일만 업로드 가능합니다.')
        return
      }
      setFileName(file.name)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) {
      alert('내용을 입력해주세요.')
      return
    }

    setIsSubmitting(true)
    
    // 임시 UI용 딜레이
    setTimeout(() => {
      setIsSubmitting(false)
      setIsSuccess(true)
      
      setTimeout(() => {
        setIsSuccess(false)
        setType('bug')
        setContent('')
        setFileName(null)
        onClose()
      }, 2000)
    }, 1000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">의견 보내기</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:bg-gray-100 p-1 rounded-md transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {isSuccess ? (
          <div className="p-8 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
              <Check size={24} />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">소중한 의견 감사합니다</h3>
              <p className="text-sm text-gray-500 mt-1">보내주신 의견을 적극 검토하겠습니다.</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <p className="text-sm text-gray-600">
              버그 제보나 기능 제안 등 소중한 의견을 남겨주세요.
            </p>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">유형</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="bug">버그 리포트</option>
                <option value="feature">기능 제안</option>
                <option value="other">기타 의견</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">내용</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="내용을 자세히 적어주시면 큰 도움이 됩니다."
                rows={4}
                className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">스크린샷 (선택)</label>
              <div className="relative border border-dashed border-gray-300 rounded-md p-4 text-center hover:bg-gray-50 transition-colors">
                <input
                  type="file"
                  accept="image/png, image/jpeg"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center space-y-2 text-gray-500">
                  <Upload size={20} />
                  <span className="text-sm">
                    {fileName ? fileName : '클릭하여 이미지 업로드'}
                  </span>
                  <span className="text-xs text-gray-400">5MB 이하 (PNG, JPG)</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50"
              >
                {isSubmitting ? '보내는 중...' : '보내기'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}