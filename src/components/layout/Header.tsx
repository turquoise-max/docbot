'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Lightbulb, User, Settings, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import FeedbackModal from '@/components/common/FeedbackModal'

interface HeaderProps {
  children?: React.ReactNode
}

export default function Header({ children }: HeaderProps) {
  const router = useRouter()
  const supabase = createClient()
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser(user)
      }
    }
    fetchUser()
  }, [supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleSettings = () => {
    setIsProfileOpen(false)
    // TODO: 설정 페이지 라우팅
    alert('설정 페이지는 준비 중입니다.')
  }

  return (
    <>
      <header className="h-16 border-b bg-white flex items-center justify-between px-4 flex-shrink-0 sticky top-0 z-10">
        <div className="flex-1 flex items-center">
          {children}
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group">
            <button
              onClick={() => setIsFeedbackOpen(true)}
              className="flex items-center justify-center w-8 h-8 text-gray-500 border border-gray-200 rounded-md hover:bg-yellow-50 hover:text-yellow-500 hover:border-yellow-200 transition-colors"
            >
              <Lightbulb size={16} />
            </button>
            {/* Custom Tooltip */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1.5 bg-gray-900 text-white text-xs font-medium rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
              개선제안
            </div>
          </div>

        <div className="relative">
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center hover:bg-blue-200 transition-colors"
          >
            <User size={16} />
          </button>

          {isProfileOpen && (
            <>
              <div 
                className="fixed inset-0 z-40"
                onClick={() => setIsProfileOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg border border-gray-100 py-1 z-50">
                {user && (
                  <div className="px-4 py-3 border-b border-gray-100 mb-1">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <User size={20} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold text-gray-900 truncate">
                          {user.user_metadata?.full_name || user.user_metadata?.name || '사용자'}
                        </span>
                        <span className="text-xs text-gray-500 truncate">
                          {user.email}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                <button
                  onClick={handleSettings}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Settings size={16} />
                  <span>내 정보 설정</span>
                </button>
                <div className="border-t my-1"></div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={16} />
                  <span>로그아웃</span>
                </button>
              </div>
            </>
          )}
        </div>
        </div>
      </header>

      <FeedbackModal 
        isOpen={isFeedbackOpen} 
        onClose={() => setIsFeedbackOpen(false)} 
      />
    </>
  )
}