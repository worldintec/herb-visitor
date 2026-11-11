import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { getSession, PW_PATTERN, createSessionToken, setSessionCookie, rememberSessionEpoch } from "@/lib/auth"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { setUserPassword } from "@/lib/user-password"

export const dynamic = "force-dynamic"

// 画面に出す文言
const WRONG_CURRENT = "いまのパスワードが違います"
const SAVE_FAILED = "保存できませんでした。もう一度お試しください。"

/**
 * POST /api/auth/change-password — パスワードの変更
 *
 * ・いまのパスワードを必ず照合する（B-1 #11。端末を少し借りただけで変えられないように）。
 *   職員が発行した仮パスワードで入った方は、仮パスワードを「いまのパスワード」として入れれば通る
 * ・書き換えは set_user_password（lib/user-password.ts）。0行なら成功を返さない（#12）
 * ・書き換えるとログインの世代が進み、ほかの端末のログインは切れる（#10）。
 *   変えた本人の端末は、新しい世代の証を発行し直してログインしたままにする
 */
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "リクエストの形式が不正です" }, { status: 400 })
  }
  const { currentPassword, newPassword } = (body ?? {}) as {
    currentPassword?: unknown
    newPassword?: unknown
  }

  if (typeof currentPassword !== "string" || !currentPassword) {
    return NextResponse.json({ error: "いまのパスワードを入力してください" }, { status: 400 })
  }
  if (typeof newPassword !== "string" || !PW_PATTERN.test(newPassword)) {
    return NextResponse.json({ error: "パスワードは英数字8〜16文字で入力してください" }, { status: 400 })
  }

  try {
    // いまのパスワードを照合する
    const { data: user, error: readError } = await getSupabaseAdmin()
      .from("users")
      .select("id, user_id, password_hash")
      .eq("id", session.userId)
      .maybeSingle()
    if (readError) {
      console.error("[change-password] 利用者の取得に失敗しました", readError)
      return NextResponse.json({ error: SAVE_FAILED }, { status: 500 })
    }
    if (!user) {
      // 退会などで行が無い。成功を返さない
      return NextResponse.json({ error: SAVE_FAILED }, { status: 404 })
    }
    const ok = await bcrypt.compare(currentPassword, user.password_hash as string)
    if (!ok) {
      return NextResponse.json({ error: WRONG_CURRENT, code: "wrong_current_password" }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(newPassword, 10)
    const result = await setUserPassword(session.userId, passwordHash, false)
    if (!result.ok) {
      console.error(`[change-password] 書き換えに失敗しました reason=${result.reason}`, result.detail)
      return NextResponse.json({ error: SAVE_FAILED }, { status: result.reason === "not_found" ? 404 : 500 })
    }

    rememberSessionEpoch(session.userId, result.epoch)
    // 本人の端末は、新しい世代の証に差し替えてログインしたままにする
    const token = await createSessionToken({
      userId: session.userId,
      userCode: user.user_id as string,
      epoch: result.epoch,
    })
    await setSessionCookie(token)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[change-password] 処理に失敗しました", err)
    return NextResponse.json({ error: SAVE_FAILED }, { status: 500 })
  }
}
