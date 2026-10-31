"use client"

import { useEffect, useRef } from "react"

// 一覧の画面から植物ページなどへ行って「戻る」で戻ったときに、元のスクロール位置へ戻す。
//
// 一覧はデータを画面を開いたあとに読み込むので、ブラウザや Next.js のスクロール復元は
// まだ高さが無いうちに走って先頭に戻ってしまう。ここでは位置を sessionStorage に控えておき、
// 「戻る」で来たときだけ、読み込みが終わって（ready）から戻す。
// タブなどから新しく開いたときは控えを消し、今までどおり先頭から見せる。
//
// 画面内の「戻る」ボタンは router.back() なので、ブラウザの「戻る」と同じく popstate で判定できる。

const STORAGE_PREFIX = "scroll-restore:"
// popstate からこの時間内に一覧が開いたら「戻る」で来たとみなす
const POP_WINDOW_MS = 2000

let lastPopAt = 0
let firstLoadChecked = false
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    lastPopAt = Date.now()
  })
}

function cameBack(): boolean {
  const byPop = Date.now() - lastPopAt < POP_WINDOW_MS
  // 植物ページを直接開いてから戻ったときなど、一覧のページを読み込み直した場合
  if (!firstLoadChecked) {
    firstLoadChecked = true
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined
    if (nav?.type === "back_forward") return true
  }
  return byPop
}

type Saved<T> = { y: number; extra?: T }

function read<T>(key: string): Saved<T> | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key)
    return raw ? (JSON.parse(raw) as Saved<T>) : null
  } catch {
    return null
  }
}

function write<T>(key: string, value: Saved<T>) {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value))
  } catch {
    // 保存できない環境では復元しないだけ
  }
}

function remove(key: string) {
  try {
    sessionStorage.removeItem(STORAGE_PREFIX + key)
  } catch {
    // 無視
  }
}

/**
 * @param key      画面ごとの名前（エリア詳細ならエリアごとに分ける）
 * @param ready    一覧を描き終えたか。true になってから位置を戻す
 * @param options.extra         位置と一緒に控える画面の状態（絞り込みなど）
 * @param options.onRestoreExtra 「戻る」で来たときに、控えた状態を画面へ戻す
 * @param options.scrollTopOnFresh 新しく開いたときは先頭へ（前の画面の位置が残らないように）
 */
export function useScrollRestore<T = undefined>(
  key: string,
  ready: boolean,
  options: {
    extra?: T
    onRestoreExtra?: (extra: T) => void
    scrollTopOnFresh?: boolean
  } = {}
) {
  const { extra, onRestoreExtra, scrollTopOnFresh = false } = options
  // 戻す予定の位置。戻し終えるまでは控えを上書きしない（先頭に戻った位置で消さないため）
  const pendingY = useRef<number | null>(null)
  const extraRef = useRef<T | undefined>(extra)
  const onRestoreRef = useRef(onRestoreExtra)

  useEffect(() => {
    extraRef.current = extra
    onRestoreRef.current = onRestoreExtra
  })

  // 画面を開いたとき：「戻る」で来たなら控えを読む。そうでなければ控えを消す
  useEffect(() => {
    if (cameBack()) {
      const saved = read<T>(key)
      if (saved) {
        pendingY.current = saved.y
        if (saved.extra !== undefined) onRestoreRef.current?.(saved.extra)
        return
      }
    }
    remove(key)
    if (scrollTopOnFresh) window.scrollTo(0, 0)
  }, [key, scrollTopOnFresh])

  // スクロールのたびに位置を控える
  useEffect(() => {
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        if (pendingY.current !== null) return
        write(key, { y: window.scrollY, extra: extraRef.current })
      })
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [key])

  // 絞り込みなどが変わったら、位置と一緒に控え直す
  useEffect(() => {
    if (pendingY.current !== null) return
    write(key, { y: window.scrollY, extra })
  }, [key, extra])

  // 一覧を描き終えたら、元の位置へ戻す
  useEffect(() => {
    if (!ready || pendingY.current === null) return
    const y = pendingY.current
    // 描画が反映されてから戻す
    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        window.scrollTo(0, y)
        pendingY.current = null
      })
    )
    return () => cancelAnimationFrame(frame)
  }, [ready])
}
