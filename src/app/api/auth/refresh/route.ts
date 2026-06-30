import { NextResponse } from "next/server"
import { getSession, createSessionToken, setSessionCookie } from "@/lib/auth"

export const dynamic = "force-dynamic"

// 現在のセッションが有効であればJWTを再発行してCookieを更新する。
// タブが開いている間はクライアントが定期的に呼び出し、
// タブ/ブラウザを閉じるとハートビートが止まりJWTが自然失効する。
export async function POST() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const token = await createSessionToken(session)
  await setSessionCookie(token)
  return NextResponse.json({ success: true })
}
