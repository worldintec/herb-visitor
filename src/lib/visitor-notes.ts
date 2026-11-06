// マイノート（visitor_notes）の Route Handler で共有する定数とリクエスト検証。
// user_id はクライアントから受け取らず、必ずセッションの userId を使う。

export const NOTES_TABLE = "visitor_notes"
export const NOTES_BUCKET = "visitor-notes"
// マイノートの写真（1行＝1枚）。2026-11-06 に作成。sort_order がいちばん小さいものが代表。
// visitor_notes.photo_path にも代表のパスを書き続ける（切り戻せるように。いずれ片付ける）。
export const NOTE_PHOTOS_TABLE = "visitor_note_photos"
// 1件のノートに付けられる写真の枚数。サーバーで必ず検査する（画面だけの制限にしない）。
export const MAX_NOTE_PHOTOS = 3

// 一覧・詳細で返す列。user_id / session_id は画面で使わないため返さない。
export const NOTE_COLUMNS =
  "id, plant_id, plant_name, note_text, photo_path, visit_date, created_at, updated_at"

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export interface NotePayload {
  plant_id: string | null
  plant_name: string | null
  note_text: string
  /** 代表の写真のパス（photoPaths の先頭）。visitor_notes.photo_path に入れる */
  photo_path: string | null
  visit_date: string
}

type ParseResult =
  | { ok: true; value: NotePayload; photoPaths: string[] }
  | { ok: false; error: string }

/**
 * ノートの登録・更新リクエストの検証。
 *
 * 写真は photoPaths（並び順どおりのパスの配列。先頭が代表、0〜3件）で受け取る。
 * パスは「<userId>/...」の形のみ許可し、他人の写真を指定できないようにする。
 * 1枚だけの古い形（photoPath）しか送ってこない画面は、ほかの写真を消してしまわないよう拒否する。
 */
export function parseNotePayload(body: unknown, userId: string): ParseResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "リクエストの形式が不正です" }
  }
  const { plantId, plantName, noteText, visitDate, photoPaths } = body as Record<
    string,
    unknown
  >

  if (typeof noteText !== "string" || !noteText.trim()) {
    return { ok: false, error: "メモを入力してください" }
  }
  if (typeof visitDate !== "string" || !DATE_PATTERN.test(visitDate)) {
    return { ok: false, error: "訪問日が不正です" }
  }
  if (!Array.isArray(photoPaths)) {
    return {
      ok: false,
      error: "アプリが新しくなりました。画面を読み込み直してから、もう一度保存してください。",
    }
  }
  if (photoPaths.length > MAX_NOTE_PHOTOS) {
    return { ok: false, error: `写真は${MAX_NOTE_PHOTOS}枚までです` }
  }
  for (const path of photoPaths) {
    if (typeof path !== "string" || !path.startsWith(`${userId}/`) || path.includes("..")) {
      return { ok: false, error: "写真の指定が不正です" }
    }
  }
  if (new Set(photoPaths).size !== photoPaths.length) {
    return { ok: false, error: "写真の指定が不正です" }
  }
  const paths = photoPaths as string[]

  return {
    ok: true,
    photoPaths: paths,
    value: {
      plant_id: typeof plantId === "string" && plantId ? plantId : null,
      plant_name: typeof plantName === "string" && plantName ? plantName : null,
      note_text: noteText.trim(),
      photo_path: paths[0] ?? null,
      visit_date: visitDate,
    },
  }
}
