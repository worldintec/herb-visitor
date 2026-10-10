import { NextResponse } from "next/server"
import { getSession, createSessionToken, setSessionCookie } from "@/lib/auth"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const dynamic = "force-dynamic"

// 現在のセッションが有効であればJWTを再発行してCookieを更新する。
// タブが開いている間はクライアントが定期的に呼び出し、
// タブ/ブラウザを閉じるとハートビートが止まりJWTが自然失効する。
export async function POST() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  // 退会した利用者のセッションを切るための確認。
  // これを見ないと、開いたまま放置された端末が30日間表示され続ける
  // （useAutoLogout のハートビートが叩くのはこのルートで、401 以外では
  // ログイン画面へ送る分岐に入らない）。
  //
  // getSession() 自体には足さない。全 Route Handler に1クエリ増えるのに対し、
  // ここは開いているタブ1枚あたり10分に1回で桁が違う。
  //
  // 見るのは行の有無だけ。mustChangePassword などはここで判定しない。
  const supabase = getSupabaseAdmin()
  const { data: user, error } = await supabase
    .from("users")
    .select("id")
    .eq("id", session.userId)
    .maybeSingle()

  if (error) {
    // 「確認できなかった」を「退会した」と扱わない。ここを一緒にすると、
    // Supabase が一瞬不調になっただけで全利用者が同時にログアウトする。
    console.error("[auth/refresh] users の確認に失敗しました", error)
  } else if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const token = await createSessionToken(session)
  await setSessionCookie(token)
  return NextResponse.json({ success: true })
}
