import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const dynamic = "force-dynamic"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

/**
 * ログイン画面の背景スライドショー用の開花写真。
 *
 * このAPIは proxy.ts の PUBLIC_PATHS に含まれており、未ログインでも叩ける。
 * ログイン前の画面が使うため、セッション検証は追加しないこと。
 *
 * plant_photos は RLS で anon を遮断しているため、anon クライアントでは
 * 1件も読めない。ここだけ service_role を使う。
 * 返すのは開花写真のURLと植物名だけに絞り、他の情報は出さない。
 */
export async function GET() {
  // try-catch で囲んでエラー詳細を拾う
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from("plant_photos")
      .select("id, storage_path, plant_name, caption")
      .eq("caption", "開花")
      .not("storage_path", "is", null)
      .neq("storage_path", "")

    if (error) {
      console.error("Supabase Error Detail:", error); // ログに詳細を出す
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const photos = (data ?? []).map((p: any) => ({
      id: p.id,
      plant_name: p.plant_name,
      url: `${SUPABASE_URL}/storage/v1/object/public/plant-photos/${p.storage_path}`,
    }))

    return NextResponse.json({ photos })
  } catch (err) {
    console.error("System Error:", err);
    return NextResponse.json({ error: "予期せぬエラーが発生しました" }, { status: 500 })
  }
}
