import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import type { PlantPhoto } from "@/types/database"

export const dynamic = "force-dynamic"

/**
 * 植物写真のメタデータ（来園者アプリ用・読み取りのみ）。
 * plant_photos は RLS で anon を遮断しているため、画面からは必ずこの API を経由する。
 * 画像ファイル自体は公開バケット上にあり、URL の組み立てはクライアント側で行う。
 *
 * クエリ:
 *   plantName  その植物の写真だけを返す（植物詳細）
 *              省略時は全件。ホーム・一覧・エリア詳細は複数の植物名で
 *              まとめて引いていたが、植物名を並べたURLは長くなりすぎるため、
 *              全件を返して画面側で植物名ごとにまとめる形にしている。
 *
 * 未ログインには 401 を返す。proxy.ts でリダイレクトされないよう
 * PUBLIC_PATHS に登録したうえで、ここで検証している。
 */
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const plantName = request.nextUrl.searchParams.get("plantName")

  const supabase = getSupabaseAdmin()
  let query = supabase.from("plant_photos").select("*")
  if (plantName) query = query.eq("plant_name", plantName)

  const { data, error } = await query.order("uploaded_at", { ascending: false })

  if (error) {
    console.error("[plant-photos] 取得に失敗しました", error)
    return NextResponse.json({ error: "写真情報の取得に失敗しました" }, { status: 500 })
  }

  return NextResponse.json({ photos: (data ?? []) as PlantPhoto[] })
}
