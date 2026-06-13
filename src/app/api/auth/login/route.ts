import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import bcrypt from "bcryptjs"
import { createSessionToken, setSessionCookie, ID_PATTERN, PW_PATTERN } from "@/lib/auth"

export const dynamic = "force-dynamic"

// JIT warmup: bcryptjs は初回呼び出し時に V8 コンパイルが走り遅延するため
// モジュールロード時に低コストで一度実行してキャッシュさせる
bcrypt.hashSync("__warmup__", 1)

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase()
  try {
    const { userId, password } = await request.json()

    if (!ID_PATTERN.test(userId) || !PW_PATTERN.test(password)) {
      return NextResponse.json({ error: "IDまたはパスワードが正しくありません" }, { status: 401 })
    }

    const { data: user } = await supabase
      .from("users")
      .select("id, user_id, password_hash")
      .eq("user_id", userId)
      .maybeSingle()

    if (!user) {
      return NextResponse.json({ error: "IDまたはパスワードが正しくありません" }, { status: 401 })
    }

    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) {
      return NextResponse.json({ error: "IDまたはパスワードが正しくありません" }, { status: 401 })
    }

    // last_login_at の更新はレスポンスをブロックしない（fire and forget）
    supabase
      .from("users")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", user.id)
      .then(() => {})

    const token = await createSessionToken({ userId: user.id, userCode: user.user_id })
    await setSessionCookie(token)

    return NextResponse.json({ success: true, userCode: user.user_id })
  } catch {
    return NextResponse.json({ error: "リクエストの処理に失敗しました" }, { status: 500 })
  }
}
