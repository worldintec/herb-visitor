"use client"

import { X, Share, MoreVertical, Smartphone } from "lucide-react"
import type { MobilePlatform } from "@/lib/platform"

// 見出しと本文の既定。iPhone は通知に関心のない人にも出るので、通知を前提にしない書き出しにする
const DEFAULT_TEXT: Record<MobilePlatform, { title: string; description: string }> = {
  ios: {
    title: "ホーム画面に追加すると便利です",
    description:
      "ホーム画面に追加すると、アプリのようにすぐ開けます。iPhone でお知らせの通知を受け取るときも、追加してからアイコンで開き直す必要があります。",
  },
  android: {
    title: "ホーム画面に追加しませんか？",
    description: "ホーム画面に追加すると、アプリのようにすぐ開けて通知も受け取りやすくなります。",
  },
}

// 手順の番号
function StepNumber({ n }: { n: number }) {
  return (
    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-herb-primary text-white text-xs font-bold flex items-center justify-center">
      {n}
    </span>
  )
}

export default function AddToHomeScreenModal({
  platform,
  title,
  description,
  onClose,
}: {
  platform: MobilePlatform
  title?: string
  description?: string
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 px-4 pb-6 sm:pb-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
            <Smartphone size={20} className="text-herb-primary" />
          </div>
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="text-herb-text-secondary hover:text-herb-text p-1 -m-1"
          >
            <X size={18} />
          </button>
        </div>

        <div>
          <h2 className="text-base font-bold text-herb-text mb-1">
            {title ?? DEFAULT_TEXT[platform].title}
          </h2>
          <p className="text-sm text-herb-text-secondary leading-relaxed">
            {description ?? DEFAULT_TEXT[platform].description}
          </p>
        </div>

        {platform === "ios" ? (
          // iPhone の Safari は、画面下のバーに「…」しかない形が既定。共有のマークは「…」の中にあり、
          // 「ホーム画面に追加」は共有の画面を下までスクロールしないと出てこない（上半分は AirDrop や連絡先）。
          // 設定によっては以前の形（下に共有のマークが並ぶ）になるので、1 にかっこ書きで添える。
          <ol className="space-y-2 text-sm text-herb-text bg-herb-bg rounded-xl px-3.5 py-3">
            <li className="flex items-start gap-1.5">
              <StepNumber n={1} />
              <span>
                画面右下の「…」をタップ
                <span className="block text-xs text-herb-text-secondary mt-0.5">
                  （「…」が無く、下に共有のマーク
                  <Share size={12} className="inline text-herb-primary mx-0.5 -mt-0.5" />
                  が並んでいる場合は、それをタップ）
                </span>
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <StepNumber n={2} />
              <span>「共有」をタップ</span>
            </li>
            <li className="flex items-start gap-1.5">
              <StepNumber n={3} />
              <span>画面を下のほうまでスクロールし、「ホーム画面に追加」をタップ</span>
            </li>
            <li className="flex items-start gap-1.5">
              <StepNumber n={4} />
              <span>右上の「追加」をタップ</span>
            </li>
            <li className="flex items-start gap-1.5">
              <StepNumber n={5} />
              <span>ホーム画面のアイコンから開き直してログイン</span>
            </li>
          </ol>
        ) : (
          <ol className="space-y-2 text-sm text-herb-text bg-herb-bg rounded-xl px-3.5 py-3">
            <li className="flex items-center gap-1.5">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-herb-primary text-white text-xs font-bold flex items-center justify-center">
                1
              </span>
              右上のメニュー
              <MoreVertical size={14} className="text-herb-primary flex-shrink-0" />
              をタップ
            </li>
            <li className="flex items-center gap-1.5">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-herb-primary text-white text-xs font-bold flex items-center justify-center">
                2
              </span>
              「ホーム画面に追加」または「アプリをインストール」を選択
            </li>
            <li className="flex items-center gap-1.5">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-herb-primary text-white text-xs font-bold flex items-center justify-center">
                3
              </span>
              ホーム画面のアイコンから開き直してログイン
            </li>
          </ol>
        )}

        <button
          onClick={onClose}
          className="w-full h-10 rounded-full bg-herb-primary text-white font-semibold text-sm"
        >
          わかりました
        </button>
      </div>
    </div>
  )
}
