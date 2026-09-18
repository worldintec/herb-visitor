import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const dynamic = "force-dynamic"

export interface PlantNoteRow {
  id: string
  content: string
  author: string | null
  created_at: string
}

/**
 * 観察ノート（来園者アプリ用・読み取りのみ）。
 * plant_notes は RLS で anon を遮断しているため、画面からは必ずこの API を経由する。
 *
 * クエリ:
 *   plantName  その植物のノートを created_at の降順で返す（必須）
 *   nonEmpty   "1" のとき、content が空のものを除く
 *
 * 来園者に見せるのは本文・記録者・日付だけで、内部IDや更新日時は返さない。
 */
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const plantName = searchParams.get("plantName")
  const nonEmpty = searchParams.get("nonEmpty") === "1"

  if (!plantName) {
    return NextResponse.json({ error: "plantName が必要です" }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  let query = supabase
    .from("plant_notes")
    .select("id, content, author, created_at")
    .eq("plant_name", plantName)

  if (nonEmpty) query = query.not("content", "is", null).neq("content", "")

  const { data, error } = await query.order("created_at", { ascending: false })

  if (error) {
    console.error("[plant-notes] 取得に失敗しました", error)
    return NextResponse.json({ error: "ノートの取得に失敗しました" }, { status: 500 })
  }

  return NextResponse.json({ notes: (data ?? []) as PlantNoteRow[] })
}
