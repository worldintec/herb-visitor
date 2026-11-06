import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { NOTES_TABLE } from "@/lib/visitor-notes"
import { fetchPhotoRows, photosOf, streamNotePhoto } from "@/lib/visitor-note-photos"

export const dynamic = "force-dynamic"

// GET /api/visitor-notes/[id]/photo — 代表の写真（一覧のサムネイル）の中身を返す
//
// 署名付きURLを画面に渡さず、毎回ここで持ち主を確かめてから中身を流す。
// URLが外に漏れても、そのURLだけでは他人は開けない。
// 代表は visitor_note_photos の sort_order がいちばん小さい1枚。
// 表に行が無い移行前のノートは photo_path の1枚。
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
    .select("photo_path")
    .eq("id", id)
    .eq("user_id", session.userId)
    .maybeSingle()

  if (error) {
    console.error("visitor_notes photo select error:", error)
    return NextResponse.json({ error: "写真の取得に失敗しました" }, { status: 500 })
  }

  // 「ノートが無い」「他人のノート」「写真が付いていない」を区別せず、すべて404にする。
  // 403 を返すと「その写真は存在するが、あなたのものではない」と分かってしまい、
  // 他人の写真の存在を知られてしまう。
  if (!data) {
    return NextResponse.json({ error: "写真が見つかりません" }, { status: 404 })
  }
  const { rows, error: photoError } = await fetchPhotoRows(supabase, [id])
  if (photoError) {
    console.error("visitor_note_photos select error:", photoError)
    return NextResponse.json({ error: "写真の取得に失敗しました" }, { status: 500 })
  }
  const [cover] = photosOf(rows.get(id), data.photo_path as string | null)
  if (!cover) {
    return NextResponse.json({ error: "写真が見つかりません" }, { status: 404 })
  }

  return streamNotePhoto(supabase, cover.path)
}
