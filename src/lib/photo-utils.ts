// 植物写真のキャプション優先順位制御

// /api/plant-photos が返す形（types/database.ts の PlantPhoto と同じ）
export interface PlantPhoto {
  id: string
  plant_name: string
  storage_path: string
  caption: string | null
}

// キャプション優先順位（数値が小さいほど優先度高）
export const CAPTION_PRIORITY: Record<string, number> = {
  "開花": 1,
  "実": 2,
  "蕾": 3,
  "葉": 4,
  "萌芽": 5,
}

export const PRIORITY_MAX = 999

// 優先順位に基づいて写真をソート
export function sortPhotosByPriority<T extends { caption: string | null }>(photos: T[]): T[] {
  return [...photos].sort((a, b) => {
    const pa = CAPTION_PRIORITY[(a.caption ?? "").trim()] ?? PRIORITY_MAX
    const pb = CAPTION_PRIORITY[(b.caption ?? "").trim()] ?? PRIORITY_MAX
    if (pa !== pb) return pa - pb
    // 同優先度なら新しい順
    return 0
  })
}

// 代表写真（サムネイル）を選択
export function getRepresentativePhoto<T extends { caption: string | null }>(
  photos: T[] | null | undefined
): T | null {
  if (!photos || photos.length === 0) return null
  const sorted = sortPhotosByPriority(photos)
  return sorted[0]
}
