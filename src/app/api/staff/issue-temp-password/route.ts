import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import bcrypt from "bcryptjs"
import { randomInt } from "crypto"
import { getStaffSession } from "@/lib/staff-auth"
import { rememberSessionEpoch } from "@/lib/auth"

export const dynamic = "force-dynamic"

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const SUSPENDED_ERROR = "停止中の会員には発行できません。先に解除してください。"
const SUSPENDED_OR_GONE_ERROR =
  "発行できませんでした。停止中か、退会した会員です。停止中なら、先に解除してください。"

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
      .select("id, user_id, suspended_at")
      .eq("id", targetUserId)
      .maybeSingle()

    if (!user) {
      return NextResponse.json({ error: "対象ユーザーが見つかりません" }, { status: 404 })
    }

    if (user.suspended_at) {
      return NextResponse.json({ error: SUSPENDED_ERROR }, { status: 409 })
    }

    const tempPassword = generateTempPassword(9)
    const passwordHash = await bcrypt.hash(tempPassword, 10)

    // データベースの関数 issue_temp_password が1回で、パスワードの書き換え・変更待ちの印・
    // 期限（7日）・ログインの世代を進める（ほかの端末が切れる。B-1 #10）・発行の記録、を行う。
    // 職員アプリ（herb-garden）の「会員の管理」も同じ関数を呼ぶので、2つの画面で決まりがずれない（B-5 #89）。
    // 停止中・行が無いときは null が返る。成功として扱わない（#12）
    const { data: epoch, error: rpcError } = await supabase.rpc("issue_temp_password", {
      p_user_id: user.id,
      p_password_hash: passwordHash,
      p_staff_id: staffSession.staffId,
    })
    if (rpcError) {
      console.error("[staff/issue-temp-password] 発行に失敗しました", rpcError)
      return NextResponse.json({ error: "仮パスワードの発行に失敗しました" }, { status: 500 })
    }
    if (typeof epoch !== "number") {
      // 調べたあとに停止された・退会したなど
      return NextResponse.json({ error: SUSPENDED_OR_GONE_ERROR }, { status: 409 })
    }
    rememberSessionEpoch(user.id, epoch)

    return NextResponse.json({ success: true, tempPassword, userCode: user.user_id })
  } catch {
    return NextResponse.json({ error: "処理に失敗しました" }, { status: 500 })
  }
}
