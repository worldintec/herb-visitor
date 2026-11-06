import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { NOTES_TABLE, NOTE_PHOTOS_TABLE } from "@/lib/visitor-notes"
import { streamNotePhoto } from "@/lib/visitor-note-photos"

export const dynamic = "force-dynamic"

// GET /api/visitor-notes/[id]/photos/[photoId] — ノートの写真1枚の中身を返す（ノートを開いたとき）
//
// /api/visitor-notes/[id]/photo と同じく、毎回ノートの持ち主を確かめてから中身を流す。
// 「ノートが無い」「他人のノート」「写真が無い」「別のノートの写真」はすべて 404。
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id, photoId } = await params
  const supabase = getSupabaseAdmin()

  const { data: note, error: noteError } = await supabase
    .from(NOTES_TABLE)
    .select("id")
    .eq("id", id)
    .eq("user_id", session.userId)
    .maybeSingle()
  if (noteError) {
    console.error("visitor_notes photo select error:", noteError)
    return NextResponse.json({ error: "写真の取得に失敗しました" }, { status: 500 })
  }
  if (!note) {
    return NextResponse.json({ error: "写真が見つかりません" }, { status: 404 })
  }

  const { data: photo, error } = await supabase
    .from(NOTE_PHOTOS_TABLE)
    .select("storage_path")
    .eq("id", photoId)
    .eq("note_id", id)
    .maybeSingle()
  if (error) {
    console.error("visitor_note_photos select error:", error)
    return NextResponse.json({ error: "写真の取得に失敗しました" }, { status: 500 })
  }
  if (!photo) {
    return NextResponse.json({ error: "写真が見つかりません" }, { status: 404 })
  }

  return streamNotePhoto(supabase, photo.storage_path as string)
}
