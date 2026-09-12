// マイノート（visitor_notes）の Route Handler で共有する定数とリクエスト検証。
// user_id はクライアントから受け取らず、必ずセッションの userId を使う。

export const NOTES_TABLE = "visitor_notes"
export const NOTES_BUCKET = "visitor-notes"

// 一覧・詳細で返す列。user_id / session_id は画面で使わないため返さない。
export const NOTE_COLUMNS =
  "id, plant_id, plant_name, note_text, photo_path, visit_date, created_at, updated_at"

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export interface NotePayload {
  plant_id: string | null
  plant_name: string | null
  note_text: string
  photo_path: string | null
  visit_date: string
}

type ParseResult =
  | { ok: true; value: NotePayload }
  | { ok: false; error: string }

/**
 * ノートの登録・更新リクエストの検証。
 * photoPath は「<userId>/...」の形のみ許可し、他人の写真を指定できないようにする。
 */
export function parseNotePayload(body: unknown, userId: string): ParseResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "リクエストの形式が不正です" }
  }
  const { plantId, plantName, noteText, visitDate, photoPath } = body as Record<
    string,
    unknown
  >

  if (typeof noteText !== "string" || !noteText.trim()) {
    return { ok: false, error: "メモを入力してください" }
  }
  if (typeof visitDate !== "string" || !DATE_PATTERN.test(visitDate)) {
    return { ok: false, error: "訪問日が不正です" }
  }
  if (photoPath != null) {
    if (typeof photoPath !== "string" || !photoPath.startsWith(`${userId}/`)) {
      return { ok: false, error: "写真の指定が不正です" }
    }
  }

  return {
    ok: true,
    value: {
      plant_id: typeof plantId === "string" && plantId ? plantId : null,
      plant_name: typeof plantName === "string" && plantName ? plantName : null,
      note_text: noteText.trim(),
      photo_path: typeof photoPath === "string" ? photoPath : null,
      visit_date: visitDate,
    },
  }
}
