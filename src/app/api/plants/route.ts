import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import type { Plant } from "@/types/database"

export const dynamic = "force-dynamic"

/** 並び順は許可リスト方式。クライアントから任意の列名を渡させない。 */
const ORDERS = {
  created_at_desc: [{ column: "created_at", ascending: false }],
  area_name: [
    { column: "area", ascending: true },
    { column: "name", ascending: true },
  ],
  area_plant_no: [
    { column: "area", ascending: true },
    { column: "plant_no", ascending: true },
  ],
  name: [{ column: "name", ascending: true }],
} as const

type OrderKey = keyof typeof ORDERS

/**
 * 植物マスタ（来園者アプリ用・読み取りのみ）。
 * plants は RLS で anon を遮断しているため、画面からは必ずこの API を経由する。
 * 来園者アプリから plants への書き込みは無いので、GET だけを定義する。
 *
 * クエリ:
 *   id       1件取得。該当なしは 404 → { plant }
 *   area     エリアで絞り込み
 *   planted  "true" のとき is_planted = true のみ
 *   order    並び順（許可リスト）。未指定は並び替えなし
 *
 * 未ログインには 401 を返す。proxy.ts でリダイレクトされないよう
 * PUBLIC_PATHS に登録したうえで、ここで検証している。
 */
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const id = searchParams.get("id")
  const area = searchParams.get("area")
  const planted = searchParams.get("planted") === "true"
  const orderParam = searchParams.get("order")

  if (orderParam !== null && !(orderParam in ORDERS)) {
    return NextResponse.json({ error: "order が不正です" }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  // 1件取得（QRコードからの遷移先など）
  if (id) {
    const { data, error } = await supabase
      .from("plants")
      .select("*")
      .eq("id", id)
      .maybeSingle()
    if (error) {
      console.error("[plants] 取得に失敗しました", error)
      return NextResponse.json({ error: "植物データの取得に失敗しました" }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: "植物が見つかりません" }, { status: 404 })
    }
    return NextResponse.json({ plant: data as Plant })
  }

  let query = supabase.from("plants").select("*")
  if (area) query = query.eq("area", area)
  if (planted) query = query.eq("is_planted", true)
  if (orderParam) {
    for (const o of ORDERS[orderParam as OrderKey]) {
      query = query.order(o.column, { ascending: o.ascending })
    }
  }

  const { data, error } = await query

  if (error) {
    console.error("[plants] 一覧の取得に失敗しました", error)
    return NextResponse.json({ error: "植物データの取得に失敗しました" }, { status: 500 })
  }

  return NextResponse.json({ plants: (data ?? []) as Plant[] })
}
