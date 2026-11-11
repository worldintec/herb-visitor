import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import bcrypt from "bcryptjs"
import { randomInt } from "crypto"
import { getStaffSession } from "@/lib/staff-auth"
import { setUserPassword } from "@/lib/user-password"
import { rememberSessionEpoch } from "@/lib/auth"

export const dynamic = "force-dynamic"

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const TEMP_PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"

function generateTempPassword(length: number): string {
  let result = ""
  for (let i = 0; i < length; i++) {
    result += TEMP_PASSWORD_CHARS[randomInt(TEMP_PASSWORD_CHARS.length)]
  }
  return result
}

export async function POST(request: NextRequest) {
  const staffSession = await getStaffSession()
  if (!staffSession) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const supabase = getSupabase()
  try {
    const { targetUserId } = await request.json()
    if (!targetUserId) {
      return NextResponse.json({ error: "対象ユーザーが指定されていません" }, { status: 400 })
    }

    const { data: user } = await supabase
      .from("users")
      .select("id, user_id")
      .eq("id", targetUserId)
      .maybeSingle()

    if (!user) {
      return NextResponse.json({ error: "対象ユーザーが見つかりません" }, { status: 404 })
    }

    const tempPassword = generateTempPassword(9)
    const passwordHash = await bcrypt.hash(tempPassword, 10)

    // 書き換えと同時にログインの世代を進める。乗っ取られた方を職員が助けるとき、
    // ほかの端末（乗っ取った側）のログインもここで切れる（B-1 #10）。0行なら成功を返さない（#12）
    const result = await setUserPassword(user.id, passwordHash, true)
    if (!result.ok) {
      console.error(`[staff/issue-temp-password] 書き換えに失敗しました reason=${result.reason}`, result.detail)
      return NextResponse.json({ error: "仮パスワードの発行に失敗しました" }, { status: 500 })
    }
    rememberSessionEpoch(user.id, result.epoch)

    await supabase.from("password_reset_logs").insert({
      target_user_id: user.id,
      staff_id: staffSession.staffId,
    })

    return NextResponse.json({ success: true, tempPassword, userCode: user.user_id })
  } catch {
    return NextResponse.json({ error: "処理に失敗しました" }, { status: 500 })
  }
}
