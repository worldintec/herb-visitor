// ゾーン（エリア）の一覧。A〜W の23ゾーン。
// herb-garden の src/lib/zones.ts と同じ内容。片方だけ変更しないこと。

export const ZONES = [
  "A","B","C","D","E","F","G","H","I","J","K","L","M",
  "N","O","P","Q","R","S","T","U","V","W",
] as const

export type Zone = (typeof ZONES)[number]

/** 文字列が有効なゾーンかどうか。Route Handler の ?area= 検証に使う。 */
export function isZone(value: string): value is Zone {
  return (ZONES as readonly string[]).includes(value)
}
