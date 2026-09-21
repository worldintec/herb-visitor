import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"

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
      return { userId: payload.userId, userCode: payload.userCode }
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

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifySessionToken(token)
}

export const ID_PATTERN = /^[a-zA-Z0-9]{8,16}$/
export const PW_PATTERN = /^[a-zA-Z0-9]{8,16}$/
