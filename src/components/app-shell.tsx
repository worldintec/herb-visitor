"use client"

import { usePathname } from "next/navigation"
import VisitorNav from "@/components/visitor-nav"

// 下部タブを出しているときだけ、タブの高さぶん下を空ける。
// 出していないときは、端末下端の安全領域に少し足した分だけ空ける。
const PADDING_WITH_NAV = "calc(6rem + env(safe-area-inset-bottom, 0px))"
const PADDING_WITHOUT_NAV = "calc(1.5rem + env(safe-area-inset-bottom, 0px))"

export default function AppShell({
  loggedIn,
  children,
}: {
  // layout.tsx がサーバー側で Cookie から判定した値。
  // 最初の HTML の時点で決まっているので、タブが出てから消える（ちらつく）ことがない。
  loggedIn: boolean
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isStaff = pathname?.startsWith("/staff")

  // 下部タブの7個はすべてログインが必要なので、未ログインのときは出さない
  // （押しても全部ログイン画面に戻されるため、故障に見える）。
  // ページの一覧では判定しない。未ログインで開けるページが増えても漏れないように。
  //
  // 例外は職員画面だけ。来園者アプリとは別の領域なので、来園者として
  // ログインしていても出さない。
  const showNav = loggedIn && !isStaff

  return (
    <>
      <div
        className={isStaff ? "min-h-dvh" : "max-w-lg mx-auto min-h-dvh"}
        style={{ paddingBottom: showNav ? PADDING_WITH_NAV : PADDING_WITHOUT_NAV }}
      >
        {children}
      </div>
      {showNav && <VisitorNav />}
    </>
  )
}
