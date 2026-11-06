// マイノートの写真（visitor_note_photos）をサーバーで扱う処理。Route Handler からだけ使う。
//
// ・写真の行は、ノートの持ち主を確かめたあとでしか読み書きしない（呼び出し側の責任）
// ・Storage の実体を消すパスは、必ずデータベースの行から読む（画面から受け取ったパスでは消さない）
// ・移行前のノート（新しい表に行が無く、photo_path だけがある）は、photo_path の1枚を写真として扱う

import type { getSupabaseAdmin } from "./supabase-admin"
import { NOTES_BUCKET, NOTES_TABLE, NOTE_PHOTOS_TABLE } from "./visitor-notes"

type Admin = ReturnType<typeof getSupabaseAdmin>

export interface NotePhotoRow {
  id: string
  note_id: string
  storage_path: string
  sort_order: number
}

/** 画面に返す写真。path は保存のときにそのまま送り返してもらう（自分のフォルダのパスだけ） */
export interface NotePhoto {
  /** visitor_note_photos の id。移行前の1枚（表に行が無い）は null */
  id: string | null
  path: string
}

/** 複数のノートの写真の行を、ノートごと・並び順どおりにまとめて読む */
export async function fetchPhotoRows(
  supabase: Admin,
  noteIds: string[]
): Promise<{ rows: Map<string, NotePhotoRow[]>; error: unknown }> {
  const rows = new Map<string, NotePhotoRow[]>()
  if (noteIds.length === 0) return { rows, error: null }
  const { data, error } = await supabase
    .from(NOTE_PHOTOS_TABLE)
    .select("id, note_id, storage_path, sort_order")
    .in("note_id", noteIds)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
  if (error) return { rows, error }
  for (const row of (data ?? []) as NotePhotoRow[]) {
    const list = rows.get(row.note_id) ?? []
    list.push(row)
    rows.set(row.note_id, list)
  }
  return { rows, error: null }
}

/** ノートの写真（並び順どおり。先頭が代表）。表に行が無ければ photo_path の1枚 */
export function photosOf(rows: NotePhotoRow[] | undefined, photoPath: string | null): NotePhoto[] {
  if (rows && rows.length > 0) return rows.map((r) => ({ id: r.id, path: r.storage_path }))
  return photoPath ? [{ id: null, path: photoPath }] : []
}

/**
 * 新しく付ける写真のパスが、ほかのノートで使われていないかを確かめる。
 * ノートを書き換える前に呼ぶこと（先に書き換えてから断ると、本文だけ変わってしまう）。
 *
 * 写真の行に加えて、ほかのノートの photo_path も見る。移行前のノートは行が無く、
 * photo_path にしかパスが入っていないことがあるため。同じ実体を2件のノートで共有すると、
 * 片方を消したときにもう片方の写真まで消えてしまう。
 *
 * @param noteId 編集中のノート（新規なら null）
 */
export async function checkNewPhotoPaths(
  supabase: Admin,
  userId: string,
  noteId: string | null,
  current: NotePhoto[],
  paths: string[]
): Promise<{ ok: true } | { ok: false; status: number; error: string; detail?: unknown }> {
  const currentPaths = new Set(current.map((p) => p.path))
  const added = paths.filter((p) => !currentPaths.has(p))
  if (added.length === 0) return { ok: true }

  const [byRow, byNote] = await Promise.all([
    supabase.from(NOTE_PHOTOS_TABLE).select("note_id").in("storage_path", added),
    supabase.from(NOTES_TABLE).select("id").eq("user_id", userId).in("photo_path", added),
  ])
  if (byRow.error || byNote.error) {
    return { ok: false, status: 500, error: "写真の保存に失敗しました", detail: byRow.error ?? byNote.error }
  }
  const usedElsewhere =
    (byRow.data ?? []).some((r) => r.note_id !== noteId) ||
    (byNote.data ?? []).some((n) => n.id !== noteId)
  if (usedElsewhere) return { ok: false, status: 400, error: "写真の指定が不正です" }
  return { ok: true }
}

