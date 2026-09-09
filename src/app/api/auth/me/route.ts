import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSession } from "@/lib/auth"

export const dynamic = "force-dynamic"

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ user: null })

  const supabase = getSupabase()
  const { data: user } = await supabase
    .from("users")
    .select("password_reset_required")
    .eq("id", session.userId)
    .maybeSingle()

  return NextResponse.json({
    user: {
      userCode: session.userCode,
      mustChangePassword: !!user?.password_reset_required,
    },
  })
}
