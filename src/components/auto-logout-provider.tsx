"use client"

import { useAutoLogout } from "@/hooks/useAutoLogout"

/**
 * 自動ログアウトの監視を有効化するクライアントコンポーネント。
 * RootLayout（サーバーコンポーネント）から呼び出すための薄いラッパー。
 */
export default function AutoLogoutProvider() {
  useAutoLogout()
  return null
}
