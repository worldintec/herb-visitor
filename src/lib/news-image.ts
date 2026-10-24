// お知らせ（news）の画像の置き場所と、image_path の検証。
//
// 画像は植物の写真と同じ plant-photos バケットに、news/ で始まるパスで同居させている。
// 同じバケットに植物の写真（<エリア>/...、output/...）があるので、
// お知らせの処理が触ってよいのは isNewsImagePath() を通ったパスだけ。
// 保存のときの検証と、ファイルの実体を消すときの判定の両方にこれを使うこと。
// ここが緩むと、お知らせの削除で植物の写真を消す事故になる。

export const NEWS_IMAGE_BUCKET = "plant-photos"
export const NEWS_IMAGE_PREFIX = "news/"

// 受け付ける拡張子。HEIC などは来園者のブラウザで表示できないため弾く。
export const NEWS_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"]

/**
 * news/○○.jpg の形かどうか。
 * news/ で始まり、".." を含まず、"/" が1つだけ（news/ の直下）であること。
 */
export function isNewsImagePath(path: unknown): path is string {
  if (typeof path !== "string") return false
  if (!path.startsWith(NEWS_IMAGE_PREFIX)) return false
  if (path.includes("..")) return false
  const parts = path.split("/")
  return parts.length === 2 && parts[1] !== ""
}

/** 公開URL。plant-photos は公開バケットなので、そのまま <img> や next/image に渡せる。 */
export function newsImageUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${NEWS_IMAGE_BUCKET}/${path}`
}
