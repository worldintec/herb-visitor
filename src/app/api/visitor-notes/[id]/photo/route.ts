import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { NOTES_TABLE, NOTES_BUCKET } from "@/lib/visitor-notes"

export const dynamic = "force-dynamic"

// download() の Blob から Content-Type が取れなかったときだけ使う。
// jpg / jpeg は末尾のフォールバックに任せる。
const EXT_CONTENT_TYPE: Record<string, string> = {
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
}

// GET /api/visitor-notes/[id]/photo — 写真の中身を返す
//
// 署名付きURLを画面に渡さず、毎回ここで持ち主を確かめてから中身を流す。
// URLが外に漏れても、そのURLだけでは他人は開けない。
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
  const photoPath = data?.photo_path as string | null | undefined
  if (!photoPath) {
    return NextResponse.json({ error: "写真が見つかりません" }, { status: 404 })
  }

  const { data: blob, error: downloadError } = await supabase.storage
    .from(NOTES_BUCKET)
    .download(photoPath)

  if (downloadError || !blob) {
    console.error("visitor-notes storage download error:", downloadError)
    return NextResponse.json({ error: "写真の取得に失敗しました" }, { status: 500 })
  }

  const ext = photoPath.split(".").pop()?.toLowerCase() ?? ""
  const contentType = blob.type || EXT_CONTENT_TYPE[ext] || "image/jpeg"

  return new Response(blob, {
    headers: {
      "Content-Type": contentType,
      // 非公開の写真を端末や途中のキャッシュに残さない。
      // 写真は数件なので、まずは no-store で様子を見る。
      "Cache-Control": "private, no-store",
    },
  })
}
