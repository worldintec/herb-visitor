import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import {
  NOTES_TABLE,
  NOTES_BUCKET,
  NOTE_COLUMNS,
  parseNotePayload,
} from "@/lib/visitor-notes"

export const dynamic = "force-dynamic"

// GET /api/visitor-notes/[id] — 編集画面での1件取得
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from(NOTES_TABLE)
    .select(NOTE_COLUMNS)
    .eq("id", id)
    .eq("user_id", session.userId)
    .maybeSingle()

  if (error) {
    console.error("visitor_notes select error:", error)
    return NextResponse.json({ error: "ノートの取得に失敗しました" }, { status: 500 })
  }
  // 他人のノートも「存在しない」として扱い、IDの存在を推測させない
  if (!data) {
    return NextResponse.json({ error: "ノートが見つかりません" }, { status: 404 })
  }

  return NextResponse.json({ note: data })
}

// PATCH /api/visitor-notes/[id] — 編集
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id } = await params

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

  const supabase = getSupabaseAdmin()

  // 更新前の写真パスを控えておき、差し替え・削除された場合に実体を消す
  const { data: existing } = await supabase
    .from(NOTES_TABLE)
    .select("photo_path")
    .eq("id", id)
    .eq("user_id", session.userId)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ error: "ノートが見つかりません" }, { status: 404 })
  }

  const { data, error } = await supabase
    .from(NOTES_TABLE)
    .update({ ...parsed.value, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", session.userId)
    .select(NOTE_COLUMNS)
    .single()

  if (error) {
    console.error("visitor_notes update error:", error)
    return NextResponse.json({ error: "ノートの更新に失敗しました" }, { status: 500 })
  }

  const oldPath = existing.photo_path as string | null
  if (oldPath && oldPath !== parsed.value.photo_path) {
    // 実体の削除に失敗してもノートの更新自体は成功として扱う
    const { error: removeError } = await supabase.storage
      .from(NOTES_BUCKET)
      .remove([oldPath])
    if (removeError) {
      console.error("visitor-notes storage remove error:", removeError)
    }
  }

  return NextResponse.json({ note: data })
}

// DELETE /api/visitor-notes/[id] — 削除（写真の実体もサーバー側で消す）
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const supabase = getSupabaseAdmin()

  const { data: existing } = await supabase
    .from(NOTES_TABLE)
    .select("photo_path")
    .eq("id", id)
    .eq("user_id", session.userId)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ error: "ノートが見つかりません" }, { status: 404 })
  }

  const { error } = await supabase
    .from(NOTES_TABLE)
    .delete()
    .eq("id", id)
    .eq("user_id", session.userId)

  if (error) {
    console.error("visitor_notes delete error:", error)
    return NextResponse.json({ error: "ノートの削除に失敗しました" }, { status: 500 })
  }

  const photoPath = existing.photo_path as string | null
  if (photoPath) {
    const { error: removeError } = await supabase.storage
      .from(NOTES_BUCKET)
      .remove([photoPath])
    if (removeError) {
      console.error("visitor-notes storage remove error:", removeError)
    }
  }

  return NextResponse.json({ success: true })
}
