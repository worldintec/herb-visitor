import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { sortPhotosByPriority } from "@/lib/photo-utils"

export const dynamic = "force-dynamic"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

/**
 * 植物1件のティザー公開API（来園者アプリ用・読み取りのみ）。
 *
 * このAPIは proxy.ts の PUBLIC_PATHS（"/api/plants" の前方一致）に含まれており、
 * 未ログインでも叩ける。セッション検証は追加しないこと。
 * 会員向けの /api/plants?id= とは別物で、あちらの getSession() が唯一の防御なので、
 * そちらには手を入れない。
 *
 * 園内のQRコードを読んだ人に、名前・カテゴリ・写真1枚・本文の冒頭だけを見せて
 * 会員登録に誘導するためのAPI。公開してよいものだけを明示的に組み立てる。
 *
 * 【絶対に守ること】
 * - 香り・利用法・育て方のポイントの本文はレスポンスに含めない。
 *   空かどうかの判定にだけ使い、見出しの文字列だけを lockedSections で返す。
 *   全文を送って画面で隠す形にすると、通信を見れば読めてしまう。
 * - エリア・植物番号は返さない（マップを非公開にする方針と揃える）。
 * - plant_notes は引かない（author に職員の実名が載る）。
 * - is_planted では絞らない。この列は「いま植わっているか」ではなく
 *   「この行が代表かどうか」の意味で入っている箇所があり判定に使えない。
 *   会員向けの /api/plants?id= も絞っていないので、条件をそろえている。
 */

/** ティザー本文の文字数。超えた分は切って末尾に … を付ける。 */
const TEASER_MAX_LENGTH = 60

/**
 * 見出しの文字列は画面の表記（plants/[id]/page.tsx の infoItems の label）と
 * 必ず一致させる。片方を直したらもう片方も直すこと。
 * caution（注意事項）は全文を公開するのでこの一覧には含めない。
 */
const SECTIONS = [
  { key: "feature_flower", label: "花の特徴" },
  { key: "feature_leaf", label: "葉の特徴" },
  { key: "scent", label: "香り" },
  { key: "herb_use", label: "利用法" },
  { key: "care_point", label: "育て方のポイント" },
] as const

/** ティザー本文に使う優先順。目の前の植物と照合できる花・葉を先に出す。 */
const TEASER_ORDER = ["feature_flower", "feature_leaf", "herb_use"] as const

function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: "id が必要です" }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  // select() に並べた列しか取得しない。* は使わない。
  // scent / herb_use / care_point は空判定にだけ使い、レスポンスには入れない。
  const { data, error } = await supabase
    .from("plants")
    .select(
      "id, name, category, feature_flower, feature_leaf, scent, herb_use, care_point, caution"
    )
    .eq("id", id)
    .maybeSingle()

  if (error) {
    console.error("[plants/public] 取得に失敗しました", error)
    return NextResponse.json({ error: "植物データの取得に失敗しました" }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: "植物が見つかりません" }, { status: 404 })
  }

  const row = data as Record<string, unknown>
  const name = textOf(row.name)

  // --- ティザー本文 ---
  let teaser = ""
  let teaserTruncated = false
  let teaserLabel = ""
  let teaserKey = ""
  for (const key of TEASER_ORDER) {
    const text = textOf(row[key])
    if (!text) continue
    teaserKey = key
    teaserLabel = SECTIONS.find((s) => s.key === key)?.label ?? ""
    teaserTruncated = text.length > TEASER_MAX_LENGTH
    teaser = teaserTruncated ? `${text.slice(0, TEASER_MAX_LENGTH)}…` : text
    break
  }

  // ティザーに採用しなかった、中身のある見出しをすべて並べる。
  // 「この植物について、あといくつ書いてあるか」を正確に伝えるのが目的。
  const lockedSections = SECTIONS.filter(
    (s) => s.key !== teaserKey && textOf(row[s.key])
  ).map((s) => s.label)

  // --- 写真1枚 ---
  // sortPhotosByPriority() は同じ優先度のときに並べ替えず入力順に委ねる。
  // 会員向けの画面は /api/plant-photos が uploaded_at の降順で返した順を
  // 前提に成立しているので、ここでも同じ順に並べてから同じ関数に渡す。
  // 判定に使った caption / uploaded_at / storage_path はレスポンスに含めない。
  const { data: photoRows, error: photoError } = await supabase
    .from("plant_photos")
    .select("storage_path, caption, uploaded_at")
    .eq("plant_name", name)
    .order("uploaded_at", { ascending: false })

  if (photoError) {
    console.error("[plants/public] 写真情報の取得に失敗しました", photoError)
    return NextResponse.json({ error: "植物データの取得に失敗しました" }, { status: 500 })
  }

  const first = sortPhotosByPriority(photoRows ?? []).find(
    (p) => textOf(p.storage_path) !== ""
  )
  const photoUrl = first
    ? `${SUPABASE_URL}/storage/v1/object/public/plant-photos/${first.storage_path}`
    : null

  return NextResponse.json({
    plant: {
      id: textOf(row.id),
      name,
      category: textOf(row.category) || null,
      photoUrl,
      teaser,
      teaserTruncated,
      teaserLabel,
      caution: textOf(row.caution) || null,
      lockedSections,
    },
  })
}
