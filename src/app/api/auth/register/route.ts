import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import bcrypt from "bcryptjs"
import { createSessionToken, setSessionCookie, ID_PATTERN, PW_PATTERN } from "@/lib/auth"

export const dynamic = "force-dynamic"

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase()
  try {
    const { userId, password, tosAgreed, tosVersion } = await request.json()

    if (!ID_PATTERN.test(userId)) {
      return NextResponse.json({ error: "IDは英数字8〜16文字で入力してください" }, { status: 400 })
    }
    if (!PW_PATTERN.test(password)) {
      return NextResponse.json({ error: "パスワードは英数字8〜16文字で入力してください" }, { status: 400 })
    }
    if (tosAgreed !== true) {
      return NextResponse.json({ error: "利用規約への同意が必要です" }, { status: 400 })
    }

    // 既存ID重複チェック（同一パスワードの場合は別メッセージ）
    const { data: existing } = await supabase
      .from("users")
      .select("id, password_hash")
      .eq("user_id", userId)
      .maybeSingle()

    if (existing) {
      const samePassword = await bcrypt.compare(password, existing.password_hash)
      if (samePassword) {
        return NextResponse.json({ error: "このIDは使用できません" }, { status: 409 })
      }
      return NextResponse.json({ error: "このIDは既に使用されています" }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const tosVersionNumber = typeof tosVersion === "number" && tosVersion > 0 ? tosVersion : 1
    const { data, error } = await supabase
      .from("users")
      .insert({
        user_id: userId,
        password_hash: passwordHash,
        tos_agreed_at: new Date().toISOString(),
        tos_version: tosVersionNumber,
      })
      .select("id, user_id")
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "登録に失敗しました" }, { status: 500 })
    }

    const token = await createSessionToken({ userId: data.id, userCode: data.user_id })
    await setSessionCookie(token)

    return NextResponse.json({ success: true, userCode: data.user_id })
  } catch {
    return NextResponse.json({ error: "リクエストの処理に失敗しました" }, { status: 500 })
  }
}
