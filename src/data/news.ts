export type NewsCategory = "イベント" | "お知らせ" | "更新情報"

export interface NewsItem {
  id: string
  title: string
  category: NewsCategory
  publishedAt: string   // YYYY-MM-DD
  summary: string
  content: NewsContent
  imagePath?: string    // Storage（plant-photos）の news/ 以下のパス（オプション）
}

export interface NewsContent {
  catchCopy?: string
  eventDate?: string
  eventDateRain?: string
  venue?: string
  organizer?: string[]
  workshops?: WorkshopItem[]
  extras?: string[]
  kitchenCars?: boolean
  access?: AccessItem[]
  body?: string
}

export interface WorkshopItem {
  name: string
  price?: number
}

export interface AccessItem {
  from: string
  route: string
  stop: string
  walk: string
}

// ===== Supabase `news` テーブル由来のデータ =====
export interface NewsRow {
  id: string
  category: NewsCategory
  title: string
  summary: string
  body: string
  image_path: string | null
  published_at: string // YYYY-MM-DD
  is_published: boolean
}

// DB行を画面用の NewsItem 形状へ変換する
// （リッチな content フィールドは持たず、本文のみのシンプルな表示になる）
export function mapNewsRowToItem(row: NewsRow): NewsItem {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    publishedAt: row.published_at,
    summary: row.summary,
    imagePath: row.image_path ?? undefined,
    content: {
      body: row.body,
    },
  }
}
