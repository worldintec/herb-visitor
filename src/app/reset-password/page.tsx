"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { KeyRound } from "lucide-react"

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <ResetPasswordPageInner />
    </Suspense>
  )
}

function ResetPasswordPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token") || ""

  const [newUserId, setNewUserId] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const idValid = /^[a-zA-Z0-9]{8,16}$/.test(newUserId)
  const pwValid = /^[a-zA-Z0-9]{8,16}$/.test(newPassword)
  const matchValid = newPassword === newPasswordConfirm && newPassword.length > 0

  if (!token) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-5 text-center">
        <p className="text-herb-text mb-4">リンクが無効です。</p>
        <Link href="/forgot-password" className="text-herb-primary text-sm font-medium">
          再設定ページに戻る
        </Link>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newUserId, newPassword }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || "処理に失敗しました")
        setSubmitting(false)
        return
      }
      router.push("/login?reset=done")
    } catch {
      setError("通信エラーが発生しました")
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-dvh">
      <div className="hero-gradient px-5 pt-10 pb-6 rounded-b-3xl">
        <div className="flex items-center gap-2 mb-2">
          <KeyRound size={20} className="text-white" />
          <h1 className="text-xl font-bold text-white">IDとパスワードの再設定</h1>
        </div>
        <p className="text-white/80 text-sm">
          新しいIDとパスワードを入力してください。
        </p>
      </div>

      <div className="px-4 py-6">
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl p-5 shadow-sm space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-herb-text-secondary mb-1">
              新しいID（英数字8〜16文字）
            </label>
            <input
              type="text"
              value={newUserId}
              onChange={(e) => setNewUserId(e.target.value.trim())}
              autoComplete="username"
              maxLength={16}
              className="w-full h-10 rounded-lg border border-herb-border bg-white px-3 text-sm outline-none focus:border-herb-primary"
              placeholder="例: user1234"
            />
            {newUserId && !idValid && (
              <p className="text-xs text-red-500 mt-1">IDは英数字8〜16文字で入力してください</p>
            )}
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

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting || !idValid || !pwValid || !matchValid}
            className="w-full h-11 rounded-full bg-herb-primary text-white font-semibold text-sm disabled:opacity-50"
          >
            {submitting ? "更新中..." : "IDとパスワードを更新する"}
          </button>
        </form>
      </div>
    </div>
  )
}
