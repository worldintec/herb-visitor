import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import bcrypt from "bcryptjs"
import { ID_PATTERN, PW_PATTERN } from "@/lib/auth"

export const dynamic = "force-dynamic"

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase()
  try {
    const { token, newUserId, newPassword } = await request.json()

    if (!token || !newUserId || !newPassword) {
      return NextResponse.json({ error: "入力内容が不足しています" }, { status: 400 })
    }
    if (!ID_PATTERN.test(newUserId)) {
      return NextResponse.json({ error: "IDは英数字8〜16文字で入力してください" }, { status: 400 })
    }
    if (!PW_PATTERN.test(newPassword)) {
      return NextResponse.json({ error: "パスワードは英数字8〜16文字で入力してください" }, { status: 400 })
    }

    const { data: user } = await supabase
      .from("users")
      .select("id, reset_token_expires_at")
      .eq("reset_token", token)
      .maybeSingle()

    if (!user) {
      return NextResponse.json({ error: "リンクが無効です。再度お試しください" }, { status: 400 })
    }

    if (new Date(user.reset_token_expires_at) < new Date()) {
      return NextResponse.json({ error: "リンクの有効期限が切れています。再度お試しください" }, { status: 400 })
    }

    // 新しいIDが既に他のユーザーに使われていないか確認
    const { data: conflict } = await supabase
      .from("users")
      .select("id")
      .eq("user_id", newUserId)
      .neq("id", user.id)
      .maybeSingle()

    if (conflict) {
      return NextResponse.json({ error: "そのIDは既に使用されています" }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(newPassword, 10)

    await supabase
      .from("users")
      .update({
        user_id: newUserId,
        password_hash: passwordHash,
        reset_token: null,
        reset_token_expires_at: null,
        reset_email: null,
      })
      .eq("id", user.id)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "処理に失敗しました" }, { status: 500 })
  }
}
