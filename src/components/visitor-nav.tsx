"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Leaf, Map, BookOpen, Bell } from "lucide-react"

const navItems = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/plants", label: "ハーブ", icon: Leaf },
  { href: "/areas", label: "マップ", icon: Map },
  { href: "/my-notes", label: "ノート", icon: BookOpen },
  { href: "/news", label: "お知らせ", icon: Bell },
]

export default function VisitorNav() {
  const pathname = usePathname()

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
              className={`flex flex-col items-center justify-center min-w-[64px] min-h-[44px] px-3 py-1 rounded-xl transition-colors ${
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
