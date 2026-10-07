import { NextRequest, NextResponse } from "next/server"
import { verifySessionToken } from "@/lib/auth"

// 認証不要のパス（前方一致）
//
// これは「アクセスを許可するパス」の一覧。
// hooks/useAutoLogout.ts にも同名のリストがあるが、あちらは
// 「10分ごとのハートビートでログイン画面へ飛ばしてはいけないパス」の一覧で、
// 目的が違う。片方だけ直すと片方が効かないので、両方を見ること。
const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  // 植物の詳細ページだけはティザー公開する（未ログインには一部だけ見せて
  // 会員登録に誘導する）。末尾のスラッシュは必須。"/plants" にすると
  // 一覧ページ（会員限定）まで公開されてしまう。
  "/plants/",
  "/api/auth/",
  "/api/bloom-photos",
  "/_next/",
  "/favicon.ico",
  "/manifest.json",
  "/icons/",
  "/images/",
  "/apple-touch-icon.png",
  "/sw.js",
  // 職員用画面・APIは一般ユーザーの session Cookieとは別の
  // staff_session による独自認証を行うため、この一般ガードの対象外とする
  "/staff",
  "/api/staff/",
  // マイノートAPIは各ハンドラ側で getSession() による検証を行い、
  // 未ログインには 401 を返す。ここでログイン画面へリダイレクトしてしまうと
  // fetch 側が 401 を受け取れずHTMLを掴んでしまうため対象外とする
  "/api/visitor-notes",
  // 植物写真・観察ノートのAPIも同様に、各ハンドラ側で getSession() を検証する
  "/api/plant-photos",
  "/api/plant-notes",
  // 植物マスタのAPIも同様（第11段階）。照合は前方一致だが、
  // "/api/plant-photos" や "/api/plant-notes" はこの文字列で始まらないため干渉しない。
  //
  // ティザー公開用の /api/plants/public も、この前方一致で通っている。
  // あちらは意図的に getSession() を呼ばない唯一のデータAPIで、
  // 公開してよい項目だけを組み立てて返す。
  // 逆に、この行があるおかげで /api/plants 本体はリダイレクトされず 401 を返せる。
  // 本体の getSession() が唯一の防御なので、絶対に外さないこと。
  "/api/plants",
  // マップ3テーブルのAPIも同様（第12-1段階）。各ハンドラ側で getSession() を検証し、
  // 未ログインには 401 を返す。"/api/plant-positions" は "/api/plants" で始まらない
  // （4文字目以降が "-" と "s" で異なる）ため、上の行とは独立に必要。
  "/api/map-plots",
  "/api/zone-offsets",
  "/api/plant-positions",
]

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  // 公開パスはスキップ
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))
  if (isPublic) return NextResponse.next()

  // セッション確認
  const token = request.cookies.get("session")?.value
  const session = token ? await verifySessionToken(token) : null

  if (!session) {
    // 元のページをクエリごと引き継ぐ。これが無いと、QRコードから来た来園者が
    // ログイン後にホームへ飛ばされ、読み取ったページにたどり着けない。
    // 受け取る側（ログイン画面）は safeRedirect() で値を検証する。
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirect", pathname + search)
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
