import type { Metadata, Viewport } from "next"
import "./globals.css"
import AppShell from "@/components/app-shell"
import AutoLogoutProvider from "@/components/auto-logout-provider"
import SwRegister from "@/components/sw-register"
import AddToHomeScreenPrompt from "@/components/add-to-home-screen-prompt"
import { getSession } from "@/lib/auth"

export const metadata: Metadata = {
  title: "見沼氷川ハーブ園",
  description:
    "見沼氷川公園ハーブ園の植物ガイド。園内のハーブを写真付きで紹介します。",
  icons: {
    icon: "/favicon.ico",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "見沼氷川ハーブ園",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#16a34a",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // 下部タブを出すかどうかに使う。Cookie の署名を確かめるだけで DB には問い合わせない。
  // Cookie を読むので全ページがリクエストごとの描画になるが、クライアント側で
  // 判定するとログイン済みの人にタブが遅れて出るため、こちらを採っている。
  // ログイン・ログアウトはどれもページ全体を読み直すので、判定はその都度やり直される。
  const loggedIn = (await getSession()) !== null

  return (
    <html lang="ja">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="min-h-dvh font-sans antialiased">
        <AppShell loggedIn={loggedIn}>{children}</AppShell>
        <AutoLogoutProvider />
        <SwRegister />
        <AddToHomeScreenPrompt />
      </body>
    </html>
  )
}
