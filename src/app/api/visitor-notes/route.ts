import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { NOTES_TABLE, NOTE_COLUMNS, parseNotePayload } from "@/lib/visitor-notes"

export const dynamic = "force-dynamic"

// GET /api/visitor-notes — ログイン中アカウントのノート一覧（新しい順）
export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from(NOTES_TABLE)
    .select(NOTE_COLUMNS)
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("visitor_notes select error:", error)
    return NextResponse.json({ error: "ノートの取得に失敗しました" }, { status: 500 })
  }

  return NextResponse.json({ notes: data ?? [] })
}

// POST /api/visitor-notes — 新規作成
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

  const parsed = parseNotePayload(body, session.userId)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  // session_id は旧方式の互換列。NOT NULL 制約が残っていても失敗しないよう、
  // クライアントから渡されなければ userId で埋める。
  const { sessionId } = body as Record<string, unknown>
  const legacySessionId =
    typeof sessionId === "string" && sessionId ? sessionId : session.userId

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from(NOTES_TABLE)
    .insert({
      ...parsed.value,
      user_id: session.userId,
      session_id: legacySessionId,
    })
    .select(NOTE_COLUMNS)
    .single()

  if (error) {
    console.error("visitor_notes insert error:", error)
    return NextResponse.json({ error: "ノートの保存に失敗しました" }, { status: 500 })
  }

  return NextResponse.json({ note: data }, { status: 201 })
}
