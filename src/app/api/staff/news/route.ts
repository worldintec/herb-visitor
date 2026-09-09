import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getStaffSession } from "@/lib/staff-auth"
import { broadcastPush } from "@/lib/web-push"
import type { NewsCategory, NewsRow } from "@/data/news"

export const dynamic = "force-dynamic"

const NEWS_CATEGORIES: NewsCategory[] = ["イベント", "お知らせ", "更新情報"]
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

// プッシュ通知の本文は要約を使い、要約が無ければ本文の冒頭を切り出す
const PUSH_BODY_MAX = 120

function buildPushBody(news: NewsRow): string {
  const summary = news.summary.trim()
  if (summary) return summary

  const body = news.body.trim()
  if (body.length <= PUSH_BODY_MAX) return body
  return `${body.slice(0, PUSH_BODY_MAX)}…`
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  const staffSession = await getStaffSession()
  if (!staffSession) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from("news")
    .select("id, category, title, summary, body, image_path, published_at, is_published")
    .order("published_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ news: (data ?? []) as NewsRow[] })
}

export async function POST(request: NextRequest) {
  const staffSession = await getStaffSession()
  if (!staffSession) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { category, title, summary, body, publishedAt, isPublished } = await request.json()

  if (!NEWS_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "カテゴリが不正です" }, { status: 400 })
  }
  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "タイトルは必須です" }, { status: 400 })
  }
  if (typeof publishedAt !== "string" || !DATE_PATTERN.test(publishedAt)) {
    return NextResponse.json({ error: "日付が不正です" }, { status: 400 })
  }

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from("news")
    .insert({
      category,
      title: title.trim(),
      summary: typeof summary === "string" ? summary.trim() : "",
      body: typeof body === "string" ? body.trim() : "",
      published_at: publishedAt,
      is_published: Boolean(isPublished),
      created_by: staffSession.staffId,
    })
    .select("id, category, title, summary, body, image_path, published_at, is_published")
    .single()

  if (error) {
    return NextResponse.json({ error: "登録に失敗しました" }, { status: 500 })
  }

  const news = data as NewsRow

  // 公開状態での新規登録時のみプッシュ通知を送る。
  // 編集（PATCH）では送らない。誤字修正のたびに全購読者へ通知が飛ぶのを避けるため。
  let notification: { sent: number; removed: number } | null = null
  if (news.is_published) {
    try {
      notification = await broadcastPush(supabase, {
        title: news.title,
        body: buildPushBody(news),
        url: "/news",
      })
      console.log(
        `[news] プッシュ通知を送信しました: id=${news.id} sent=${notification.sent} removed=${notification.removed}`
      )
    } catch (err) {
      // 通知は補助的な機能なので、失敗してもお知らせの登録自体は成功として扱う
      console.error(`[news] プッシュ通知の送信に失敗しました: id=${news.id}`, err)
    }
  }

  return NextResponse.json({ news, notification })
}
