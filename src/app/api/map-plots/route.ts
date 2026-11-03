import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import type { MapPlot } from "@/types/database"

export const dynamic = "force-dynamic"

/**
 * 返す列。全体マップが使っている列だけを、許可する形で並べる（select("*") は使わない）。
 * 並び順の created_at は select に含めなくても効く。
 * 列を足すときは types/database.ts の MapPlot も同じように直す。
 */
const MAP_PLOT_COLUMNS = "id, zone, name, type, x, y"

/**
 * マップ上のプロット（来園者アプリ用・読み取りのみ）。
 * map_plots は RLS で anon を遮断するため、画面からは必ずこの API を経由する。
 *
 * 未ログインには 401 を返す。proxy.ts でリダイレクトされないよう
 * PUBLIC_PATHS に登録したうえで、ここで検証している。
 */
export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from("map_plots")
    .select(MAP_PLOT_COLUMNS)
    .order("created_at")

  if (error) {
    console.error("[map-plots] 取得に失敗しました", error)
    return NextResponse.json({ error: "マップデータの取得に失敗しました" }, { status: 500 })
  }

  return NextResponse.json({ plots: (data ?? []) as MapPlot[] })
}
