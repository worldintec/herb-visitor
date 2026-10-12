"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { isStandalone, detectMobilePlatform, type MobilePlatform } from "@/lib/platform"
import AddToHomeScreenModal from "@/components/add-to-home-screen-modal"

// ログインなしでアクセスできる公開パス（プレフィックス一致）
// useAutoLogout の PUBLIC_PATHS と同じ基準
//
// "/terms" は、規約を読んでいる最中にホーム画面追加のモーダルが
// かぶらないようにするために入れている。
const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password", "/terms"]

const STORAGE_KEY = "a2hsPromptDismissed"

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p))
}

export default function AddToHomeScreenPrompt() {
  const pathname = usePathname()
  const [platform, setPlatform] = useState<MobilePlatform | null>(null)

  useEffect(() => {
    // setStateを直接同期呼び出ししない（react-hooks/set-state-in-effect対策）ため非同期関数でラップ
    ;(async () => {
      if (isPublicPath(pathname)) return
      if (isStandalone()) return

      try {
        if (localStorage.getItem(STORAGE_KEY) === "1") return
      } catch {
        // localStorage不可環境ではスキップ
        return
      }

      if (typeof Notification === "undefined" || Notification.permission !== "granted") return

      const detected = detectMobilePlatform()
      if (!detected) return

      setPlatform(detected)
    })()
  }, [pathname])

  const close = () => {
    setPlatform(null)
    try {
      localStorage.setItem(STORAGE_KEY, "1")
    } catch {
      // 無視
    }
  }

  if (!platform) return null

  return <AddToHomeScreenModal platform={platform} onClose={close} />
}
