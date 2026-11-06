"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"

/**
 * マイノートの写真を、一覧の上に重ねて見る画面（読むだけ）。
 *
 * ・横にすべらせて次の写真へ（スクロールのスナップ。自前の拡大・移動は付けない）
 * ・「×」、写真の外のタップ、Esc で閉じる。一覧のスクロール位置はそのまま
 * ・写真は切り取らずに全体を出す
 * ・ブラウザ標準の拡大（ピンチ）は止める。iPhone の Safari では、画面を移っても拡大が残って
 *   戻せなくなるため（2026年10月31日に全体マップで同じ判断）。touch-action で横のすべらせだけを許す
 *
 * urls は並び順どおり（先頭が代表）。写真はサーバーが持ち主を確かめてから返す URL。
 */
export default function NotePhotoViewer({
  urls,
  onClose,
}: {
  urls: string[]
  onClose: () => void
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [index, setIndex] = useState(0)

  // 開いているあいだは後ろの一覧をスクロールさせない。閉じたら元に戻す（位置は動かさない）
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const el = scrollerRef.current
        if (!el) return
        const dir = e.key === "ArrowRight" ? 1 : -1
        el.scrollTo({ left: el.scrollLeft + dir * el.clientWidth, behavior: "smooth" })
      }
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener("keydown", onKey)
    }
  }, [onClose])

  // 何枚目を見ているか（すべらせた位置から求める）
  const onScroll = () => {
    const el = scrollerRef.current
    if (!el || el.clientWidth === 0) return
    setIndex(Math.round(el.scrollLeft / el.clientWidth))
  }

  // 写真そのもの以外（黒い余白）をタップしたら閉じる
  const closeIfBackdrop = (e: React.MouseEvent) => {
    if (!(e.target instanceof HTMLImageElement)) onClose()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[80] bg-black select-none"
      style={{ touchAction: "pan-x" }}
      role="dialog"
      aria-modal="true"
      aria-label="ノートの写真"
    >
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        onClick={closeIfBackdrop}
        className="absolute inset-0 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ touchAction: "pan-x", overscrollBehavior: "contain" }}
      >
        {urls.map((url, i) => (
          <div
            key={url}
            // snap-always：勢いよくすべらせても1枚ずつ止まる（写真を飛ばさない）
            className="w-full h-full flex-shrink-0 snap-center snap-always flex items-center justify-center px-3"
            style={{
              paddingTop: "calc(env(safe-area-inset-top, 0px) + 56px)",
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 48px)",
            }}
          >
            {/* 切り取らずに全体を出す。next/image を通さない理由は一覧のサムネイルと同じ
                （最適化はクッキーが送られず 401 になり、公開のキャッシュにも残る） */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`写真 ${i + 1}枚目（全${urls.length}枚）`}
              className="max-w-full max-h-full object-contain"
              draggable={false}
              style={{ touchAction: "pan-x" }}
            />
          </div>
        ))}
      </div>

      <button
        ref={closeRef}
        onClick={onClose}
        aria-label="閉じる"
        className="absolute right-3 w-10 h-10 rounded-full bg-white/90 text-gray-800 flex items-center justify-center shadow"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 10px)" }}
      >
        <X size={20} />
      </button>

      {urls.length > 1 && (
        <div
          className="absolute inset-x-0 flex flex-col items-center gap-1.5 pointer-events-none"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)" }}
          aria-live="polite"
        >
          <div className="flex gap-1.5">
            {urls.map((url, i) => (
              <span
                key={url}
                className={`w-2 h-2 rounded-full ${i === index ? "bg-white" : "bg-white/40"}`}
              />
            ))}
          </div>
          <span className="text-xs text-white/80" data-photo-position>
            {index + 1} / {urls.length}
          </span>
        </div>
      )}
    </div>,
    document.body
  )
}
