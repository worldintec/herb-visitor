"use client"

import { X } from "lucide-react"

// 画面下に出す知らせの帯。見た目は herb-garden の帯（巡回記録など）に揃えている。

export type BannerMessage = { type: "success" | "error"; text: string }

// 帯の位置。下部タブ（高さ 4rem＋pb-safe の 0.5rem＋安全領域）のすぐ上に出す。
// タブが無い画面で出しても、少し高い位置に出るだけで隠れない。
// 同じ画面のほかの帯（マイノートの写真の警告など）もこの位置に揃えること。
export const BANNER_POSITION =
  "fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-xl"

export default function MessageBanner({
  message,
  onClose,
}: {
  message: BannerMessage
  onClose: () => void
}) {
  return (
    <div
      role={message.type === "error" ? "alert" : "status"}
      className={`${BANNER_POSITION} shadow-lg px-3 py-2 rounded-lg text-sm flex items-center justify-between ${
        message.type === "error"
          ? "bg-red-50 border border-red-200 text-red-800"
          : "bg-green-50 border border-green-200 text-green-800"
      }`}
    >
      <span className="min-w-0 break-words">{message.text}</span>
      <button onClick={onClose} className="shrink-0 ml-2" aria-label="閉じる">
        <X className="size-4" />
      </button>
    </div>
  )
}
