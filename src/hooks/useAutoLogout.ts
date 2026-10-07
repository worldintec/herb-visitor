"use client"

import { usePathname } from "next/navigation"
import { useEffect } from "react"
import { toLogin } from "@/lib/login-redirect"

const HEARTBEAT_INTERVAL_MS = 10 * 60 * 1000     // ハートビート間隔: 10分

// 未ログインが正常な状態の画面（プレフィックス一致）。
//
// proxy.ts にも同名のリストがあるが、あちらは「アクセスを許可するパス」の一覧。
// こちらは「未ログインでいるのが正常なので、ハートビートが 401 を受けても
// ログイン画面へ飛ばしてはいけないパス」の一覧で、目的が違う。
//
// "/plants/" はティザー公開している植物の詳細ページ。これが無いと、
// QRコードから来た未ログインの来園者が10分でログイン画面に飛ばされる。
// 末尾のスラッシュは必須（"/plants" だと会員限定の一覧まで対象になる）。
const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/plants/"]

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p))
}

// 強制パスワード変更チェックをスキップするパス（未ログインで開ける画面、変更画面自身は対象外）
//
// 上の PUBLIC_PATHS を展開していたが、"/plants/" を足したときに
// 「仮パスワードの会員が植物ページに留まれてしまう」挙動の変化が起きるため、
// 展開をやめて明示的に並べている。ログイン済みの動きは従来のまま。
const SKIP_PASSWORD_CHECK_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/change-password",
]

// 職員用画面（別セッション・別認証）はビジター向けの機構の対象外
const STAFF_PATH_PREFIX = "/staff"

function skipPasswordCheck(pathname: string): boolean {
  return SKIP_PASSWORD_CHECK_PATHS.some((p) => pathname.startsWith(p))
}

/**
 * セッション維持フック。以下の2つを担う:
 * 1. ハートビート: 10分ごとに /api/auth/refresh を呼んでJWTとCookieを再発行する。
 *    ログインは30日保持されるため、これは「使い続けている間は切れない」ための更新で、
 *    止まっても30日以内なら再ログインは不要。
 * 2. 強制パスワード変更誘導: 仮パスワードでのログイン後、新パスワードに
 *    変更するまで /change-password 以外のページに留まれないようにする。
 *
 * 以前あった「タブ再オープン検知」と「1時間無操作ログアウト」は廃止した。
 * 前者は sessionStorage のフラグで判定していたが、フラグはタブごとに別なので、
 * QRコードから新しいタブで開くと、ログイン済みでも必ずログアウトさせられていた。
 * どちらも30日保持の方針と両立しないため、あわせて削除している。
 */
export function useAutoLogout(enabled: boolean = true) {
  const pathname = usePathname()

  useEffect(() => {
    if (!enabled) return
    if (typeof window === "undefined") return
    if (pathname.startsWith(STAFF_PATH_PREFIX)) return
    // 未ログインが正常な画面では監視しない。ここを見ていないと、
    // ティザー公開した植物ページを開いたままの来園者が10分で追い出される。
    if (isPublicPath(pathname)) return

    let expired = false

    // --- ハートビート: JWTとCookieを定期更新 ---
    const heartbeat = setInterval(async () => {
      if (expired) return
      try {
        const res = await fetch("/api/auth/refresh", { method: "POST" })
        if (res.status === 401) {
          // セッション失効 → 元のページを引き継いでログインへ
          expired = true
          toLogin()
        }
      } catch {
        // 通信失敗は次回ハートビートで再試行
      }
    }, HEARTBEAT_INTERVAL_MS)

    return () => {
      clearInterval(heartbeat)
    }
    // pathname を見るようになったので依存に入れる。
    // 画面を移るとタイマーは作り直されるが、10分間同じページに留まった人を
    // 追い出さないための仕組みなので、作り直しで困ることはない。
  }, [enabled, pathname])

  // --- 強制パスワード変更誘導（ページ遷移のたびにチェック） ---
  useEffect(() => {
    if (!enabled) return
    if (typeof window === "undefined") return
    if (pathname.startsWith(STAFF_PATH_PREFIX)) return
    if (skipPasswordCheck(pathname)) return

    let cancelled = false
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(({ user }) => {
        if (cancelled) return
        if (user?.mustChangePassword) {
          window.location.href = "/change-password"
        }
      })
      .catch(() => {
        // 通信失敗時はチェックをスキップ（次回遷移時に再試行）
      })

    return () => {
      cancelled = true
    }
  }, [enabled, pathname])
}
