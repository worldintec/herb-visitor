"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { UserPlus, ArrowLeft } from "lucide-react"
import { TERMS_TEXT, TERMS_VERSION } from "@/lib/terms"

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <RegisterPageInner />
    </Suspense>
  )
}

function RegisterPageInner() {
  const searchParams = useSearchParams()
  const redirect = searchParams.get("redirect") || "/"
  const [userId, setUserId] = useState("")
  const [password, setPassword] = useState("")
  const [passwordConfirm, setPasswordConfirm] = useState("")
  const [tosAgreed, setTosAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const idValid = /^[a-zA-Z0-9]{8,16}$/.test(userId)
  const pwValid = /^[a-zA-Z0-9]{8,16}$/.test(password)
  const matchValid = password === passwordConfirm && password.length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!idValid || !pwValid || !matchValid) return
    if (!tosAgreed) {
      setError("利用規約への同意が必要です")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, password, tosAgreed: true, tosVersion: TERMS_VERSION }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || "登録に失敗しました")
        setSubmitting(false)
        return
      }
      // router.push はCookie反映前にRSCリクエストを発行するレースが発生し、
      // 登録直後の画面遷移が固まったように見える原因になるためフルページ遷移にする
      window.location.href = redirect
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
          <UserPlus size={20} className="text-white" />
          <h1 className="text-xl font-bold text-white">新規登録</h1>
        </div>
        <p className="text-white/80 text-sm">
          メールアドレスは不要。IDとパスワード（英数字8〜16文字）のみで登録できます。
        </p>
      </div>

      <div className="px-4 py-6">
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
              パスワード（英数字8〜16文字）
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              maxLength={16}
              className="w-full h-10 rounded-lg border border-herb-border bg-white px-3 text-sm outline-none focus:border-herb-primary"
            />
            {password && !pwValid && (
              <p className="text-xs text-red-500 mt-1">パスワードは英数字8〜16文字で入力してください</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-herb-text-secondary mb-1">
              パスワード（確認）
            </label>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              autoComplete="new-password"
              maxLength={16}
              className="w-full h-10 rounded-lg border border-herb-border bg-white px-3 text-sm outline-none focus:border-herb-primary"
            />
            {passwordConfirm && !matchValid && (
              <p className="text-xs text-red-500 mt-1">パスワードが一致しません</p>
            )}
          </div>

          {/* 利用規約 */}
          <div>
            <label className="block text-xs font-medium text-herb-text-secondary mb-1">
              利用規約
            </label>
            <div className="max-h-48 overflow-y-auto border border-herb-border rounded-lg p-3 text-xs text-herb-text leading-relaxed whitespace-pre-wrap bg-green-50/30">
              {TERMS_TEXT}
            </div>
            <label className="flex items-start gap-2 mt-3 cursor-pointer">
              <input
                type="checkbox"
                checked={tosAgreed}
                onChange={(e) => setTosAgreed(e.target.checked)}
                className="mt-0.5 size-4 accent-herb-primary"
              />
              <span className="text-xs text-herb-text">
                上記の利用規約を読み、内容に同意します。
              </span>
            </label>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !idValid || !pwValid || !matchValid || !tosAgreed}
            className="w-full h-11 rounded-full bg-herb-primary text-white font-semibold text-sm disabled:opacity-50"
          >
            {submitting ? "登録中..." : "登録する"}
          </button>

          <p className="text-center text-xs text-herb-text-secondary">
            既にアカウントをお持ちの方は{" "}
            <Link href={`/login${redirect !== "/" ? `?redirect=${redirect}` : ""}`} className="text-herb-primary font-medium">
              ログイン
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
