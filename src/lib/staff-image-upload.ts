// お知らせの画像を送る処理（職員画面 /staff/news 用）。
//
// マイノートの photo-upload.ts とは分けてある。あちらはマイノートのバケットと発行APIに
// 固定されていて、マイノートが唯一の呼び出し元なので、触らずに済むようにしている。
// 縮めかた（COMPRESSION_OPTIONS）だけは共用する。

import imageCompression from "browser-image-compression"
import { supabase } from "./supabase"
import { COMPRESSION_OPTIONS } from "./image-compression"
import { NEWS_IMAGE_BUCKET, NEWS_IMAGE_EXTENSIONS } from "./news-image"

const UPLOAD_URL_ENDPOINT = "/api/staff/news/upload-url"

// 圧縮する前の大きさの上限
export const MAX_NEWS_IMAGE_BYTES = 10 * 1024 * 1024

const EXT_CONTENT_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
}

// 画面に出す文言。詳細は console.error にだけ出す。
const NOT_IMAGE = "画像ファイルを選んでください。"
const UNSUPPORTED_FORMAT = "jpg・png・webp のいずれかを選んでください。"
const TOO_LARGE = "画像が大きすぎます。10MB までの画像を選んでください。"
const SESSION_EXPIRED = "ログインの有効期限が切れました。もう一度ログインしてから、やり直してください。"
const UPLOAD_FAILED = "画像を送れませんでした。時間を置いて、もう一度お試しください。"

function extensionOf(file: File): string {
  const name = file.name
  const dot = name.lastIndexOf(".")
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : ""
}

/**
 * 選ばれたファイルを送ってよいか。だめなら画面に出す文言を返す。
 * ファイルを選んだときと、送る直前の両方で呼ぶ。
 */
export function checkNewsImageFile(file: File): string | null {
  const ext = extensionOf(file)
  // HEIC は file.type が空になるブラウザがあるので、拡張子を先に見て形式の案内を出す
  if (ext === "heic" || ext === "heif") return UNSUPPORTED_FORMAT
  if (file.type && !file.type.startsWith("image/")) return NOT_IMAGE
  if (!NEWS_IMAGE_EXTENSIONS.includes(ext)) {
    return file.type.startsWith("image/") ? UNSUPPORTED_FORMAT : NOT_IMAGE
  }
  if (file.size > MAX_NEWS_IMAGE_BYTES) return TOO_LARGE
  return null
}

/**
 * 縮めてから、サーバーが発行したURLへ送る。成功したらサーバーが決めたパスを返す。
 * 例外は投げない。
 */
export async function uploadNewsImage(
  file: File
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const invalid = checkNewsImageFile(file)
  if (invalid) return { ok: false, error: invalid }

  const ext = extensionOf(file)

  // 縮められなかったら元のファイルで続ける（マイノートと同じ）。元は 10MB 以下に限っている。
  let body: File | Blob = file
  try {
    body = await imageCompression(file, COMPRESSION_OPTIONS)
  } catch (err) {
    console.warn(`[staff-image-upload] compress skipped file=${file.name} size=${file.size}`, err)
  }

  try {
    const res = await fetch(UPLOAD_URL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ext }),
    })
    if (res.status === 401) return { ok: false, error: SESSION_EXPIRED }
    const json = (await res.json().catch(() => null)) as
      | { path?: string; token?: string; error?: string }
      | null
    if (!res.ok || !json?.path || !json?.token) {
      console.error(`[staff-image-upload] upload url failed status=${res.status}`, json?.error)
      return { ok: false, error: UPLOAD_FAILED }
    }

    // バケットが INSERT を許していなくても、token で認証されるので anon クライアントで送れる
    const { error } = await supabase.storage
      .from(NEWS_IMAGE_BUCKET)
      .uploadToSignedUrl(json.path, json.token, body, {
        contentType: EXT_CONTENT_TYPE[ext] ?? "image/jpeg",
      })
    if (error) {
      console.error(`[staff-image-upload] upload failed file=${file.name}`, error)
      return { ok: false, error: UPLOAD_FAILED }
    }

    return { ok: true, path: json.path }
  } catch (err) {
    console.error(`[staff-image-upload] unexpected error file=${file.name}`, err)
    return { ok: false, error: UPLOAD_FAILED }
  }
}
