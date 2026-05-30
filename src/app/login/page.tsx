"use client"

import { Suspense, useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { LogIn } from "lucide-react"

// ========== 背景スライドショー ==========

interface BloomPhoto {
  id: number
  plant_name: string
  url: string
}

function BackgroundSlideshow() {
  const [photos, setPhotos] = useState<BloomPhoto[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [nextIndex, setNextIndex] = useState<number | null>(null)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    fetch("/api/bloom-photos")
      .then((r) => r.json())
      .then(({ photos: data }: { photos: BloomPhoto[] }) => {
        if (data && data.length > 0) {
          // シャッフルして開始
          const shuffled = [...data].sort(() => Math.random() - 0.5)
          setPhotos(shuffled)
          setCurrentIndex(0)
        }
      })
      .catch(() => {/* 写真取得失敗は無視 */})
  }, [])

  const advance = useCallback(() => {
    if (photos.length < 2) return
    const next = (currentIndex + 1) % photos.length
    setNextIndex(next)
    setFading(true)
    // フェード完了後に切り替え
    setTimeout(() => {
      setCurrentIndex(next)
      setNextIndex(null)
      setFading(false)
    }, 1000)
  }, [photos.length, currentIndex])

  useEffect(() => {
    if (photos.length < 2) return
    const timer = setInterval(advance, 7000)
    return () => clearInterval(timer)
  }, [photos.length, advance])

  if (photos.length === 0) {
    // 写真なし：グラデーション背景
    return <div className="fixed inset-0 hero-gradient" />
  }

  const current = photos[currentIndex]
  const next = nextIndex !== null ? photos[nextIndex] : null

  return (
    <div className="fixed inset-0 overflow-hidden hero-gradient">
      {/* 現在の写真 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={current.url}
        src={current.url}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        onError={(e) => { e.currentTarget.style.display = "none" }}
      />
      {/* 次の写真（フェードイン） */}
      {next && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={next.url}
          src={next.url}
          alt=""
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
          style={{ opacity: fading ? 1 : 0 }}
          onError={(e) => { e.currentTarget.style.display = "none" }}
        />
      )}
      {/* 半透明オーバーレイ */}
      <div className="absolute inset-0 bg-black/45" />
    </div>
  )
}

// ========== ログインページ ==========

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh hero-gradient" />}>
      <BackgroundSlideshow />
      <LoginPageInner />
    </Suspense>
  )
}

function LoginPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get("redirect") || "/"
  const [userId, setUserId] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, password }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || "ログインに失敗しました")
        setSubmitting(false)
        return
      }
      router.push(redirect)
      router.refresh()
    } catch {
      setError("通信エラーが発生しました")
      setSubmitting(false)
    }
  }

  const idValid = /^[a-zA-Z0-9]{8}$/.test(userId)
  const pwValid = /^[a-zA-Z0-9]{8}$/.test(password)

  return (
    <div className="relative min-h-dvh flex flex-col items-center justify-center px-5 pt-28 pb-12">
      {/* ロゴ・タイトル */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 mb-3">
          <LogIn size={22} className="text-white" />
          <h1 className="text-2xl font-bold text-white tracking-wide">
            Harbvisitor
          </h1>
        </div>
        <p className="text-white/75 text-sm">
          見沼氷川公園 ハーブ園 来園者アプリ
        </p>
      </div>

      {/* フォームカード */}
      <div className="w-full max-w-sm">
        <form
          onSubmit={handleSubmit}
          className="bg-white/90 backdrop-blur-md rounded-2xl p-6 shadow-2xl space-y-4"
        >
          <h2 className="text-base font-semibold text-herb-text text-center mb-1">
            ログイン
          </h2>

          <div>
            <label className="block text-xs font-medium text-herb-text-secondary mb-1">
              ID（英数字8桁）
            </label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value.trim())}
              autoComplete="username"
              maxLength={8}
              className="w-full h-10 rounded-lg border border-herb-border bg-white px-3 text-sm outline-none focus:border-herb-primary"
              placeholder="例: user1234"
            />
            {userId && !idValid && (
              <p className="text-xs text-red-500 mt-1">
                IDは英数字8桁で入力してください
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-herb-text-secondary mb-1">
              パスワード（英数字8桁）
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              maxLength={8}
              className="w-full h-10 rounded-lg border border-herb-border bg-white px-3 text-sm outline-none focus:border-herb-primary"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !idValid || !pwValid}
            className="w-full h-11 rounded-full bg-herb-primary text-white font-semibold text-sm disabled:opacity-50"
          >
            {submitting ? "ログイン中..." : "ログイン"}
          </button>

          <p className="text-center text-xs text-herb-text-secondary">
            アカウントをお持ちでない方は{" "}
            <Link
              href={`/register${redirect !== "/" ? `?redirect=${redirect}` : ""}`}
              className="text-herb-primary font-medium"
            >
              新規登録
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
