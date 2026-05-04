"use client"

import { useEffect } from "react"

const TIMEOUT_MS = 60 * 60 * 1000 // 1時間
const CHECK_INTERVAL_MS = 60 * 1000 // 60秒ごとにチェック
const STORAGE_KEY = "lastActivityAt"

/**
 * 1時間無操作で自動ログアウトするフック。
 * 操作（クリック/タップ/キー入力/スクロール）のたびに lastActivityAt を更新し、
 * 1時間超過したらサーバーセッションをクリアして /login にリダイレクトする。
 */
export function useAutoLogout(enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return
    if (typeof window === "undefined") return

    const updateActivity = () => {
      try {
        localStorage.setItem(STORAGE_KEY, String(Date.now()))
      } catch {
        // localStorage 不可環境ではスキップ
      }
    }

    const events: (keyof WindowEventMap)[] = [
      "click",
      "keydown",
      "scroll",
      "touchstart",
    ]
    events.forEach((e) => window.addEventListener(e, updateActivity, { passive: true }))
    updateActivity()

    let timeoutFired = false

    const interval = setInterval(async () => {
      if (timeoutFired) return
      try {
        const last = Number(localStorage.getItem(STORAGE_KEY) ?? 0)
        if (!last) return
        if (Date.now() - last > TIMEOUT_MS) {
          timeoutFired = true
          // サーバーセッション破棄
          try {
            await fetch("/api/auth/logout", { method: "POST" })
          } catch {
            // 通信失敗時もリダイレクトは行う
          }
          localStorage.removeItem(STORAGE_KEY)
          alert("セキュリティのため自動的にログアウトしました。")
          window.location.href = "/login"
        }
      } catch {
        // localStorage アクセス失敗時はスキップ
      }
    }, CHECK_INTERVAL_MS)

    return () => {
      events.forEach((e) => window.removeEventListener(e, updateActivity))
      clearInterval(interval)
    }
  }, [enabled])
}
