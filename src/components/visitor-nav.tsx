"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Home, Leaf, Map, BookOpen, Bell, HelpCircle, User } from "lucide-react"

const navItems = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/plants", label: "ハーブ", icon: Leaf },
  { href: "/areas", label: "マップ", icon: Map },
  { href: "/my-notes", label: "ノート", icon: BookOpen },
  { href: "/news", label: "お知らせ", icon: Bell },
  { href: "/guide", label: "ガイド", icon: HelpCircle },
  { href: "/my-page", label: "マイページ", icon: User },
]

// ティザー公開している植物の詳細ページ。ここだけは未ログインでも開ける。
const TEASER_PATH_PREFIX = "/plants/"

export default function VisitorNav() {
  const pathname = usePathname()

  // 下部タブは7個すべてログインが必要なので、未ログインのときは出さない
  // （押しても全部ログイン画面に飛ぶため、導線を会員登録の1本に絞る）。
  //
  // 会員が使う画面にリクエストを増やしたくないので、確認は /plants/ 配下だけで行う。
  // それ以外のパスでは従来どおり、何も確認せずに描画する。
  const isTeaserPath = pathname.startsWith(TEASER_PATH_PREFIX)

  // null は未確認。/plants/ 配下では判定が付くまで描画しない
  // （先に出してから消すと、タブがちらついて見える）。
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)

  useEffect(() => {
    if (!isTeaserPath) return
    let cancelled = false
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then(({ user }) => {
        if (!cancelled) setLoggedIn(!!user)
      })
      .catch(() => {
        // 判定できないときは従来どおり出す（会員からタブを奪わない方を選ぶ）
        if (!cancelled) setLoggedIn(true)
      })
    return () => {
      cancelled = true
    }
  }, [isTeaserPath, pathname])

  if (isTeaserPath && loggedIn !== true) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-herb-border pb-safe">
      <div className="max-w-lg mx-auto flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center min-w-[46px] min-h-[44px] px-1 py-1 rounded-xl transition-colors ${
                isActive
                  ? "text-herb-primary"
                  : "text-herb-text-secondary hover:text-herb-primary-light"
              }`}
            >
              <Icon
                size={22}
                strokeWidth={isActive ? 2.5 : 1.8}
                className="mb-0.5"
              />
              <span
                className={`text-[10px] leading-tight ${
                  isActive ? "font-bold" : "font-medium"
                }`}
              >
                {item.label}
              </span>
              {isActive && (
                <div className="absolute bottom-1 w-5 h-0.5 rounded-full bg-herb-primary" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
