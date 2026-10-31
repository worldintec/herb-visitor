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
//
// 位置は、リンクを押した瞬間に控え、それ以降は上書きしない。スクロールのたびに控えるだけだと、
// 次の画面へ移る途中で Next.js がスクロールを動かした位置で上書きされてしまう。

const STORAGE_PREFIX = "scroll-restore:"

// 最後の画面の移り方が「戻る・進む」（popstate）だったか。リンクを押したら取り消す。
// 時間で判定すると、戻ってすぐタブを押したときも「戻る」とみなしてしまう
let lastNavWasPop = false
// リンクを押してから画面が切り替わるまでは、控えを上書きしない
let leaving = false
const leaveListeners = new Set<() => void>()
let firstLoadChecked = false
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    lastNavWasPop = true
    leaving = true
  })
  document.addEventListener(
    "click",
    (e) => {
      const a = (e.target as Element | null)?.closest?.("a[href]")
      if (!a) return
      lastNavWasPop = false
      // 押した瞬間の位置を、開いている一覧ぶん控える
      leaveListeners.forEach((fn) => fn())
      leaving = true
    },
    true
  )
}

function cameBack(): boolean {
  const byPop = lastNavWasPop
  lastNavWasPop = false
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
    leaving = false
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

  // スクロールのたびと、リンクを押した瞬間に位置を控える（画面を離れる途中は上書きしない）
  useEffect(() => {
    let frame = 0
    const save = () => {
      if (pendingY.current !== null || leaving) return
      write(key, { y: window.scrollY, extra: extraRef.current })
    }
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        save()
      })
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    leaveListeners.add(save)
    return () => {
      window.removeEventListener("scroll", onScroll)
      leaveListeners.delete(save)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [key])

  // 絞り込みなどが変わったら、位置と一緒に控え直す
  useEffect(() => {
    if (pendingY.current !== null || leaving) return
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
