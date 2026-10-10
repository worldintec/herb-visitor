"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, UserX, CheckCircle2 } from "lucide-react"
import { toLogin } from "@/lib/login-redirect"

/** 退会後に表示する完了画面の文面。通知の解除に失敗したときだけ出す。 */
const PUSH_LEFTOVER_MESSAGE =
  "退会しました。お使いの端末の通知設定から、このサイトの通知をオフにしてください。"

export default function MyPageWithdrawPage() {
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pushLeftover, setPushLeftover] = useState(false)

  // 消えるものの件数。null は「まだ取得できていない／取得に失敗した」。
  const [noteCount, setNoteCount] = useState<number | null>(null)
  const [photoCount, setPhotoCount] = useState<number | null>(null)

  useEffect(() => {
    // 件数は既存の一覧APIから数える。専用のAPIは作らない。
    fetch("/api/visitor-notes")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!json?.notes) return
        const notes = json.notes as { photo_path: string | null }[]
        setNoteCount(notes.length)
        setPhotoCount(notes.filter((n) => n.photo_path).length)
      })
      .catch(() => {})
  }, [])

  const deletionSummary = () => {
    if (noteCount === null || photoCount === null) {
      return "保存されているマイノートと写真のすべて（件数を取得できませんでした）"
    }
    if (noteCount === 0) {
      return "保存されているマイノートはありません"
    }
    if (photoCount === 0) {
      return `マイノート${noteCount}件`
    }
    return `マイノート${noteCount}件と、保存された写真${photoCount}枚`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    // 購読は「退会が成立したあと」に解除する。先に解除すると、退会が失敗したときに
    // 「退会していないのに通知だけ切れた」状態で取り残される。
    // ここでは endpoint を控えるだけで、解除はまだ行わない。
    let subscription: PushSubscription | null = null
    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.ready
        subscription = await reg.pushManager.getSubscription()
      }
    } catch {
      // 購読が取れなくても退会は進める（サーバー側では消せないので案内を出す）
    }

    let json: { error?: string; pushCleared?: boolean }
    let status: number
    try {
      const res = await fetch("/api/auth/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          pushEndpoint: subscription?.endpoint ?? null,
        }),
      })
      status = res.status
      json = await res.json()
    } catch {
      setError("通信エラーが発生しました")
      setSubmitting(false)
      return
    }

    if (status !== 200) {
      if (status === 401 && json.error === "unauthorized") {
        // セッションが切れている、またはすでに退会済み
        toLogin()
        return
      }
      setError(json.error || "処理に失敗しました")
      setSubmitting(false)
      return
    }

    // ここから先は退会が成立している。ページに留まらせない。
    if (!subscription) {
      // 購読が無かった＝通知の案内は不要
      window.location.href = "/login"
      return
    }

    let unsubscribed = false
    try {
      unsubscribed = await subscription.unsubscribe()
    } catch {
      unsubscribed = false
    }

    if (unsubscribed && json.pushCleared) {
      window.location.href = "/login"
      return
    }

    // 通知が止まらない可能性があるときだけ完了画面で止める。
    // 黙ってログイン画面へ飛ばすと案内を読む機会が無くなる。
    setPushLeftover(true)
  }

  if (pushLeftover) {
    return (
      <div className="min-h-dvh">
        <div className="hero-gradient px-5 pt-10 pb-6 rounded-b-3xl">
          <div className="flex items-center gap-2 mb-2">
            <UserX size={20} className="text-white" />
            <h1 className="text-xl font-bold text-white">退会</h1>
          </div>
        </div>

        <div className="px-4 py-6">
          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4 text-center">
            <CheckCircle2 size={36} className="text-herb-primary mx-auto" />
            <p className="text-sm text-herb-text leading-relaxed">
              {PUSH_LEFTOVER_MESSAGE}
            </p>
            <Link
              href="/login"
              className="block w-full h-11 rounded-full bg-herb-primary text-white font-semibold text-sm text-center leading-[44px]"
            >
              ログイン画面へ
            </Link>
          </div>
        </div>
      </div>
    )
  }

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
          <UserX size={20} className="text-white" />
          <h1 className="text-xl font-bold text-white">退会</h1>
        </div>
      </div>

      <div className="px-4 py-6 space-y-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
          <p className="text-sm font-medium text-herb-text">
            退会すると、次のデータが削除されます
          </p>
          <p className="text-sm text-herb-text-secondary leading-relaxed">
            {deletionSummary()}
          </p>
          <p className="text-xs text-herb-text-secondary leading-relaxed">
            一度退会すると、記録を元に戻すことはできません。
          </p>
          <p className="text-xs text-herb-text-secondary leading-relaxed">
            同じIDで登録し直すことはできますが、以前の記録は引き継がれません。
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl p-5 shadow-sm space-y-4"
        >
          <p className="text-sm text-herb-text leading-relaxed">
            ご本人の確認のため、パスワードを入力してください。
          </p>

          <div>
            <label className="block text-xs font-medium text-herb-text-secondary mb-1">
              パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              maxLength={16}
              className="w-full h-10 rounded-lg border border-herb-border bg-white px-3 text-sm outline-none focus:border-herb-primary"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !password}
            className="w-full h-11 rounded-full bg-red-500 text-white font-semibold text-sm disabled:opacity-50"
          >
            {submitting ? "処理中..." : "退会する"}
          </button>

          <Link
            href="/my-page"
            className="block text-center text-sm text-herb-text-secondary"
          >
            やめる
          </Link>
        </form>
      </div>
    </div>
  )
}
