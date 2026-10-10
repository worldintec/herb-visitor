import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { getSession, clearSessionCookie } from "@/lib/auth"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { NOTES_TABLE, NOTES_BUCKET } from "@/lib/visitor-notes"

export const dynamic = "force-dynamic"

/**
 * 退会（利用者の削除）。
 *
 * proxy.ts の PUBLIC_PATHS に "/api/auth/" が入っているため、このルートは
 * 前方一致で通過する。login / register を未ログインで叩けるようにするための
 * 既存の設定で、唯一の防御は下の getSession() である。絶対に外さないこと。
 *
 * 【消す順序】c〜f の順序を入れ替えないこと。
 * users を消すと userId を二度と特定できず、公開バケットに消し方を失った
 * ファイルが残る。だから「Storage が空になるまで users を消さない」。
 * c〜e のどこかで失敗したら f へ進まず 500 を返し、セッションも消さない
 * （ログインしたまま＝本人がそのまま再試行できる状態を保つ）。
 *
 * 【部分成功を 200 で返さない】退会は「消えたか、消えていないか」の二値。
 * map-edits の failures[] 方式は使わない。例外は g（通知の購読）だけで、
 * あちらは f で退会が成立したあとのベストエフォート。
 */

/** 失敗時の文言。どの段階で失敗しても同じ（利用者には段階を伝えても判断できない）。 */
const WITHDRAW_ERROR =
  "退会の処理に失敗しました。お手数ですが管理棟の窓口にお申し出ください。"

/** Storage の list() 1回あたりの件数。 */
const LIST_PAGE_SIZE = 100
/** remove() に一度に渡す件数。 */
const REMOVE_CHUNK_SIZE = 100
/** 無限ループ防止の上限。1人のノートがこの数に達することはない。 */
const MAX_FILES = 10000

function failed(stage: string, detail: unknown) {
  console.error(`[auth/withdraw] ${stage} に失敗しました`, detail)
  return NextResponse.json({ error: WITHDRAW_ERROR }, { status: 500 })
}

export async function POST(request: NextRequest) {
  // a. セッション
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const userId = session.userId

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "リクエストの形式が不正です" }, { status: 400 })
  }
  const { password, pushEndpoint } = body as Record<string, unknown>
  if (typeof password !== "string" || !password) {
    return NextResponse.json({ error: "パスワードが正しくありません" }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()

  // b. 本人確認。照合用の独立したAPIは作らず、ここで bcrypt.compare する。
  // 有効なセッションがあることが前提なので、試行回数の制限は付けない。
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, password_hash")
    .eq("id", userId)
    .maybeSingle()

  if (userError) return failed("利用者の取得", userError)
  if (!user) {
    // 行が無い＝すでに退会済みのトークンでの再実行。何も消さない。
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const passwordOk = await bcrypt.compare(password, user.password_hash as string)
  if (!passwordOk) {
    return NextResponse.json({ error: "パスワードが正しくありません" }, { status: 401 })
  }

  // c. マイノートの行。写真の実体より先に消す（第13段階の「行 → 実体」）。
  // 途中で止まっても「ノートは消えている＋見えないゴミファイルが残る」で収まり、
  // 再実行すれば d の list() が拾って掃除できる。
  const { error: notesError } = await supabase
    .from(NOTES_TABLE)
    .delete()
    .eq("user_id", userId)
  if (notesError) return failed("マイノートの削除", notesError)

  // d. 写真の実体。photo_path は事前に集めない。
  // アップロードが pathPrefix `${userId}/` で固定されており（my-notes/new）、
  // parseNotePayload も `${userId}/` で始まるパスだけを許可しているため、
  // ある利用者の写真は必ず visitor-notes/<userId>/ 配下にしかない。
  const paths: string[] = []
  let offset = 0
  for (;;) {
    const { data: entries, error: listError } = await supabase.storage
      .from(NOTES_BUCKET)
      .list(userId, {
        limit: LIST_PAGE_SIZE,
        offset,
        // ページをまたぐときの取りこぼしを防ぐため並び順を固定する
        sortBy: { column: "name", order: "asc" },
      })
    if (listError) return failed("写真の列挙", listError)

    const page = entries ?? []
    // list() の name はプレフィックスを含まないので組み立て直す
    for (const entry of page) paths.push(`${userId}/${entry.name}`)

    // 列挙中は削除しない。全件集めてから remove() に渡す
    // （削除しながら offset を進めると並びがずれて取りこぼす）。
    if (page.length < LIST_PAGE_SIZE) break
    offset += LIST_PAGE_SIZE

    if (paths.length >= MAX_FILES) {
      // ここに来たら想定外。users を消すと残りを特定できなくなるので中断する。
      return failed("写真の列挙（件数が上限を超えた）", { userId, count: paths.length })
    }
  }

  if (paths.length > 0) {
    // 0件のときは remove() を呼ばない（空配列でエラーになる実装があるため）
    for (let i = 0; i < paths.length; i += REMOVE_CHUNK_SIZE) {
      const chunk = paths.slice(i, i + REMOVE_CHUNK_SIZE)
      const { data: removed, error: removeError } = await supabase.storage
        .from(NOTES_BUCKET)
        .remove(chunk)
      if (removeError) return failed("写真の削除", removeError)

      // 要求した配列と戻り値を突き合わせる。remove() の戻り値の name は
      // 渡したパスがそのまま入る。差分は職員が手で掃除できるよう全件出す。
      const removedPaths = new Set((removed ?? []).map((f) => f.name))
      const notRemoved = chunk.filter((p) => !removedPaths.has(p))
      if (notRemoved.length > 0) {
        console.error(
          "[auth/withdraw] 削除できなかった写真が残りました",
          notRemoved
        )
      }
    }
  }

  // e. お問い合わせ。現在このテーブルに書き込む経路はアプリに無いため
  // 常に0件削除になるが、後から機能を作ったときに取り残さないよう入れておく。
  const { error: contactsError } = await supabase
    .from("contacts")
    .delete()
    .eq("user_id", userId)
  if (contactsError) return failed("お問い合わせの削除", contactsError)

  // f. 利用者本体。ここで退会が成立する。
  // password_reset_logs は SET NULL（20261010_password_reset_logs_set_null.sql）、
  // visitor_notes は CASCADE、contacts は SET NULL で、削除を妨げない。
  const { error: deleteUserError } = await supabase
    .from("users")
    .delete()
    .eq("id", userId)
  if (deleteUserError) return failed("利用者の削除", deleteUserError)

  // g. 通知の購読。ここから先はベストエフォートで、失敗しても 200 を返す。
  // user_id では消せない（全件 NULL。外部キーが auth.users を指しているため
  // public.users の uuid では登録できない既知の不具合）。endpoint で消す。
  // 列名と条件は api/push-subscribe の DELETE と同じ。
  let pushCleared = false
  if (typeof pushEndpoint === "string" && pushEndpoint) {
    const { error: pushError } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", pushEndpoint)
    if (pushError) {
      console.error("[auth/withdraw] 通知の購読の削除に失敗しました", pushError)
    } else {
      pushCleared = true
    }
  }

  // h. セッションを消す
  await clearSessionCookie()

  return NextResponse.json({ success: true, pushCleared })
}
