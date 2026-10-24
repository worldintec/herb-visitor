// 写真アップロードの共通処理。
//
// もう一方のリポジトリ（herb-garden）にも同じ名前のファイルがあるが、2026-10-13 以降は
// 同じ内容ではない。マイノートの写真を非公開にしたため、こちらは送信だけを
// 署名付きURL経由（サーバーがパスを決める）に差し替えてある。向こうは変更していない。
//
// この関数は例外を投げない。どんな場合も { uploaded, failures } を返すので、
// 呼び出し側は try/catch ではなく failures.length を見る。
//
// 失敗の原因を本番から集めるのが目的なので、Console には [photo-upload] の
// プレフィックスで生のメッセージを 1 行にまとめて出す。短くまとめないこと。

import imageCompression from "browser-image-compression"
import { supabase } from "./supabase"
import { COMPRESSION_OPTIONS } from "./image-compression"

export type PhotoUploadFailure = {
  fileName: string
  reason: string // 画面に出す短い説明
  raw?: string // Supabase などが返した元のメッセージ
}

export type UploadedPhoto = {
  index: number // 引数 files の添字。キャプションとの対応付けに使う
  fileName: string // 元のファイル名
  path: string // Storage のオブジェクトパス。DB の photo_path に入れる
}

export type PhotoUploadResult = {
  uploaded: UploadedPhoto[]
  failures: PhotoUploadFailure[]
}

export type PhotoMessageTone = "success" | "warning" | "error"

// Supabase プロジェクト既定の 50MB。バケット側の File size limit は Unset。
export const MAX_FILE_BYTES = 50 * 1024 * 1024

// 送信先はマイノートのバケットだけ。発行APIがこのバケットに固定なので引数では受けない。
const BUCKET = "visitor-notes"
const UPLOAD_URL_ENDPOINT = "/api/visitor-notes/upload-url"

// 圧縮の設定（COMPRESSION_OPTIONS）は、お知らせの画像と共用するため image-compression.ts に置いている。

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
 * 1ファイルずつ 圧縮 → サイズ確認 → アップロード先の発行 → 送信 の順に処理する。
 * 1枚失敗しても残りは続ける。例外は投げない。
 *
 * 公開URLは返さない。写真は /api/visitor-notes/[id]/photo 経由で読むので、
 * 画面が必要とするのは DB に入れる path だけ。
 */
export async function uploadPhotos(files: File[]): Promise<PhotoUploadResult> {
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
            `[photo-upload] compress skipped bucket=${BUCKET} file=${file.name}` +
              ` type=${file.type || "(empty)"} size=${file.size} message=${messageOf(err)}`
          )
        }

        if (body.size > MAX_FILE_BYTES) {
          logFailure(
            "too large",
            BUCKET,
            file,
            body.size,
            `compressed size ${body.size} exceeds MAX_FILE_BYTES ${MAX_FILE_BYTES}`
          )
          failures.push({ fileName: file.name, reason: "ファイルが大きすぎます（50MBまで）" })
          continue
        }

        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg"
        const contentType = file.type || EXT_CONTENT_TYPE[ext] || "image/jpeg"

        // パスはサーバーが決める。クライアントが渡すのは拡張子だけ。
        const target = await requestUploadTarget(ext, file, body.size, failures)
        if (!target) continue

        // バケットが非公開でも、token で認証されるので anon クライアントで送れる
        const { error } = await supabase.storage
          .from(BUCKET)
          .uploadToSignedUrl(target.path, target.token, body, { contentType })

        if (error) {
          const { reason, raw } = classify(error)
          logFailure("upload failed", BUCKET, file, body.size, raw)
          failures.push({ fileName: file.name, reason, raw })
          continue
        }

        uploaded.push({ index, fileName: file.name, path: target.path })
      } catch (err) {
        const { reason, raw } = classify(err)
        logFailure("unexpected error", BUCKET, file, file.size, raw)
        failures.push({ fileName: file.name, reason, raw })
      }
    }
  } catch (err) {
    // ここに来る経路は想定していないが、例外を投げないという約束を守るために受ける
    console.error(`[photo-upload] aborted bucket=${BUCKET} message=${messageOf(err)}`)
    failures.push({ fileName: "(不明)", reason: `保存できませんでした（${messageOf(err)}）` })
  }

  return { uploaded, failures }
}

/**
 * アップロード先（パスと1回限りの token）をサーバーに発行させる。
 * 失敗したときは failures に積んで null を返す（通信そのものの失敗は呼び出し側が受ける）。
 */
async function requestUploadTarget(
  ext: string,
  file: File,
  compressedSize: number,
  failures: PhotoUploadFailure[]
): Promise<{ path: string; token: string } | null> {
  const res = await fetch(UPLOAD_URL_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ext }),
  })
  const json = (await res.json().catch(() => null)) as
    | { path?: string; token?: string; error?: string }
    | null

  const fail = (message: string) => {
    logFailure("upload url failed", BUCKET, file, compressedSize, message)
    failures.push({
      fileName: file.name,
      reason: `保存できませんでした（${message}）`,
      raw: message,
    })
    return null
  }

  if (!res.ok) return fail(json?.error ?? `status=${res.status}`)
  if (!json?.path || !json?.token) return fail("response has no path or token")

  return { path: json.path, token: json.token }
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
