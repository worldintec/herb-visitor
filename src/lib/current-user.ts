// ログイン中アカウントの user_id（users.id）をクライアントから取得するためのヘルパー。
// マイノートは user_id に紐づけて保存・取得するため、Supabase へ問い合わせる前にこれを使う。

export interface CurrentUser {
  userId: string
  userCode: string
  mustChangePassword: boolean
}

export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  try {
    const res = await fetch("/api/auth/me")
    if (!res.ok) return null
    const { user } = await res.json()
    return user?.userId ? (user as CurrentUser) : null
  } catch {
    // 通信失敗時は未ログイン扱いにする（呼び出し側でログイン画面へ誘導する）
    return null
  }
}
