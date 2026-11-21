import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import bcrypt from "bcryptjs"
import { createSessionToken, setSessionCookie, ID_PATTERN, PW_PATTERN } from "@/lib/auth"
import { RATE_LIMITS, RATE_LIMIT_MESSAGES, anyOverLimit, clientIp, hitAll, rateKey } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

// JIT warmup: bcryptjs は初回呼び出し時に V8 コンパイルが走り遅延するため
// モジュールロード時に低コストで一度実行してキャッシュさせる
bcrypt.hashSync("__warmup__", 1)

// ID が存在しないときも、これと照合して返事の時間をそろえる（C #83）。
// 照合を飛ばすと返事が速く返り、時間を測れば ID があるかが分かってしまう。強さは本物と同じ 10
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", 10)

// 停止中・期限切れの文言は、パスワードが合っていたときだけ出す（B-5 #87・#88）。
// 合っていないときは、ふつうの誤りと同じ文言にして、停止や仮パスワードの有無が漏れないようにする
const SUSPENDED_MESSAGE =
  "このアカウントはご利用を停止しています。見沼氷川公園　管理棟の窓口へお問い合わせください。"
const TEMP_EXPIRED_MESSAGE =
  "この仮パスワードは有効期限が切れています。見沼氷川公園　管理棟の窓口で、あらためて再発行の手続きをお願いします。"

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase()
  try {
    const { userId, password } = await request.json()

    if (!ID_PATTERN.test(userId) || !PW_PATTERN.test(password)) {
      return NextResponse.json({ error: "IDまたはパスワードが正しくありません" }, { status: 401 })
    }

    // 回数制限（C #83）。ID を探す前に見るので、ID があってもなくても同じ数え方・同じ文言になる
    const ip = clientIp(request)
    const keys = {
      idip: rateKey("login:idip", "login-idip", `${userId}|${ip}`),
      id: rateKey("login:id", "login-id", userId),
      ip: rateKey("login:ip", "login-ip", ip),
    }
    if (
      await anyOverLimit([
        [keys.idip, RATE_LIMITS.loginPerIdIp],
        [keys.id, RATE_LIMITS.loginPerId],
        [keys.ip, RATE_LIMITS.loginPerIp],
      ])
    ) {
      return NextResponse.json({ error: RATE_LIMIT_MESSAGES.login, code: "rate_limited" }, { status: 429 })
    }
    const fail = async () => {
      await hitAll([
        [keys.idip, RATE_LIMITS.loginPerIdIp],
        [keys.id, RATE_LIMITS.loginPerId],
        [keys.ip, RATE_LIMITS.loginPerIp],
      ])
      return NextResponse.json({ error: "IDまたはパスワードが正しくありません" }, { status: 401 })
    }

    const { data: user } = await supabase
      .from("users")
      .select("id, user_id, password_hash, password_reset_required, session_epoch, suspended_at, temp_password_expires_at")
      .eq("user_id", userId)
      .maybeSingle()

    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH)
      return fail()
    }

    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) {
      return fail()
    }

    // 職員が利用を停止した会員（職員アプリの「会員の管理」）。停止は期限切れより先に見る
    if (user.suspended_at) {
      return NextResponse.json({ error: SUSPENDED_MESSAGE, code: "suspended" }, { status: 403 })
    }
    // 仮パスワード（変更待ち）の期限は発行から7日。期限は変更待ちのときだけ見る
    // （本人がパスワードを変えると変更待ちが外れ、古い期限の値は使わない）
    if (
      user.password_reset_required &&
      user.temp_password_expires_at &&
      new Date(user.temp_password_expires_at).getTime() < Date.now()
    ) {
      return NextResponse.json({ error: TEMP_EXPIRED_MESSAGE, code: "temp_password_expired" }, { status: 403 })
    }

    // last_login_at の更新はレスポンスをブロックしない（fire and forget）
    supabase
      .from("users")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", user.id)
      .then(() => {}, () => {})

    // 証にはいまの世代を入れる（パスワードの変更などで世代が進むと、この証は使えなくなる）
    const token = await createSessionToken({
      userId: user.id,
      userCode: user.user_id,
      epoch: user.session_epoch ?? 0,
    })
    await setSessionCookie(token)

    return NextResponse.json({
      success: true,
      userCode: user.user_id,
      mustChangePassword: !!user.password_reset_required,
    })
  } catch {
    return NextResponse.json({ error: "リクエストの処理に失敗しました" }, { status: 500 })
  }
}
