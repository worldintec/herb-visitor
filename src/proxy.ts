import { NextRequest, NextResponse } from "next/server"
import { verifySessionToken } from "@/lib/auth"

// 認証不要のパス（前方一致）
const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/api/auth/",
  "/api/bloom-photos",
  "/_next/",
  "/favicon.ico",
]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 公開パスはスキップ
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))
  if (isPublic) return NextResponse.next()

  // セッション確認
  const token = request.cookies.get("session")?.value
  const session = token ? await verifySessionToken(token) : null

  if (!session) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // _next/static, _next/image, favicon.ico 以外の全パスに適用
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}
