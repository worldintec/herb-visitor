import { createHmac } from "crypto"
import type { NextRequest } from "next/server"
import { getSupabaseAdmin } from "./supabase-admin"

// 回数制限（C #83）。登録・ログイン・パスワードの変更で、機械による大量の試みを止める。
//
// ・数はデータベースの表 rate_limit_counters に置く（Vercel ではサーバーが何台にも分かれて
//   すぐ消えるので、手元のメモリでは数えられない）。足すのは関数 rate_limit_hit、
//   見るだけは rate_limit_count（どちらも service_role だけが実行できる）
// ・IPアドレスもIDも、そのままは保存しない。サーバーだけが知る合言葉（RATE_LIMIT_SECRET）と
//   今日の日付を混ぜて、元に戻せない符号（HMAC-SHA256）にしてから key に入れる。
//   合言葉が無いと、IPv4 は約43億通りしかないので総当たりで戻せてしまう。日付を混ぜるので、
//   日をまたいで同じ人を追いかけることもできない。IP を含む数の窓は最長1時間で、期限が切れた行は消える
//   （Supabase の定期実行で1分ごと。数えるたびにも消す）
// ・確かめられなかったとき（データベースの不調・合言葉の設定漏れ）は、弾かずに通す（C #82 と同じ方針）
//
// key の形（こちらが SQL の like で引けるように、頭の部分は決まった形にしてある）
//   register:ip:<符号>              同じ IP からの登録の試み（1時間に120回）
//   register:daily:<YYYY-MM-DD>     その日（日本時間）の登録の成功数。IP も ID も入らない
//   login:idip:<符号> / login:id:<符号> / login:ip:<符号>   来園者のログインの失敗
//   pwchange:user:<符号>            パスワードの変更で、いまのパスワードを間違えた数
//   stafflogin:id:<符号> / stafflogin:ip:<符号>             職員のログインの失敗（両アプリ共通）

export const RATE_LIMITS = {
  // イベントで同じ Wi-Fi から40人が登録し、1人2回やり直しても（40人×3回＝120回）収まる数。
  // 機械による大量の登録は、下の「1日150件」で止める
  registerPerIp: { limit: 120, windowSec: 60 * 60 },
  // 目標は2027年度で300名。イベントの日でも届かない。機械で大量に作られたときの止め役
  registerDaily: { limit: 150, windowSec: 24 * 60 * 60 },
  // 本人の打ち間違いには十分
  loginPerIdIp: { limit: 10, windowSec: 15 * 60 },
  // 多くの IP から1つの ID を狙う攻撃。パスワードは英数字8文字以上なので、1時間30回では当たらない
  loginPerId: { limit: 30, windowSec: 60 * 60 },
  // 多くの ID を順に試す攻撃
  loginPerIp: { limit: 50, windowSec: 15 * 60 },
  pwChangePerUser: { limit: 10, windowSec: 15 * 60 },
  staffLoginPerId: { limit: 10, windowSec: 15 * 60 },
  staffLoginPerIp: { limit: 20, windowSec: 15 * 60 },
} as const

export type RateRule = { limit: number; windowSec: number }

export const RATE_LIMIT_MESSAGES = {
  register: "登録の受け付けが混み合っています。しばらく時間をおいてから、もう一度お試しください。",
  login: "ログインの試行が続いたため、しばらく受け付けを止めています。15分ほど時間をおいてから、もう一度お試しください。",
  pwChange: "いまのパスワードの入力に何度も失敗したため、しばらく変更を受け付けません。15分ほど時間をおいてから、お試しください。",
} as const

/** 日本時間の今日（YYYY-MM-DD） */
export function todayInJapan(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date())
}

/**
 * 利用者の IP。Vercel が x-real-ip・x-forwarded-for に入れる（利用者が付けた値は Vercel が上書きする）。
 * IPv6 は1台に /64 が丸ごと割り当てられるので、前半の4つ（/64）だけを使う。取れなければ "unknown"
 */
export function clientIp(request: NextRequest): string {
  const raw =
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    ""
  if (!raw) return "unknown"
  if (raw.includes(":") && !raw.includes(".")) {
    // IPv6。"::" を展開してから前半4つ
    const [head, tail = ""] = raw.split("::")
    const h = head ? head.split(":") : []
    const t = tail ? tail.split(":") : []
    const full = raw.includes("::") ? [...h, ...Array(8 - h.length - t.length).fill("0"), ...t] : h
    return full.slice(0, 4).map((x) => x.toLowerCase().replace(/^0+(?=.)/, "")).join(":") + "::/64"
  }
  return raw
}

/** 元に戻せない符号。合言葉が無ければ null（回数制限を止める） */
export function digest(kind: string, value: string): string | null {
  const secret = process.env.RATE_LIMIT_SECRET
  if (!secret) return null
  return createHmac("sha256", secret).update(`${todayInJapan()}:${kind}:${value}`).digest("hex").slice(0, 32)
}

/** 決まった頭＋符号の key。合言葉が無ければ null */
export function rateKey(prefix: string, kind: string, value: string): string | null {
  const d = digest(kind, value)
  return d ? `${prefix}:${d}` : null
}

let warnedNoSecret = false
function warnNoSecret() {
  if (warnedNoSecret) return
  warnedNoSecret = true
  console.error("[rate-limit] RATE_LIMIT_SECRET が設定されていません。回数制限を止めて続けます")
}

/** いまの数が上限に届いているか（足さない）。確かめられなければ false（通す） */
export async function isOverLimit(key: string | null, rule: RateRule): Promise<boolean> {
  if (!key) {
    warnNoSecret()
    return false
  }
  try {
    const { data, error } = await getSupabaseAdmin().rpc("rate_limit_count", { p_key: key })
    if (error) throw error
    return typeof data === "number" && data >= rule.limit
  } catch (err) {
    console.error("[rate-limit] 数を確かめられませんでした。弾かずに続けます", err)
    return false
  }
}

/** どれか1つでも上限に届いていれば true */
export async function anyOverLimit(checks: [string | null, RateRule][]): Promise<boolean> {
  const results = await Promise.all(checks.map(([k, r]) => isOverLimit(k, r)))
  return results.some(Boolean)
}

/** 1つ足して、足したあとの数を返す。確かめられなければ 0（通す） */
export async function hitLimit(key: string | null, rule: RateRule): Promise<number> {
  if (!key) {
    warnNoSecret()
    return 0
  }
  try {
    const { data, error } = await getSupabaseAdmin().rpc("rate_limit_hit", {
      p_key: key,
      p_window_seconds: rule.windowSec,
    })
    if (error) throw error
    return typeof data === "number" ? data : 0
  } catch (err) {
    console.error("[rate-limit] 数を足せませんでした。弾かずに続けます", err)
    return 0
  }
}

/** まとめて1つずつ足す（ログインの失敗など） */
export async function hitAll(hits: [string | null, RateRule][]): Promise<void> {
  await Promise.all(hits.map(([k, r]) => hitLimit(k, r)))
}
