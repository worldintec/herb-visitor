"use client"

import { useEffect } from "react"

const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000    // 1時間無操作でログアウト
const INACTIVITY_CHECK_MS   = 60 * 1000          // 無操作チェック間隔: 60秒
const HEARTBEAT_INTERVAL_MS = 10 * 60 * 1000     // ハートビート間隔: 10分
const STORAGE_KEY = "lastActivityAt"

// sessionStorage に残すタブ生存フラグ。タブを閉じると消えるため
// 同じURLを再度開いた際にログアウトを検知できる。
const TAB_SESSION_KEY = "session_tab"

// ログインなしでアクセスできる公開パス（プレフィックス一致）
const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"]

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p))
}

async function logout() {
  try {
    await fetch("/api/auth/logout", { method: "POST" })
  } catch {
    // 通信失敗時もリダイレクトは行う
  }
  sessionStorage.removeItem(TAB_SESSION_KEY)
  localStorage.removeItem(STORAGE_KEY)
}

/**
 * セッション維持フック。以下の2つを担う:
 * 1. ハートビート: 10分ごとに /api/auth/refresh を呼んでJWT(30分有効)を更新。
 *    タブ/ブラウザを閉じると更新が止まり、最大30分でJWTが期限切れになる。
 * 2. 無操作ログアウト: 1時間操作がなければ強制ログアウト。
 * 3. タブ再オープン検知: sessionStorage フラグがなければログアウト。
 */
export function useAutoLogout(enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return
    if (typeof window === "undefined") return

    // --- タブ生存チェック ---
    const tabAlive = sessionStorage.getItem(TAB_SESSION_KEY)
    if (!tabAlive) {
      if (!isPublicPath(window.location.pathname)) {
        logout().finally(() => {
          window.location.href = "/login"
        })
        return
      }
    }
    sessionStorage.setItem(TAB_SESSION_KEY, "1")

    // --- 無操作タイマー ---
    const updateActivity = () => {
      try {
        localStorage.setItem(STORAGE_KEY, String(Date.now()))
      } catch {
        // localStorage 不可環境ではスキップ
      }
    }

    const events: (keyof WindowEventMap)[] = ["click", "keydown", "scroll", "touchstart"]
    events.forEach((e) => window.addEventListener(e, updateActivity, { passive: true }))
    updateActivity()

    let timeoutFired = false

    const inactivityTimer = setInterval(async () => {
      if (timeoutFired) return
      try {
        const last = Number(localStorage.getItem(STORAGE_KEY) ?? 0)
        if (!last) return
        if (Date.now() - last > INACTIVITY_TIMEOUT_MS) {
          timeoutFired = true
          await logout()
          alert("セキュリティのため自動的にログアウトしました。")
          window.location.href = "/login"
        }
      } catch {
        // localStorage アクセス失敗時はスキップ
      }
    }, INACTIVITY_CHECK_MS)

    // --- ハートビート: JWTを定期更新 ---
    // タブ/ブラウザを閉じるとここで止まり、JWTが30分で自然失効する。
    const heartbeat = setInterval(async () => {
      if (timeoutFired) return
      try {
        const res = await fetch("/api/auth/refresh", { method: "POST" })
        if (res.status === 401) {
          // セッション失効 → ログインへ
          timeoutFired = true
          window.location.href = "/login"
        }
      } catch {
        // 通信失敗は次回ハートビートで再試行
      }
    }, HEARTBEAT_INTERVAL_MS)

    return () => {
      events.forEach((e) => window.removeEventListener(e, updateActivity))
      clearInterval(inactivityTimer)
      clearInterval(heartbeat)
    }
  }, [enabled])
}
