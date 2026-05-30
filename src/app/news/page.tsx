"use client"

import Link from "next/link"
import { Bell, ChevronRight, Calendar } from "lucide-react"
import { newsList } from "@/data/news"

const CATEGORY_COLOR: Record<string, string> = {
  "イベント": "bg-amber-100 text-amber-600",
  "お知らせ": "bg-sky-100 text-sky-500",
  "更新情報": "bg-green-100 text-herb-primary",
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-")
  return `${y}年${parseInt(m)}月${parseInt(d)}日`
}

export default function NewsPage() {
  const sorted = [...newsList].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )

  return (
    <div className="min-h-dvh">
      {/* ヘッダー */}
      <div className="hero-gradient px-5 pt-10 pb-6 rounded-b-3xl">
        <div className="flex items-center gap-2 mb-1">
          <Bell size={20} className="text-white" />
          <h1 className="text-xl font-bold text-white">お知らせ</h1>
        </div>
        <p className="text-white/80 text-sm">イベント・更新情報をお届けします</p>
      </div>

      {/* 一覧 */}
      <div className="px-4 py-5 space-y-3">
        {sorted.length === 0 ? (
          <p className="text-center text-herb-text-secondary text-sm py-16">
            現在お知らせはありません
          </p>
        ) : (
          sorted.map((item) => (
            <Link
              key={item.id}
              href={`/news/${item.id}`}
              className="flex items-center gap-3 bg-white rounded-2xl p-4 shadow-sm active:scale-[0.98] transition-transform"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      CATEGORY_COLOR[item.category] ?? "bg-green-100 text-herb-primary"
                    }`}
                  >
                    {item.category}
                  </span>
                  <span className="flex items-center gap-0.5 text-[10px] text-herb-text-secondary">
                    <Calendar size={10} />
                    {formatDate(item.publishedAt)}
                  </span>
                </div>
                <p className="font-semibold text-sm leading-snug text-herb-text">
                  {item.title}
                </p>
                <p className="text-xs text-herb-text-secondary mt-1 line-clamp-2">
                  {item.summary}
                </p>
              </div>
              <ChevronRight size={16} className="flex-shrink-0 text-herb-text-secondary/50" />
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
