"use client"

import { use } from "react"
import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  Scissors,
  Bus,
  AlertTriangle,
  ShoppingBag,
  Truck,
} from "lucide-react"
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

export default function NewsDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const item = newsList.find((n) => n.id === id)
  if (!item) notFound()

  const { content } = item

  return (
    <div className="min-h-dvh">
      {/* ヘッダー */}
      <div className="hero-gradient px-5 pt-10 pb-6 rounded-b-3xl">
        <Link
          href="/news"
          className="inline-flex items-center gap-1 text-white/80 text-sm mb-3"
        >
          <ArrowLeft size={18} />
          お知らせ一覧
        </Link>
        <div className="flex items-center gap-2 mb-2">
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              CATEGORY_COLOR[item.category] ?? "bg-green-100 text-herb-primary"
            }`}
          >
            {item.category}
          </span>
          <span className="flex items-center gap-1 text-white/70 text-xs">
            <Calendar size={11} />
            {formatDate(item.publishedAt)}
          </span>
        </div>
        <h1 className="text-lg font-bold text-white leading-snug">{item.title}</h1>
      </div>

      <div className="px-4 py-5 space-y-4">
        {/* フライヤー画像スロット */}
        {item.imagePath ? (
          <div className="rounded-2xl overflow-hidden shadow-sm">
            <Image
              src={`/images/news/${item.imagePath}`}
              alt={item.title}
              width={600}
              height={400}
              className="w-full object-cover"
            />
          </div>
        ) : null}

        {/* キャッチコピー */}
        {content.catchCopy && (
          <div className="bg-green-50 border border-herb-border rounded-2xl px-4 py-3">
            <p className="text-sm font-medium text-herb-text leading-relaxed">
              {content.catchCopy}
            </p>
          </div>
        )}

        {/* 開催情報 */}
        {(content.eventDate || content.venue) && (
          <div className="bg-white rounded-2xl shadow-sm divide-y divide-herb-border overflow-hidden">
            {content.eventDate && (
              <div className="flex items-start gap-3 px-4 py-3">
                <Calendar size={16} className="text-herb-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-herb-text-secondary mb-0.5">日時</p>
                  <p className="text-sm font-semibold text-herb-text">{content.eventDate}</p>
                </div>
              </div>
            )}

            {/* 荒天延期（警告表示） */}
            {content.eventDateRain && (
              <div className="flex items-start gap-3 px-4 py-3 bg-amber-50">
                <AlertTriangle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-amber-600 font-semibold mb-0.5">荒天時の対応</p>
                  <p className="text-sm text-amber-700">{content.eventDateRain}</p>
                </div>
              </div>
            )}

            {content.venue && (
              <div className="flex items-start gap-3 px-4 py-3">
                <MapPin size={16} className="text-herb-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-herb-text-secondary mb-0.5">会場</p>
                  <p className="text-sm font-semibold text-herb-text">{content.venue}</p>
                </div>
              </div>
            )}

            {content.organizer && content.organizer.length > 0 && (
              <div className="flex items-start gap-3 px-4 py-3">
                <Users size={16} className="text-herb-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-herb-text-secondary mb-0.5">主催・共催</p>
                  {content.organizer.map((org, i) => (
                    <p key={i} className="text-sm text-herb-text leading-relaxed">
                      {org}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ワークショップ */}
        {content.workshops && content.workshops.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-herb-border">
              <Scissors size={16} className="text-herb-primary" />
              <h2 className="text-sm font-bold text-herb-text">ワークショップ</h2>
            </div>
            <div className="divide-y divide-herb-border">
              {content.workshops.map((ws, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3">
                  <p className="text-sm text-herb-text">{ws.name}</p>
                  {ws.price !== undefined && (
                    <span className="text-sm font-semibold text-herb-primary">
                      各 {ws.price.toLocaleString()}円
                    </span>
                  )}
                </div>
              ))}
            </div>
            {content.extras && content.extras.map((ex, i) => (
              <div key={i} className="flex items-center gap-2 px-4 py-3 border-t border-herb-border bg-green-50">
                <ShoppingBag size={14} className="text-herb-primary flex-shrink-0" />
                <p className="text-xs text-herb-text">{ex}</p>
              </div>
            ))}
          </div>
        )}

        {/* キッチンカー */}
        {content.kitchenCars && (
          <div className="flex items-center gap-3 bg-white rounded-2xl shadow-sm px-4 py-3">
            <Truck size={16} className="text-herb-primary flex-shrink-0" />
            <p className="text-sm text-herb-text">キッチンカー出店予定</p>
          </div>
        )}

        {/* アクセス */}
        {content.access && content.access.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-herb-border">
              <Bus size={16} className="text-herb-primary" />
              <h2 className="text-sm font-bold text-herb-text">アクセス</h2>
            </div>
            <p className="px-4 pt-3 text-xs text-herb-text-secondary">
              公共交通機関でのご来園にご協力ください
            </p>
            <div className="divide-y divide-herb-border">
              {content.access.map((ac, i) => (
                <div key={i} className="px-4 py-3">
                  <p className="text-xs font-semibold text-herb-text mb-1">{ac.from}</p>
                  <p className="text-xs text-herb-text-secondary">
                    {ac.route}　{ac.stop}下車　{ac.walk}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 本文（汎用） */}
        {content.body && (
          <div className="bg-white rounded-2xl shadow-sm px-4 py-4">
            <p className="text-sm text-herb-text leading-relaxed whitespace-pre-wrap">
              {content.body}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
