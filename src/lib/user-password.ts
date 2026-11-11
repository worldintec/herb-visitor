// 利用者のパスワードを書き換える（サーバー側だけで使う）。
//
// データベースの関数 set_user_password を呼ぶ。この関数は1回の更新で
//   password_hash・password_reset_required を書き換え、session_epoch（ログインの世代）を1つ進め、
//   新しい世代を返す。該当する行が無ければ null を返す。
// 世代が進むと、それより前に発行された証（ほかの端末のログイン）は使えなくなる（B-1 #10）。
// 関数を実行できるのは service_role だけ（anon・authenticated には権限が無い）。

import { getSupabaseAdmin } from "./supabase-admin"

export type SetPasswordResult =
  | { ok: true; epoch: number }
  | { ok: false; reason: "not_found" | "error"; detail?: unknown }

export async function setUserPassword(
  userId: string,
  passwordHash: string,
  resetRequired: boolean
): Promise<SetPasswordResult> {
  const { data, error } = await getSupabaseAdmin().rpc("set_user_password", {
    p_user_id: userId,
    p_password_hash: passwordHash,
    p_reset_required: resetRequired,
  })
  if (error) return { ok: false, reason: "error", detail: error }
  // 0行の更新は null になる。成功として扱わない（B-1 #12）
  if (typeof data !== "number") return { ok: false, reason: "not_found" }
  return { ok: true, epoch: data }
}
