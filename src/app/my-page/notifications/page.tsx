"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Bell } from "lucide-react"

export default function MyPageNotificationsPage() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(({ user }) => {
        if (!user) {
          window.location.href = "/login"
          return
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-dvh">
      <div className="hero-gradient px-5 pt-10 pb-6 rounded-b-3xl">
        <Link
          href="/my-page"
          className="inline-flex items-center gap-1 text-white/80 text-sm mb-3"
        >
          <ArrowLeft size={18} />
          マイページに戻る
        </Link>
        <div className="flex items-center gap-2 mb-2">
          <Bell size={20} className="text-white" />
          <h1 className="text-xl font-bold text-white">通知設定</h1>
        </div>
      </div>

      <div className="px-4 py-6">
        {loading ? (
          <div className="bg-white rounded-2xl p-5 shadow-sm h-16 animate-pulse" />
        ) : (
          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
            <p className="text-sm font-medium text-herb-text">お知らせ通知</p>
            <p className="text-xs text-herb-text-secondary leading-relaxed">
              休園情報や見頃の案内など、ハーブ園からのお知らせをプッシュ通知でお届けします。
            </p>
            <p className="text-xs text-herb-text-secondary leading-relaxed">
              通知が不要な場合は、ご利用のブラウザの通知設定からこのサイトの通知をブロックしてください。
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
