import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { randomBytes } from "crypto"
import { sendPasswordResetEmail } from "@/lib/mailer"
import { ID_PATTERN } from "@/lib/auth"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { userId, email } = await request.json()

    if (!userId || !email) {
      return NextResponse.json({ error: "IDとメールアドレスを入力してください" }, { status: 400 })
    }
    if (!ID_PATTERN.test(userId)) {
      return NextResponse.json({ error: "IDの形式が正しくありません" }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "メールアドレスの形式が正しくありません" }, { status: 400 })
    }

    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle()

    // IDが存在しない場合も同じレスポンスを返す（列挙攻撃対策）
    if (!user) {
      return NextResponse.json({ success: true })
    }

    const token = randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

    await supabase
      .from("users")
      .update({
        reset_token: token,
        reset_token_expires_at: expiresAt,
        reset_email: email,
      })
      .eq("id", user.id)

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${request.headers.get("host")}`
    const resetUrl = `${baseUrl}/reset-password?token=${token}`

    await sendPasswordResetEmail(email, resetUrl)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "処理に失敗しました" }, { status: 500 })
  }
}
