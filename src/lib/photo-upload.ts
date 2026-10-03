// 写真アップロードの共通処理。
//
// もう一方のリポジトリ（herb-garden）にも同じファイルがある。違うのは圧縮の既定値だけ。
// 共有パッケージは作らない方針なので、片方を直したらもう片方も直すこと。
//
// この関数は例外を投げない。どんな場合も { uploaded, failures } を返すので、
// 呼び出し側は try/catch ではなく failures.length を見る。
//
// 失敗の原因を本番から集めるのが目的なので、Console には [photo-upload] の
// プレフィックスで生のメッセージを 1 行にまとめて出す。短くまとめないこと。

import imageCompression from "browser-image-compression"
import { supabase } from "./supabase"

export type PhotoUploadFailure = {
  fileName: string
  reason: string // 画面に出す短い説明
  raw?: string // Supabase などが返した元のメッセージ
}

export type UploadedPhoto = {
  index: number // 引数 files の添字。キャプションとの対応付けに使う
  fileName: string // 元のファイル名
  path: string // Storage のオブジェクトパス。DB の storage_path に入れる
  url: string // 公開URL
}

export type PhotoUploadResult = {
  uploaded: UploadedPhoto[]
  failures: PhotoUploadFailure[]
}

export type PhotoMessageTone = "success" | "warning" | "error"

// Supabase プロジェクト既定の 50MB。バケット側の File size limit は Unset。
export const MAX_FILE_BYTES = 50 * 1024 * 1024

// 圧縮の既定値。herb-garden 版はここだけ { maxSizeMB: 2, maxWidthOrHeight: 1920 } になっている。
const COMPRESSION_OPTIONS = { maxSizeMB: 1, maxWidthOrHeight: 1200, useWebWorker: true }

// 画面に並べる失敗の件数。これを超えた分は「ほか◯件」にまとめる（Console には全件出る）。
const MAX_LISTED_FAILURES = 3
const MAX_FILE_NAME_LENGTH = 24

const EXT_CONTENT_TYPE: Record<string, string> = {
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isNetworkMessage(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes("failed to fetch") ||
    m.includes("fetch failed") ||
    m.includes("networkerror") ||
    m.includes("network error") ||
    m.includes("network request failed") ||
    m.includes("load failed")
  )
}

// reason の振り分け。判定に使った生のメッセージは raw に残す。
function classify(error: unknown): { reason: string; raw: string } {
  const raw = messageOf(error)
  if (error instanceof TypeError || isNetworkMessage(raw)) {
    return { reason: "通信が切れたため保存できませんでした", raw }
  }
  const m = raw.toLowerCase()
  if (m.includes("exceeded") || m.includes("too large") || m.includes("payload")) {
    return { reason: "ファイルが大きすぎます", raw }
  }
  if (m.includes("mime") || m.includes("not supported")) {
    return { reason: "この形式の画像は保存できません", raw }
  }
  // 原因がまだ分かっていないので、生のメッセージをそのまま画面にも出す
  return { reason: `保存できませんでした（${raw}）`, raw }
}

function logFailure(
  stage: string,
  bucket: string,
  file: File,
  compressedSize: number,
  message: string
): void {
  console.error(
    `[photo-upload] ${stage} bucket=${bucket} file=${file.name}` +
      ` type=${file.type || "(empty)"} size=${file.size} compressed=${compressedSize}` +
      ` message=${message}`
  )
}

function shortenFileName(name: string): string {
  return name.length <= MAX_FILE_NAME_LENGTH ? name : `${name.slice(0, MAX_FILE_NAME_LENGTH)}…`
}

// 「ファイル名：理由」を先頭3件まで並べ、残りは件数だけ出す。理由は省略しない。
export function describeFailures(failures: PhotoUploadFailure[]): string {
  const shown = failures.slice(0, MAX_LISTED_FAILURES)
  const rest = failures.length - shown.length
  const listed = shown.map((f) => `${shortenFileName(f.fileName)}：${f.reason}`).join("、")
  return rest > 0 ? `${listed}、ほか${rest}件` : listed
}

/**
 * 記録の保存を伴う画面（巡回記録の新規登録・作業記録の新規登録）の文言。
 * 記録そのものは保存できているので、写真が全部失敗しても赤にはしない。
 */
export function buildRecordPhotoMessage(
  successText: string,
  total: number,
  failures: PhotoUploadFailure[]
): { type: PhotoMessageTone; text: string } {
  if (failures.length === 0) return { type: "success", text: successText }
  const detail = describeFailures(failures)
  if (failures.length >= total) {
    return { type: "warning", text: `記録は保存しました。写真は保存できませんでした：${detail}` }
  }
  return {
    type: "warning",
    text: `記録は保存しました。写真${total}枚のうち${failures.length}枚は保存できませんでした：${detail}`,
  }
}

