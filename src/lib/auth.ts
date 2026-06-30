import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "herb-visitor-secret-fallback-change-me-please"
)
const COOKIE_NAME = "session"
// JWTの有効期限。タブ/ブラウザを閉じるとハートビートが止まり、この期限で自然失効する。
// ハートビートは HEARTBEAT_INTERVAL_MS ごとに /api/auth/refresh を呼び、トークンを更新する。
export const JWT_EXPIRY = "30m"

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
  // maxAge/expires を指定しないことでセッションクッキーとして発行する。
  // ブラウザを閉じると自動的に失効する。
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  })
}

export async function clearSessionCookie() {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifySessionToken(token)
}

export const ID_PATTERN = /^[a-zA-Z0-9]{8,16}$/
export const PW_PATTERN = /^[a-zA-Z0-9]{8,16}$/
