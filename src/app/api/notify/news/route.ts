import { createHash, timingSafeEqual } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { broadcastPush } from "@/lib/web-push"

export const dynamic = "force-dynamic"

/**
 * POST /api/notify/news — お知らせ1件のプッシュ通知を送る（サーバーどうしの呼び出し専用）
 *
 * 職員アプリ（herb-garden）が、お知らせを公開したときに呼ぶ。通知の鍵（VAPID_PRIVATE_KEY）は
 * 来園者アプリにだけ置き、職員アプリには渡さない（Vercel の Sensitive で値を取り出せないため）。
 *
 * ・認証は合言葉だけ。ヘッダ `Authorization: Bearer <NEWS_NOTIFY_SECRET>`。
 *   環境変数が無い・空のときは必ず 401（素通しにしない）
 * ・受け取るのはお知らせの id だけ。タイトルや本文は受け取らず、news テーブルから読む。
 *   合言葉が漏れても、データベースに実際にある公開済みのお知らせの内容しか送れない
 * ・非公開のお知らせは送らない（409）。存在しない id は 404
 * ・この API は news を読むだけで、書き込まない（通知を送った日時の記録は呼び出し側で行う）
 *
 * proxy.ts の PUBLIC_PATHS に "/api/notify/" を入れている（来園者のログインでは守らない）。
 */

const SECRET_ENV = "NEWS_NOTIFY_SECRET"
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// 通知の本文。api/staff/news の buildPushBody と同じ規則（概要、空なら本文の冒頭）
const PUSH_BODY_MAX = 120
function buildPushBody(summary: string, body: string): string {
  const s = summary.trim()
  if (s) return s
  const b = body.trim()
  return b.length <= PUSH_BODY_MAX ? b : `${b.slice(0, PUSH_BODY_MAX)}…`
}

/**
 * 合言葉の照合。長さと中身で応答時間に差が出ないよう、両方を SHA-256 で同じ長さにそろえてから
 * timingSafeEqual で比べる（長さが違うと timingSafeEqual は例外になり、長さが漏れるため）
 */
function secretMatches(given: string, expected: string): boolean {
  const a = createHash("sha256").update(given, "utf8").digest()
  const b = createHash("sha256").update(expected, "utf8").digest()
  return timingSafeEqual(a, b)
}

export async function POST(request: NextRequest) {
  const expected = process.env[SECRET_ENV]
  const header = request.headers.get("authorization") ?? ""
  const given = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : ""
  if (!expected || !given || !secretMatches(given, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "リクエストの形式が不正です" }, { status: 400 })
  }
  const id = (body as { id?: unknown } | null)?.id
  if (typeof id !== "string" || !id) {
    return NextResponse.json({ error: "id が必要です" }, { status: 400 })
  }
  // uuid の形でない id は、データベースに問い合わせるまでもなく存在しない
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "お知らせが見つかりません" }, { status: 404 })
  }

  const supabase = getSupabaseAdmin()
  const { data: news, error } = await supabase
    .from("news")
    .select("id, title, summary, body, is_published")
    .eq("id", id)
    .maybeSingle()

  if (error) {
    console.error("[notify/news] お知らせの取得に失敗しました", error)
    return NextResponse.json({ error: "お知らせの取得に失敗しました" }, { status: 500 })
  }
  if (!news) {
    return NextResponse.json({ error: "お知らせが見つかりません" }, { status: 404 })
  }
  if (!news.is_published) {
    return NextResponse.json({ error: "非公開のお知らせは通知できません" }, { status: 409 })
  }

  try {
    // 送信は既存の一斉送信をそのまま使う。sent は送れた件数、removed は無効になった購読を消した件数
    const result = await broadcastPush(supabase, {
      title: news.title as string,
      body: buildPushBody((news.summary as string) ?? "", (news.body as string) ?? ""),
      url: `/news/${news.id}`,
    })
    console.log(`[notify/news] プッシュ通知を送信しました: id=${news.id} sent=${result.sent} removed=${result.removed}`)
    return NextResponse.json({ sent: result.sent, removed: result.removed })
  } catch (err) {
    console.error(`[notify/news] プッシュ通知の送信に失敗しました: id=${news.id}`, err)
    return NextResponse.json({ error: "通知の送信に失敗しました" }, { status: 500 })
  }
}
