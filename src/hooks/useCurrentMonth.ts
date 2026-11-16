"use client"

import { useState, useEffect } from "react"
import { getMonth } from "date-fns"

// いまの月（1〜12）。ホームの「{月}月のおすすめハーブ」とハーブ一覧の「おすすめ」で使う（C #73）。
// 月をまたいでタブ/PWAを開きっぱなしにしても表示が更新されるよう、
// レンダー時の決め打ちではなく再表示時に再計算する
export function useCurrentMonth(): number {
  const [currentMonth, setCurrentMonth] = useState(() => getMonth(new Date()) + 1)

  useEffect(() => {
    const refreshMonth = () => setCurrentMonth(getMonth(new Date()) + 1)
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshMonth()
    }
    window.addEventListener("focus", refreshMonth)
    window.addEventListener("pageshow", refreshMonth)
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      window.removeEventListener("focus", refreshMonth)
      window.removeEventListener("pageshow", refreshMonth)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [])

  return currentMonth
}