/**
 * 写真の行を、画面から届いた並び（paths）にそろえる。足す・消す・並べ直す。
 * 外した写真の Storage のパスを返す（実体を消すのは、呼び出し側がノートの保存に成功したあと）。
 *
 * current は保存前のこのノートの写真（photosOf の結果）。paths に入っている既存の写真は残し、
 * 新しいパスは行を作る。ほかのノートが使っているパスは指定できない（storage_path は unique）。
 */
export async function syncNotePhotos(
  supabase: Admin,
  noteId: string,
  current: NotePhoto[],
  paths: string[]
): Promise<{ ok: true; removedPaths: string[] } | { ok: false; status: number; error: string; detail?: unknown }> {
  const currentPaths = new Set(current.map((p) => p.path))
  const added = paths.filter((p) => !currentPaths.has(p))

  // 新しいパスが、ほかのノートの写真として使われていないか
  if (added.length > 0) {
    const { data: used, error } = await supabase
      .from(NOTE_PHOTOS_TABLE)
      .select("note_id")
      .in("storage_path", added)
    if (error) return { ok: false, status: 500, error: "写真の保存に失敗しました", detail: error }
    if ((used ?? []).some((u) => u.note_id !== noteId)) {
      return { ok: false, status: 400, error: "写真の指定が不正です" }
    }
  }

  const removed = current.filter((p) => !paths.includes(p.path))

  // 外した写真の行を消す
  const removedIds = removed.map((p) => p.id).filter((id): id is string => id !== null)
  if (removedIds.length > 0) {
    const { error } = await supabase.from(NOTE_PHOTOS_TABLE).delete().in("id", removedIds).eq("note_id", noteId)
    if (error) return { ok: false, status: 500, error: "写真の保存に失敗しました", detail: error }
  }

  // 残す写真の並び順を直し、新しい写真と移行前の1枚（表に行が無い）は行を作る
  const byPath = new Map(current.map((p) => [p.path, p]))
  const inserts: { note_id: string; storage_path: string; sort_order: number }[] = []
  for (let i = 0; i < paths.length; i++) {
    const existing = byPath.get(paths[i])
    if (existing?.id) {
      const { error } = await supabase
        .from(NOTE_PHOTOS_TABLE)
        .update({ sort_order: i })
        .eq("id", existing.id)
        .eq("note_id", noteId)
      if (error) return { ok: false, status: 500, error: "写真の保存に失敗しました", detail: error }
    } else {
      inserts.push({ note_id: noteId, storage_path: paths[i], sort_order: i })
    }
  }
  if (inserts.length > 0) {
    const { error } = await supabase.from(NOTE_PHOTOS_TABLE).insert(inserts)
    if (error) return { ok: false, status: 500, error: "写真の保存に失敗しました", detail: error }
  }

  return { ok: true, removedPaths: removed.map((p) => p.path) }
}

/** Storage の実体を消す。同じパスは1回だけ。失敗しても例外は投げない（記録だけ残す） */
export async function removeNotePhotoFiles(supabase: Admin, paths: (string | null | undefined)[]): Promise<void> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))]
  if (unique.length === 0) return
  const { error } = await supabase.storage.from(NOTES_BUCKET).remove(unique)
  if (error) console.error("visitor-notes storage remove error:", error, unique)
}

// download() の Blob から Content-Type が取れなかったときだけ使う。jpg / jpeg は末尾のフォールバックに任せる。
const EXT_CONTENT_TYPE: Record<string, string> = {
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
}

/**
 * 写真の中身を流す。path は必ずデータベースの行から読んだもの（持ち主は呼び出し側で確かめ済み）。
 * 非公開の写真を端末や途中のキャッシュに残さないよう no-store にする。
 */
export async function streamNotePhoto(supabase: Admin, path: string): Promise<Response> {
  const { data: blob, error } = await supabase.storage.from(NOTES_BUCKET).download(path)
  if (error || !blob) {
    console.error("visitor-notes storage download error:", error)
    return Response.json({ error: "写真の取得に失敗しました" }, { status: 500 })
  }
  const ext = path.split(".").pop()?.toLowerCase() ?? ""
  const contentType = blob.type || EXT_CONTENT_TYPE[ext] || "image/jpeg"
  return new Response(blob, {
    headers: { "Content-Type": contentType, "Cache-Control": "private, no-store" },
  })
}
