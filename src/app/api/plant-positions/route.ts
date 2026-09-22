import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { isZone } from "@/lib/zones"
import type { PlantPosition } from "@/types/database"

export const dynamic = "force-dynamic"

/**
 * 植物の配置座標（来園者アプリ用・読み取りのみ）。
 * plant_positions は RLS で anon を遮断するため、画面からは必ずこの API を経由する。
 *
 * クエリ:
 *   area  ゾーン（A〜W）で絞り込み。範囲外は 400
 *
 * 未ログインには 401 を返す。proxy.ts でリダイレクトされないよう
 * PUBLIC_PATHS に登録したうえで、ここで検証している。
 */
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const area = request.nextUrl.searchParams.get("area")
  if (area !== null && !isZone(area)) {
    return NextResponse.json({ error: "area が不正です" }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  let query = supabase.from("plant_positions").select("id, area, name, x, y")
  if (area) query = query.eq("area", area)

  const { data, error } = await query

  if (error) {
    console.error("[plant-positions] 取得に失敗しました", error)
    return NextResponse.json({ error: "マップデータの取得に失敗しました" }, { status: 500 })
  }

  return NextResponse.json({ positions: (data ?? []) as PlantPosition[] })
}
