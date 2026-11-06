import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import {
  NOTES_TABLE,
  NOTE_COLUMNS,
  parseNotePayload,
} from "@/lib/visitor-notes"
import {
  checkNewPhotoPaths,
  fetchPhotoRows,
  photosOf,
  removeNotePhotoFiles,
  syncNotePhotos,
} from "@/lib/visitor-note-photos"

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

  // 写真は並び順どおり（先頭が代表）。path は保存のときにそのまま送り返してもらう
  const note = data as { id: string; photo_path: string | null }
  const { rows, error: photoError } = await fetchPhotoRows(supabase, [note.id])
  if (photoError) {
    console.error("visitor_note_photos select error:", photoError)
    return NextResponse.json({ error: "ノートの取得に失敗しました" }, { status: 500 })
  }

  return NextResponse.json({ note: { ...note, photos: photosOf(rows.get(note.id), note.photo_path) } })
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

  // 持ち主を確かめ、更新前の写真を控えておく（外した写真の実体を消すため）。
  // 他人のノートは「存在しない」として 404 にする
  const { data: existing } = await supabase
    .from(NOTES_TABLE)
    .select("photo_path")
    .eq("id", id)
    .eq("user_id", session.userId)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ error: "ノートが見つかりません" }, { status: 404 })
  }
  const { rows, error: photoError } = await fetchPhotoRows(supabase, [id])
  if (photoError) {
    console.error("visitor_note_photos select error:", photoError)
    return NextResponse.json({ error: "ノートの更新に失敗しました" }, { status: 500 })
  }
  const currentPhotos = photosOf(rows.get(id), existing.photo_path as string | null)

  // ノートを書き換える前に、新しい写真のパスがほかのノートで使われていないかを確かめる
  const checked = await checkNewPhotoPaths(supabase, session.userId, id, currentPhotos, parsed.photoPaths)
  if (!checked.ok) {
    if (checked.detail) console.error("visitor_note_photos check error:", checked.detail)
    return NextResponse.json({ error: checked.error }, { status: checked.status })
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

  // 写真の行を、届いた並びにそろえる。失敗したら実体は消さない（写真を失わない側に倒す）
  const synced = await syncNotePhotos(supabase, id, currentPhotos, parsed.photoPaths)
  if (!synced.ok) {
    console.error("visitor_note_photos sync error:", synced.detail ?? synced.error)
    return NextResponse.json({ error: synced.error }, { status: synced.status })
  }

  // 外した写真の実体を消す。パスは更新前のデータベースの行から読んだもの。
  // 実体の削除に失敗してもノートの更新自体は成功として扱う
  await removeNotePhotoFiles(supabase, synced.removedPaths)

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

  // 消す前に、写真の行のパスを集めておく（行は ON DELETE CASCADE で消えるが、実体は残るため）
  const { rows, error: photoError } = await fetchPhotoRows(supabase, [id])
  if (photoError) {
    console.error("visitor_note_photos select error:", photoError)
    return NextResponse.json({ error: "ノートの削除に失敗しました" }, { status: 500 })
  }
  const photoPaths = [
    ...(rows.get(id) ?? []).map((r) => r.storage_path),
    existing.photo_path as string | null,
  ]

  const { error } = await supabase
    .from(NOTES_TABLE)
    .delete()
    .eq("id", id)
    .eq("user_id", session.userId)

  if (error) {
    console.error("visitor_notes delete error:", error)
    return NextResponse.json({ error: "ノートの削除に失敗しました" }, { status: 500 })
  }

  // photo_path と写真の行には同じパス（代表）が入っているので、重複を除いてから消す
  await removeNotePhotoFiles(supabase, photoPaths)

  return NextResponse.json({ success: true })
}
