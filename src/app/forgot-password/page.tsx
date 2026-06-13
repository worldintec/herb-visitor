"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, KeyRound } from "lucide-react"

export default function ForgotPasswordPage() {
  const [userId, setUserId] = useState("")
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const idValid = /^[a-zA-Z0-9]{8,16}$/.test(userId)
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, email }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || "処理に失敗しました")
        setSubmitting(false)
        return
      }
      setDone(true)
    } catch {
      setError("通信エラーが発生しました")
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-dvh">
      <div className="hero-gradient px-5 pt-10 pb-6 rounded-b-3xl">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-white/80 text-sm mb-3"
        >
          <ArrowLeft size={18} />
          ログインに戻る
        </Link>
        <div className="flex items-center gap-2 mb-2">
          <KeyRound size={20} className="text-white" />
          <h1 className="text-xl font-bold text-white">IDまたはパスワードをお忘れの方</h1>
        </div>
        <p className="text-white/80 text-sm">
          登録したIDとメールアドレスを入力してください。再設定用のリンクをお送りします。
        </p>
      </div>

      <div className="px-4 py-6">
        {done ? (
          <div className="bg-white rounded-2xl p-5 shadow-sm text-center space-y-4">
            <p className="text-herb-text font-semibold">送信完了</p>
            <p className="text-sm text-herb-text-secondary">
              入力されたメールアドレス宛に再設定リンクを送信しました。<br />
              メールをご確認ください（有効期限：1時間）。
            </p>
            <Link
              href="/login"
              className="inline-block mt-2 text-herb-primary text-sm font-medium"
            >
              ログイン画面に戻る
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl p-5 shadow-sm space-y-4"
          >
            <div>
              <label className="block text-xs font-medium text-herb-text-secondary mb-1">
                ID（英数字8〜16文字）
              </label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value.trim())}
                autoComplete="username"
                maxLength={16}
                className="w-full h-10 rounded-lg border border-herb-border bg-white px-3 text-sm outline-none focus:border-herb-primary"
                placeholder="例: user1234"
              />
              {userId && !idValid && (
                <p className="text-xs text-red-500 mt-1">IDは英数字8〜16文字で入力してください</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-herb-text-secondary mb-1">
                メールアドレス
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value.trim())}
                autoComplete="email"
                className="w-full h-10 rounded-lg border border-herb-border bg-white px-3 text-sm outline-none focus:border-herb-primary"
                placeholder="例: example@example.com"
              />
              {email && !emailValid && (
                <p className="text-xs text-red-500 mt-1">メールアドレスの形式が正しくありません</p>
              )}
            </div>

            {error && (
              <p className="text-red-500 text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting || !idValid || !emailValid}
              className="w-full h-11 rounded-full bg-herb-primary text-white font-semibold text-sm disabled:opacity-50"
            >
              {submitting ? "送信中..." : "再設定リンクを送信"}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
