import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

export async function GET() {
  const { data, error } = await supabase
    .from("plant_photos")
    .select("id, storage_path, plant_name, caption")
    .eq("caption", "開花")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const photos = (data ?? []).map((p) => ({
    id: p.id,
    plant_name: p.plant_name,
    url: `${SUPABASE_URL}/storage/v1/object/public/plant-photos/${p.storage_path}`,
  }))

  return NextResponse.json({ photos })
}
