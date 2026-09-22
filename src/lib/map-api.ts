import type { MapPlot, PlantPosition, ZoneOffset } from "@/types/database"

// 画面から /api/map-plots, /api/zone-offsets, /api/plant-positions を呼ぶための共通関数。
// これら3テーブルは RLS で anon を遮断するため、画面からは必ずこの API を経由する。
//
// このファイルは Client Component から import される。
// lib/supabase-admin.ts を import してはいけない（service_role キーがブラウザに配布される）。
//
// 取得に失敗したときは必ず例外を投げる。空配列を返して「0件」に見せてはいけない。
// 401（未ログイン）も特別扱いせず例外として扱う。

/** 来園者に見せるエラー文言。技術的な内容は画面に出さない。 */
export const MAP_LOAD_ERROR = "読み込みに失敗しました。時間をおいてもう一度お試しください"

/** マップ上のプロット一覧。失敗時は例外を投げる。 */
export async function fetchMapPlots(): Promise<MapPlot[]> {
  const res = await fetch("/api/map-plots")
  if (!res.ok) throw new Error(`マップデータの取得に失敗しました (status=${res.status})`)
  const { plots } = await res.json()
  return (plots ?? []) as MapPlot[]
}

/** ゾーンオフセット一覧。失敗時は例外を投げる。 */
export async function fetchZoneOffsets(): Promise<ZoneOffset[]> {
  const res = await fetch("/api/zone-offsets")
  if (!res.ok) throw new Error(`マップデータの取得に失敗しました (status=${res.status})`)
  const { offsets } = await res.json()
  return (offsets ?? []) as ZoneOffset[]
}

/** 植物の配置座標。area を渡すとそのゾーンのみ。失敗時は例外を投げる。 */
export async function fetchPlantPositions(area?: string): Promise<PlantPosition[]> {
  const res = await fetch(`/api/plant-positions${area ? `?area=${encodeURIComponent(area)}` : ""}`)
  if (!res.ok) throw new Error(`マップデータの取得に失敗しました (status=${res.status})`)
  const { positions } = await res.json()
  return (positions ?? []) as PlantPosition[]
}
