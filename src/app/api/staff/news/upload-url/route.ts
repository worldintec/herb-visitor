import { NextRequest, NextResponse } from "next/server"
import { getStaffSession } from "@/lib/staff-auth"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { NEWS_IMAGE_BUCKET, NEWS_IMAGE_EXTENSIONS, NEWS_IMAGE_PREFIX } from "@/lib/news-image"

export const dynamic = "force-dynamic"

// POST /api/staff/news/upload-url — お知らせの画像を送るための、1回限りのアップロード用URLを発行する
//
// 形は /api/visitor-notes/upload-url と同じ。受け取るのは拡張子だけで、パスはサーバーが決める。
// 画像の中身はこのルートを通さない（Vercel の本文サイズの制限に当たる）。
export async function POST(request: NextRequest) {
  const staffSession = await getStaffSession()
  if (!staffSession) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "リクエストの形式が不正です" }, { status: 400 })
  }

  const ext = (body as { ext?: unknown } | null)?.ext
  const normalized = typeof ext === "string" ? ext.toLowerCase() : ""
  if (!NEWS_IMAGE_EXTENSIONS.includes(normalized)) {
    return NextResponse.json({ error: "画像の形式が不正です" }, { status: 400 })
  }

  // クライアントのファイル名は使わない。news/ の直下に置く（lib/news-image.ts の検証と対）。
  const path = `${NEWS_IMAGE_PREFIX}${crypto.randomUUID()}.${normalized}`

  // 有効期限は指定できない（Storage 側で固定2時間）。パスが毎回違うので上書きは起きない。
  const { data, error } = await getSupabaseAdmin()
    .storage.from(NEWS_IMAGE_BUCKET)
    .createSignedUploadUrl(path)

  if (error || !data) {
    console.error("[staff/news] createSignedUploadUrl error:", error)
    return NextResponse.json({ error: "画像の保存先を用意できませんでした" }, { status: 500 })
  }

  return NextResponse.json({ path: data.path, token: data.token })
}
