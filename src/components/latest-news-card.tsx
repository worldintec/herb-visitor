"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Bell, Calendar, ChevronRight } from "lucide-react"
import { mapNewsRowToItem, type NewsItem, type NewsRow } from "@/data/news"
import { isNewsImagePath, newsImageUrl } from "@/lib/news-image"

// カテゴリの色と日付の書き方は、お知らせの一覧（app/news/page.tsx）と同じ
const CATEGORY_COLOR: Record<string, string> = {
  "イベント": "bg-amber-100 text-amber-600",
  "お知らせ": "bg-sky-100 text-sky-500",
  "更新情報": "bg-green-100 text-herb-primary",
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-")
  return `${y}年${parseInt(m)}月${parseInt(d)}日`
}

type State =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error" }
  | { status: "ready"; item: NewsItem }

/**
 * ホームの「最新のお知らせ」。公開済みのお知らせのうち、いちばん新しい1件だけを出す。
 *
 * 読み込み中・0件・取得の失敗を分ける。
 *   読み込み中 … 枠の形だけ（薄い四角）
 *   0件       … 何も出さない（空の枠は間延びする）
 *   失敗      … 1行だけ知らせる。ホームのほかの部分はそのまま使える
 */
export default function LatestNewsCard() {
  const [state, setState] = useState<State>({ status: "loading" })

  useEffect(() => {
    let cancelled = false
    fetch("/api/news")
      .then(async (r) => {
        if (!r.ok) throw new Error(`status=${r.status}`)
        const { news }: { news?: NewsRow[] } = await r.json()
        // API は公開済みだけを公開日の新しい順で返す。一覧の画面と同じく、念のためここでも並べ直す
        const items = (news ?? [])
          .map(mapNewsRowToItem)
          .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
        if (cancelled) return
        setState(items.length > 0 ? { status: "ready", item: items[0] } : { status: "empty" })
      })
      .catch((err) => {
        console.error("[home] お知らせの取得に失敗しました", err)
        if (!cancelled) setState({ status: "error" })
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (state.status === "empty") return null

  return (
    <section className="px-4 mt-4" aria-label="最新のお知らせ">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-base font-bold flex items-center gap-1.5">
          <Bell size={16} className="text-herb-primary" />
          お知らせ
        </h2>
        <Link href="/news" className="text-xs text-herb-primary font-medium flex items-center gap-0.5">
          すべて見る <ChevronRight size={14} />
        </Link>
      </div>

      {state.status === "loading" && (
        <div className="bg-white rounded-2xl p-3.5 shadow-sm animate-pulse" aria-hidden>
          <div className="h-3 bg-green-100 rounded w-1/3 mb-2" />
          <div className="h-4 bg-green-50 rounded w-4/5" />
        </div>
      )}

      {state.status === "error" && (
        <p className="text-xs text-herb-text-secondary bg-white rounded-2xl px-3.5 py-3 shadow-sm">
          お知らせを読み込めませんでした。
        </p>
      )}

      {state.status === "ready" && (
        <Link
          href={`/news/${state.item.id}`}
          className="flex items-center gap-3 bg-white rounded-2xl p-3.5 shadow-sm active:scale-[0.98] transition-transform"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-sm ${
                  CATEGORY_COLOR[state.item.category] ?? "bg-green-100 text-herb-primary"
                }`}
              >
                {state.item.category}
              </span>
              <span className="flex items-center gap-0.5 text-[10px] text-herb-text-secondary">
                <Calendar size={10} />
                {formatDate(state.item.publishedAt)}
              </span>
            </div>
            <p className="font-semibold text-sm leading-snug text-herb-text line-clamp-2">
              {state.item.title}
            </p>
            {state.item.summary?.trim() && (
              <p className="text-xs text-herb-text-secondary mt-0.5 truncate">{state.item.summary}</p>
            )}
          </div>
          {/* 画像が付いていれば小さく添える。news/ 以下のパスだけを使う */}
          {state.item.imagePath && isNewsImagePath(state.item.imagePath) && (
            <div className="relative w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-green-50">
              <Image
                src={newsImageUrl(state.item.imagePath)}
                alt=""
                fill
                sizes="56px"
                className="object-cover"
              />
            </div>
          )}
          <ChevronRight size={16} className="flex-shrink-0 text-herb-text-secondary/50" />
        </Link>
      )}
    </section>
  )
}
