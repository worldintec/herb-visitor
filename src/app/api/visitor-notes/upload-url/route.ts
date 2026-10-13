import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { NOTES_BUCKET } from "@/lib/visitor-notes"

export const dynamic = "force-dynamic"

// クライアントから受け取るのは拡張子だけ。英数字3〜4文字に限る。
const EXT_PATTERN = /^[a-z0-9]{3,4}$/

// POST /api/visitor-notes/upload-url — 1回限りのアップロード用URLを発行する
//
// 写真の中身はこのルートを通さない（Vercel の本文サイズの制限に当たる）。
// クライアントは受け取った token で Storage へ直接送る。
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

  const ext = (body as { ext?: unknown } | null)?.ext
  const normalized = typeof ext === "string" ? ext.toLowerCase() : ""
  if (!EXT_PATTERN.test(normalized)) {
    return NextResponse.json({ error: "写真の形式が不正です" }, { status: 400 })
  }

  // パスはクライアントに決めさせない。セッションの userId を先頭に置くことで、
  // 他人のフォルダを指定されることがなくなる。
  // lib/visitor-notes.ts の photoPath の検証（<userId>/ で始まるか）と対になっている。
  const random = Math.random().toString(36).slice(2, 8)
  const path = `${session.userId}/${Date.now()}_${random}.${normalized}`

  // 有効期限は指定できない（supabase-js にオプションが無く、Storage 側で固定2時間）。
  // upsert は既定の false のまま。パスが毎回違うので上書きは起きない。
  const { data, error } = await getSupabaseAdmin()
    .storage.from(NOTES_BUCKET)
    .createSignedUploadUrl(path)

  if (error || !data) {
    console.error("visitor-notes createSignedUploadUrl error:", error)
    return NextResponse.json(
      { error: "写真の保存先を用意できませんでした" },
      { status: 500 }
    )
  }

  return NextResponse.json({ path: data.path, token: data.token })
}
