import type { Plant } from "@/types/database"

// 画面から /api/plants を呼ぶための共通関数。
// plants は RLS で anon を遮断するため、画面からは必ずこの API を経由する。
//
// このファイルは Client Component から import される。
// lib/supabase-admin.ts を import してはいけない（service_role キーがブラウザに配布される）。
//
// 取得に失敗したときは必ず例外を投げる。空配列を返して「0件」に見せると、
// 2026年7月の障害（植物データが0件になったことに気づけなかった）と同じことが起きる。

/** 来園者に見せるエラー文言。技術的な内容は画面に出さない。 */
export const PLANTS_LOAD_ERROR = "読み込みに失敗しました。時間をおいてもう一度お試しください"

/** GET /api/plants の並び順。許可リスト方式。 */
export type PlantOrder = "created_at_desc" | "area_name" | "area_plant_no" | "name"

export interface FetchPlantsParams {
  area?: string
  planted?: boolean
  /** 未指定のときは並び替えなし */
  order?: PlantOrder
}

/** 植物の一覧。失敗時は例外を投げる。 */
export async function fetchPlants(params: FetchPlantsParams = {}): Promise<Plant[]> {
  const q = new URLSearchParams()
  if (params.area) q.set("area", params.area)
  if (params.planted) q.set("planted", "true")
  if (params.order) q.set("order", params.order)

  const res = await fetch(`/api/plants${q.toString() ? `?${q}` : ""}`)
  if (!res.ok) throw new Error(`植物データの取得に失敗しました (status=${res.status})`)
  const { plants } = await res.json()
  return (plants ?? []) as Plant[]
}

/** 見つからなかった場合と、取得そのものに失敗した場合を呼び出し側で区別できるようにする。 */
export type FetchPlantResult =
  | { status: "ok"; plant: Plant }
  | { status: "not_found" }
  | { status: "error" }

/** 植物1件。QRコードからの遷移先で使う。 */
export async function fetchPlant(id: string): Promise<FetchPlantResult> {
  try {
    const res = await fetch(`/api/plants?id=${encodeURIComponent(id)}`)
    if (res.status === 404) return { status: "not_found" }
    if (!res.ok) {
      console.error("plants 取得失敗", res.status)
      return { status: "error" }
    }
    const { plant } = await res.json()
    return { status: "ok", plant: plant as Plant }
  } catch (e) {
    console.error("plants 取得失敗", e)
    return { status: "error" }
  }
}
