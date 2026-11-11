"use client"

import { useState, useEffect } from "react"
import { KeyRound } from "lucide-react"
import { toLogin } from "@/lib/login-redirect"

export default function ChangePasswordPage() {
  const [checking, setChecking] = useState(true)
  // いまのパスワード＝職員から受け取った仮パスワード（サーバーで照合する。B-1 #11）
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(({ user }) => {
        if (!user) {
          toLogin()
          return
        }
        setChecking(false)
      })
      .catch(() => setChecking(false))
  }, [])

  const pwValid = /^[a-zA-Z0-9]{8,16}$/.test(newPassword)
  const matchValid = newPassword === newPasswordConfirm && newPassword.length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      if (res.status === 401) {
        toLogin()
        return
      }
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || "処理に失敗しました")
        setSubmitting(false)
        return
      }
      window.location.href = "/"
    } catch {
      setError("通信エラーが発生しました")
      setSubmitting(false)
    }
  }

  if (checking) {
    return <div className="min-h-dvh" />
  }

  return (
    <div className="min-h-dvh">
      <div className="hero-gradient px-5 pt-10 pb-6 rounded-b-3xl">
        <div className="flex items-center gap-2 mb-2">
          <KeyRound size={20} className="text-white" />
          <h1 className="text-xl font-bold text-white">新しいパスワードの設定</h1>
        </div>
        <p className="text-white/80 text-sm">
          仮パスワードでのログインが完了しました。続けて新しいパスワードを設定してください。
        </p>
      </div>

      <div className="px-4 py-6">
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl p-5 shadow-sm space-y-4"
        >
          <div>
            <label htmlFor="current-password" className="block text-xs font-medium text-herb-text-secondary mb-1">
              いまのパスワード（職員から受け取った仮パスワード）
            </label>
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              maxLength={64}
              className="w-full h-10 rounded-lg border border-herb-border bg-white px-3 text-sm outline-none focus:border-herb-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-herb-text-secondary mb-1">
              新しいパスワード（英数字8〜16文字）
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              maxLength={16}
              className="w-full h-10 rounded-lg border border-herb-border bg-white px-3 text-sm outline-none focus:border-herb-primary"
            />
            {newPassword && !pwValid && (
              <p className="text-xs text-red-500 mt-1">パスワードは英数字8〜16文字で入力してください</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-herb-text-secondary mb-1">
              新しいパスワード（確認）
            </label>
            <input
              type="password"
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              autoComplete="new-password"
              maxLength={16}
              className="w-full h-10 rounded-lg border border-herb-border bg-white px-3 text-sm outline-none focus:border-herb-primary"
            />
            {newPasswordConfirm && !matchValid && (
              <p className="text-xs text-red-500 mt-1">パスワードが一致しません</p>
            )}
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !currentPassword || !pwValid || !matchValid}
            className="w-full h-11 rounded-full bg-herb-primary text-white font-semibold text-sm disabled:opacity-50"
          >
            {submitting ? "更新中..." : "パスワードを更新する"}
          </button>
        </form>
      </div>
    </div>
  )
}
