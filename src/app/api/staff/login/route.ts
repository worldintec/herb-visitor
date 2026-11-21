import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import bcrypt from "bcryptjs"
import { createStaffSessionToken, setStaffSessionCookie, STAFF_USERNAME_PATTERN } from "@/lib/staff-auth"
import { RATE_LIMITS, RATE_LIMIT_MESSAGES, anyOverLimit, clientIp, hitAll, rateKey } from "@/lib/rate-limit"

// 職員 ID が無い・止めた職員のときも、これと照合して返事の時間をそろえる（C #83）
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", 10)

export const dynamic = "force-dynamic"

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase()
  try {
    const { staffUsername, password } = await request.json()

    if (!STAFF_USERNAME_PATTERN.test(staffUsername || "") || !password) {
      return NextResponse.json({ error: "IDまたはパスワードが正しくありません" }, { status: 401 })
    }

    // 回数制限（C #83）。職員 ID ごと（15分に10回）と IP ごと（15分に20回）の失敗。
    // 職員アプリのログインと同じ key なので、どちらで失敗しても同じ数に入る。
    // ID ごとの上限は、推測できる ID をわざと失敗させられると15分入れなくなるが、総当たりを通すほうが危険なので残す
    // （解除は SQL：delete from public.rate_limit_counters where key like 'stafflogin:%';）
    const keys = {
      id: rateKey("stafflogin:id", "stafflogin-id", staffUsername),
      ip: rateKey("stafflogin:ip", "stafflogin-ip", clientIp(request)),
    }
    if (await anyOverLimit([[keys.id, RATE_LIMITS.staffLoginPerId], [keys.ip, RATE_LIMITS.staffLoginPerIp]])) {
      return NextResponse.json({ error: RATE_LIMIT_MESSAGES.login, code: "rate_limited" }, { status: 429 })
    }
    const fail = async () => {
      await hitAll([[keys.id, RATE_LIMITS.staffLoginPerId], [keys.ip, RATE_LIMITS.staffLoginPerIp]])
      return NextResponse.json({ error: "IDまたはパスワードが正しくありません" }, { status: 401 })
    }

    const { data: staff } = await supabase
      .from("staff_users")
      .select("id, staff_username, password_hash, is_active")
      .eq("staff_username", staffUsername)
      .maybeSingle()

    if (!staff || staff.is_active !== true) {
      await bcrypt.compare(password, DUMMY_HASH)
      return fail()
    }

    const ok = await bcrypt.compare(password, staff.password_hash)
    if (!ok) {
      return fail()
    }

    const token = await createStaffSessionToken({ staffId: staff.id, staffUsername: staff.staff_username })
    await setStaffSessionCookie(token)

    return NextResponse.json({ success: true, staffUsername: staff.staff_username })
  } catch {
    return NextResponse.json({ error: "リクエストの処理に失敗しました" }, { status: 500 })
  }
}
