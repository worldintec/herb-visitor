export type NewsCategory = "イベント" | "お知らせ" | "更新情報"

export interface NewsItem {
  id: string
  title: string
  category: NewsCategory
  publishedAt: string   // YYYY-MM-DD
  summary: string
  content: NewsContent
  imagePath?: string    // /images/news/ 以下のパス（オプション）
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

// ===== お知らせデータ =====
export const newsList: NewsItem[] = [
  {
    id: "herb-fair-2026",
    title: "ハーブフェア 2026 開催のお知らせ",
    category: "イベント",
    publishedAt: "2026-05-30",
    summary: "2026年6月14日（日）、見沼氷川公園 ハーブ園にてハーブフェアを開催します。ワークショップやキッチンカーも出店予定です。",
    imagePath: undefined, // フライヤー画像を追加する場合: "herb-fair-2026.jpg"
    content: {
      catchCopy: "花盛りのハーブ園で香りを楽しみながら、ワークショップに参加しませんか？",
      eventDate: "2026年6月14日（日）10:00〜15:00",
      eventDateRain: "荒天の場合は6月21日（日）に延期",
      venue: "見沼氷川公園 ハーブ園",
      organizer: [
        "（株）ワールドインテック さいたま市都市公園　TEL：048-876-3656",
        "共催：浦和ハーブ友の会",
      ],
      workshops: [
        { name: "サシェ（香り袋）作り", price: 300 },
        { name: "ラベンダースティック作り", price: 300 },
        { name: "ハーブ刈り取り体験", price: 300 },
      ],
      extras: ["その他 雑貨販売もあります"],
      kitchenCars: true,
      access: [
        {
          from: "JR 浦和駅東口",
          route: "国際興業バス",
          stop: "朝日坂上",
          walk: "徒歩5分",
        },
        {
          from: "JR 東浦和駅",
          route: "国際興業バス",
          stop: "朝日坂上",
          walk: "徒歩5分",
        },
      ],
    },
  },
]