/**
 * 写真を足すだけの画面（植物写真・アウトプット写真・巡回記録の写真追加・作業記録の写真追加）の文言。
 * 1枚も上がらなければ何も達成されていないので赤にする。
 */
export function buildPhotoOnlyMessage(
  successText: string,
  total: number,
  failures: PhotoUploadFailure[]
): { type: PhotoMessageTone; text: string } {
  if (failures.length === 0) return { type: "success", text: successText }
  const detail = describeFailures(failures)
  if (failures.length >= total) {
    return { type: "error", text: `写真を追加できませんでした：${detail}` }
  }
  return {
    type: "warning",
    text: `写真を追加しました。${total}枚のうち${failures.length}枚は追加できませんでした：${detail}`,
  }
}

/**
 * 1ファイルずつ 圧縮 → サイズ確認 → upload → 公開URL取得 の順に処理する。
 * 1枚失敗しても残りは続ける。例外は投げない。
 */
export async function uploadPhotos(
  files: File[],
  opts: { bucket: string; pathPrefix: string }
): Promise<PhotoUploadResult> {
  const uploaded: UploadedPhoto[] = []
  const failures: PhotoUploadFailure[] = []

  try {
    for (let index = 0; index < files.length; index++) {
      const file = files[index]
      try {
        // 圧縮に失敗したら元ファイルで続行する（今までと同じ）
        let body: File | Blob = file
        try {
          body = await imageCompression(file, COMPRESSION_OPTIONS)
        } catch (err) {
          console.warn(
            `[photo-upload] compress skipped bucket=${opts.bucket} file=${file.name}` +
              ` type=${file.type || "(empty)"} size=${file.size} message=${messageOf(err)}`
          )
        }

        if (body.size > MAX_FILE_BYTES) {
          logFailure(
            "too large",
            opts.bucket,
            file,
            body.size,
            `compressed size ${body.size} exceeds MAX_FILE_BYTES ${MAX_FILE_BYTES}`
          )
          failures.push({ fileName: file.name, reason: "ファイルが大きすぎます（50MBまで）" })
          continue
        }

        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg"
        const path = `${opts.pathPrefix}${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
        const contentType = file.type || EXT_CONTENT_TYPE[ext] || "image/jpeg"

        const { error } = await supabase.storage
          .from(opts.bucket)
          .upload(path, body, { contentType, upsert: false })

        if (error) {
          const { reason, raw } = classify(error)
          logFailure("upload failed", opts.bucket, file, body.size, raw)
          failures.push({ fileName: file.name, reason, raw })
          continue
        }

        const url = supabase.storage.from(opts.bucket).getPublicUrl(path).data.publicUrl
        if (!url) {
          logFailure("public url failed", opts.bucket, file, body.size, `path=${path}`)
          failures.push({
            fileName: file.name,
            reason: "保存できませんでした（公開URLを取得できませんでした）",
          })
          continue
        }

        uploaded.push({ index, fileName: file.name, path, url })
      } catch (err) {
        const { reason, raw } = classify(err)
        logFailure("unexpected error", opts.bucket, file, file.size, raw)
        failures.push({ fileName: file.name, reason, raw })
      }
    }
  } catch (err) {
    // ここに来る経路は想定していないが、例外を投げないという約束を守るために受ける
    console.error(`[photo-upload] aborted bucket=${opts.bucket} message=${messageOf(err)}`)
    failures.push({ fileName: "(不明)", reason: `保存できませんでした（${messageOf(err)}）` })
  }

  return { uploaded, failures }
}

/**
 * アップロード済みの写真を API に登録する（行の追加はサーバー側）。
 * 失敗しても例外は投げず、failures に積んで null を返す。
 *
 * 登録に失敗しても Storage のファイルは消さない。消す仕組みをクライアントに持たせると
 * 削除の取り違えが怖いので、孤立ファイルは Console の db insert failed の行から棚卸しする。
 */
export async function registerUploadedPhoto<T>(args: {
  endpoint: string
  body: Record<string, unknown>
  bucket: string
  photo: UploadedPhoto
  failures: PhotoUploadFailure[]
}): Promise<T | null> {
  const { endpoint, body, bucket, photo, failures } = args

  const fail = (message: string, reason: string) => {
    console.error(
      `[photo-upload] db insert failed bucket=${bucket} path=${photo.path} message=${message}`
    )
    failures.push({ fileName: photo.fileName, reason, raw: message })
    return null
  }

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const json = (await res.json().catch(() => null)) as
      | { photo?: unknown; error?: string }
      | null

    if (!res.ok) {
      const message = json?.error ?? `status=${res.status}`
      return fail(message, `保存できませんでした（${message}）`)
    }
    if (!json?.photo) {
      const message = "response has no photo"
      return fail(message, "保存できませんでした（写真情報の登録結果を取得できませんでした）")
    }
    return json.photo as T
  } catch (err) {
    const { reason, raw } = classify(err)
    return fail(raw, reason)
  }
}
