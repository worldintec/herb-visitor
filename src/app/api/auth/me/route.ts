import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSession } from "@/lib/auth"

export const dynamic = "force-dynamic"

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ user: null })

  const supabase = getSupabase()
  const { data: user, error } = await supabase
    .from("users")
    .select("password_reset_required")
    .eq("id", session.userId)
    .maybeSingle()

  // 「消えている」と「確認できなかった」を区別する。
  // クエリが失敗したときは退会したとは判断せず、従来どおりセッションから
  // 組み立てて返す（api/auth/refresh と同じ規則）。ここで 500 を返すと、
  // Supabase が一瞬不調になっただけで利用者がログイン画面に飛ばされる。
  if (error) {
    console.error("[auth/me] users の確認に失敗しました", error)
    return NextResponse.json({
      user: {
        userId: session.userId,
        userCode: session.userCode,
        mustChangePassword: false,
      },
    })
  }

  // 行が確かに無い＝退会済み。トークンが有効でも未ログインとして扱う。
  // 他の端末に残ったセッションを切る手段のひとつ。
  if (!user) {
    return NextResponse.json({ user: null })
  }

  return NextResponse.json({
    user: {
      // マイノートをアカウントに紐づけるため、クライアントからも自分の user_id を参照できるようにする
      userId: session.userId,
      userCode: session.userCode,
      mustChangePassword: !!user.password_reset_required,
    },
  })
}
