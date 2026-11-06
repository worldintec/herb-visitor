import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { NOTES_TABLE, NOTE_COLUMNS, parseNotePayload } from "@/lib/visitor-notes"
import {
  checkNewPhotoPaths,
  fetchPhotoRows,
  photosOf,
  syncNotePhotos,
} from "@/lib/visitor-note-photos"

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

  // 一覧は代表の1枚だけを出す（/api/visitor-notes/[id]/photo）。ここでは枚数だけ添える
  const notes = (data ?? []) as { id: string; photo_path: string | null }[]
  const { rows, error: photoError } = await fetchPhotoRows(supabase, notes.map((n) => n.id))
  if (photoError) {
    console.error("visitor_note_photos select error:", photoError)
    return NextResponse.json({ error: "ノートの取得に失敗しました" }, { status: 500 })
  }

  // 一覧の写真を開いたとき（重ねて見る画面）に使う写真の id。同じ1回の読み込みから作るので
  // 問い合わせは増えない。Storage のパスは返さない。移行前の1枚（行が無い）は null
  return NextResponse.json({
    notes: notes.map((n) => {
      const photos = photosOf(rows.get(n.id), n.photo_path)
      return { ...n, photo_count: photos.length, photo_ids: photos.map((p) => p.id) }
    }),
  })
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

  // ノートを作る前に、写真のパスがほかのノートで使われていないかを確かめる
  const checked = await checkNewPhotoPaths(supabase, session.userId, null, [], parsed.photoPaths)
  if (!checked.ok) {
    if (checked.detail) console.error("visitor_note_photos check error:", checked.detail)
    return NextResponse.json({ error: checked.error }, { status: checked.status })
  }

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

  // 写真の行を作る。失敗したらノートも消して、同じノートが2件できないようにする
  // （送った写真のファイルは消さない。保存し直せば同じパスで使える）
  const noteId = (data as { id: string }).id
  const synced = await syncNotePhotos(supabase, noteId, [], parsed.photoPaths)
  if (!synced.ok) {
    console.error("visitor_note_photos insert error:", synced.detail ?? synced.error)
    await supabase.from(NOTES_TABLE).delete().eq("id", noteId).eq("user_id", session.userId)
    return NextResponse.json({ error: synced.error }, { status: synced.status })
  }

  return NextResponse.json({ note: data }, { status: 201 })
}
