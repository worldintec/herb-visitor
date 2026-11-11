import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import { cache } from "react"
import { getSupabaseAdmin } from "./supabase-admin"

const secret = process.env.JWT_SECRET
if (!secret) {
  throw new Error("JWT_SECRET が設定されていません")
}
const JWT_SECRET = new TextEncoder().encode(secret)
const COOKIE_NAME = "session"

// 来園者のログイン保持期間。JWT と Cookie で同じ長さにする。
//
// 以前は30分＋セッションクッキー（ブラウザを閉じると消える）だった。
// 園内でQRコードを読むたびにログインし直しになるため30日に延ばしている。
// タブを開いている間は HEARTBEAT_INTERVAL_MS ごとの /api/auth/refresh で
// 再発行されるので、使い続けているかぎり切れない。
//
// 値はこの2つだけを直せば、ログイン・新規登録・再発行のすべてに効く。
export const JWT_EXPIRY = "30d"
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

export interface SessionPayload {
  userId: string
  userCode: string
  /**
   * ログインの世代（users.session_epoch）。パスワードを変えたとき・職員が仮パスワードを
   * 発行したときに1つ進み、それより前に発行された証は使えなくなる（B-1 #10）。
   * この仕組みより前に発行された証には入っていないので 0 とみなす（列の既定値も 0）。
   */
  epoch: number
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(JWT_SECRET)
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    if (typeof payload.userId === "string" && typeof payload.userCode === "string") {
      const epoch = typeof payload.epoch === "number" ? payload.epoch : 0
      return { userId: payload.userId, userCode: payload.userCode, epoch }
    }
    return null
  } catch {
    return null
  }
}

export async function setSessionCookie(token: string) {
  const store = await cookies()
  // maxAge を付けることで、ブラウザやホーム画面のアプリを閉じても残る。
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  })
}

export async function clearSessionCookie() {
  const store = await cookies()
  // 発行時と同じ属性で上書きして消す。属性が食い違うと消えずに残るため、
  // path などは setSessionCookie と必ず揃えること。
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
}

// データベースの世代を、利用者ごとに短いあいだ覚えておく（同じサーバーの中だけ）。
// ホームを1回開くと、リンクの先読み（エリアのマス目23個など）でも照合が走り、覚えておかないと
// 1回の表示で数十回 users を読むことになる（2026-11-11 に計測：67回）。
// 覚えている値と証の世代が違うときは、必ずデータベースを読み直す。パスワードを変えた本人の
// 新しい証（世代が進んでいる）を、古い値のせいでログアウトさせないため。
// そのかわり、ほかの端末が切れるのは最長でこの秒数だけ遅れる。
const EPOCH_CACHE_MS = 10_000
const epochCache = new Map<string, { epoch: number | null; at: number }>()

async function readEpoch(userId: string): Promise<{ ok: true; epoch: number | null } | { ok: false }> {
  const { data, error } = await getSupabaseAdmin()
    .from("users")
    .select("session_epoch")
    .eq("id", userId)
    .maybeSingle()
  if (error) {
    console.error("[auth] ログインの世代を確かめられませんでした。切らずに続けます", error)
    return { ok: false }
  }
  const epoch = data ? ((data.session_epoch as number | null) ?? 0) : null // null は行が無い（退会）
  epochCache.set(userId, { epoch, at: Date.now() })
  return { ok: true, epoch }
}

/** パスワードを書き換えたあとに呼ぶ。このサーバーが覚えている世代を、すぐに新しい値にする */
export function rememberSessionEpoch(userId: string, epoch: number) {
  epochCache.set(userId, { epoch, at: Date.now() })
}

/**
 * 証の世代が、いまの users.session_epoch と同じか（B-1 #10）。
 * パスワードを変えた・仮パスワードが発行された・退会した（行が無い）なら false。
 *
 * 確かめられなかったとき（データベースの一瞬の不調）は true（切らない）。
 * 一瞬の不調で全員が同時にログアウトするほうが害が大きく、データベースが止まれば
 * どのみちアプリは使えないので、切らないことで攻撃者の時間が延びるわけではない（2026-11-11 判断）。
 */
export async function isSessionCurrent(session: SessionPayload): Promise<boolean> {
  const cached = epochCache.get(session.userId)
  if (cached && Date.now() - cached.at < EPOCH_CACHE_MS && cached.epoch === session.epoch) {
    return true
  }
  const fresh = await readEpoch(session.userId)
  if (!fresh.ok) return true
  return fresh.epoch !== null && fresh.epoch === session.epoch
}

/**
 * いまのログイン。証の署名・期限に加えて、世代がデータベースと同じかを確かめる。
 * 同じリクエストの中では1回だけ確かめる（画面の枠などで何度呼んでも問い合わせは1回）。
 */
export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (!token) return null
  const session = await verifySessionToken(token)
  if (!session) return null
  return (await isSessionCurrent(session)) ? session : null
})

export const ID_PATTERN = /^[a-zA-Z0-9]{8,16}$/
export const PW_PATTERN = /^[a-zA-Z0-9]{8,16}$/
