import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getStaffSession } from "@/lib/staff-auth"
import type { NewsCategory, NewsRow } from "@/data/news"
import { NEWS_IMAGE_BUCKET, isNewsImagePath } from "@/lib/news-image"

export const dynamic = "force-dynamic"

const NEWS_CATEGORIES: NewsCategory[] = ["イベント", "お知らせ", "更新情報"]
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

// お知らせの画像の実体を消す。消す対象は DB の行に入っていた値だけで、
// news/○○ の形でなければ何もしない（同じバケットの植物の写真には触らない）。
// 失敗しても行の操作は成功として扱う（残るのは余分なファイルだけ）。
async function removeNewsImage(supabase: ReturnType<typeof getSupabase>, path: unknown) {
  if (!isNewsImagePath(path)) return
  const { error } = await supabase.storage.from(NEWS_IMAGE_BUCKET).remove([path])
  if (error) {
    console.error(`[staff/news] 画像の削除に失敗しました: path=${path}`, error)
  }
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staffSession = await getStaffSession()
  if (!staffSession) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const payload = await request.json()
  const { category, title, summary, body, publishedAt, isPublished } = payload

  // 画像は3通りに分ける。
  //   imagePath の項目が無い … 画像は変えない（列に触らない・古いファイルも消さない）
  //   imagePath が文字列     … その値に差し替える
  //   imagePath が null      … 画像を外す
  // 「送られてこなかった」と「外す」を取り違えると、編集しただけで画像が消える。
  const imagePathGiven = typeof payload === "object" && payload !== null && "imagePath" in payload
  const imagePath: unknown = imagePathGiven ? payload.imagePath : undefined

  if (!NEWS_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "カテゴリが不正です" }, { status: 400 })
  }
  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "タイトルは必須です" }, { status: 400 })
  }
  if (typeof publishedAt !== "string" || !DATE_PATTERN.test(publishedAt)) {
    return NextResponse.json({ error: "日付が不正です" }, { status: 400 })
  }
  if (imagePathGiven && imagePath !== null && !isNewsImagePath(imagePath)) {
    return NextResponse.json({ error: "画像の指定が不正です" }, { status: 400 })
  }

  const supabase = getSupabase()

  // 差し替え・外すときは、あとで古いファイルを消すために今の値を控えておく
  let oldImagePath: unknown = null
  if (imagePathGiven) {
    const { data: existing, error: selectError } = await supabase
      .from("news")
      .select("image_path")
      .eq("id", id)
      .maybeSingle()
    if (selectError) {
      console.error(`[staff/news] 更新前の取得に失敗しました: id=${id}`, selectError)
      return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 })
    }
    oldImagePath = existing?.image_path ?? null
  }

  const { data, error } = await supabase
    .from("news")
    .update({
      category,
      title: title.trim(),
      summary: typeof summary === "string" ? summary.trim() : "",
      body: typeof body === "string" ? body.trim() : "",
      published_at: publishedAt,
      is_published: Boolean(isPublished),
      updated_at: new Date().toISOString(),
      ...(imagePathGiven ? { image_path: imagePath } : {}),
    })
    .eq("id", id)
    .select("id, category, title, summary, body, image_path, published_at, is_published")
    .single()

  if (error) {
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 })
  }

  if (imagePathGiven && oldImagePath !== imagePath) {
    await removeNewsImage(supabase, oldImagePath)
  }

  return NextResponse.json({ news: data as NewsRow })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staffSession = await getStaffSession()
  if (!staffSession) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const supabase = getSupabase()
  // 先に行を消し、消した行に入っていた画像のパスを受け取る
  const { data: deleted, error } = await supabase
    .from("news")
    .delete()
    .eq("id", id)
    .select("image_path")

  if (error) {
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 })
  }

  for (const row of deleted ?? []) {
    await removeNewsImage(supabase, row.image_path)
  }

  return NextResponse.json({ success: true })
}
