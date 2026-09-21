"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { User, KeyRound, Bell, LogOut, ChevronRight } from "lucide-react"
import { toLogin } from "@/lib/login-redirect"

export default function MyPage() {
  const [userCode, setUserCode] = useState<string | null>(null)
  const [confirmingLogout, setConfirmingLogout] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(({ user }) => {
        if (!user) {
          toLogin()
          return
        }
        setUserCode(user.userCode)
      })
      .catch(() => {})
  }, [])

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch {
      // 通信失敗時もリダイレクトは行う
    }
    // 自分でログアウトした場合は戻る先を引き継がない（?redirect= を付けない）
    window.location.href = "/login"
  }

  return (
    <div className="min-h-dvh">
      <div className="hero-gradient px-5 pt-10 pb-6 rounded-b-3xl">
        <div className="flex items-center gap-2 mb-2">
          <User size={20} className="text-white" />
          <h1 className="text-xl font-bold text-white">マイページ</h1>
        </div>
        <p className="text-white/80 text-sm">
          ログイン中のアカウント: {userCode ?? "…"}
        </p>
      </div>

      <div className="px-4 py-6 space-y-4">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-herb-border">
          <Link
            href="/my-page/password"
            className="flex items-center gap-4 min-h-[64px] px-5 py-5 active:bg-herb-primary/5"
          >
            <KeyRound size={22} className="text-herb-primary flex-shrink-0" />
            <span className="flex-1 text-base font-medium text-herb-text">パスワード変更</span>
            <ChevronRight size={20} className="text-herb-text-secondary/50 flex-shrink-0" />
          </Link>

          <Link
            href="/my-page/notifications"
            className="flex items-center gap-4 min-h-[64px] px-5 py-5 active:bg-herb-primary/5"
          >
            <Bell size={22} className="text-herb-primary flex-shrink-0" />
            <span className="flex-1 text-base font-medium text-herb-text">通知設定</span>
            <ChevronRight size={20} className="text-herb-text-secondary/50 flex-shrink-0" />
          </Link>

          {!confirmingLogout ? (
            <button
              type="button"
              onClick={() => setConfirmingLogout(true)}
              className="w-full flex items-center gap-4 min-h-[64px] px-5 py-5 active:bg-herb-primary/5 text-left"
            >
              <LogOut size={22} className="text-red-500 flex-shrink-0" />
              <span className="flex-1 text-base font-medium text-red-500">ログアウト</span>
            </button>
          ) : (
            <div className="px-5 py-5 space-y-4">
              <p className="text-sm text-herb-text">本当にログアウトしますか？</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmingLogout(false)}
                  disabled={loggingOut}
                  className="flex-1 h-12 rounded-full border border-herb-border text-sm font-medium text-herb-text-secondary disabled:opacity-50"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="flex-1 h-12 rounded-full bg-red-500 text-white text-sm font-semibold disabled:opacity-50"
                >
                  {loggingOut ? "処理中..." : "ログアウトする"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
