// ホームの「{月}月のおすすめハーブ」と、ハーブ一覧の「おすすめ」の絞り込みが使う判定（C #73）。
// 「花の特徴」（plants.feature_flower）の文字から開花月を読み取り、その月に当たる植物をおすすめにする。
// ホームと一覧で同じ植物が出るように、判定はここ1か所だけに置く。
//
// bloomMonthsFromText の中身は、src/app/page.tsx にあったものを1文字も変えずに移した。
// 職員アプリ（herb-garden）の src/lib/bloom-months.ts に同じ関数の写しがある。
// ここを直したら、向こうも同じに直すこと（ずれると、職員アプリの「何月のおすすめに出るか」の
// 予告と、来園者アプリの表示が食い違う）。

// feature_flowerテキストから開花月を推定（1-12）
export function bloomMonthsFromText(text: string | null | undefined): Set<number> {
  const months = new Set<number>()
  if (!text) return months
  // 「花は目立たない」「穂は目立たず」のように花が目立たないものは、見頃として出さない
  if (/目立た(ない|ず)/.test(text)) return months
  // 「X月」の直接指定
  const monthMatches = text.matchAll(/(\d{1,2})月/g)
  for (const m of monthMatches) {
    const n = parseInt(m[1], 10)
    if (n >= 1 && n <= 12) months.add(n)
  }
  // 「X〜Y月」「X～Y月」「X-Y月」の範囲指定
  const rangeMatches = text.matchAll(/(\d{1,2})\s*[～〜\-~]\s*(\d{1,2})月/g)
  for (const m of rangeMatches) {
    const a = parseInt(m[1], 10), b = parseInt(m[2], 10)
    if (a >= 1 && a <= 12 && b >= 1 && b <= 12) {
      if (a <= b) { for (let i = a; i <= b; i++) months.add(i) }
      else { for (let i = a; i <= 12; i++) months.add(i); for (let i = 1; i <= b; i++) months.add(i) }
    }
  }
  // 季節キーワード
  const seasonMap: Record<string, number[]> = {
    "早春": [2, 3], "春": [3, 4, 5], "晩春": [5],
    "初夏": [5, 6], "夏": [6, 7, 8], "真夏": [7, 8], "晩夏": [8, 9],
    "初秋": [9], "秋": [9, 10, 11], "晩秋": [11],
    "冬": [12, 1, 2], "初冬": [12], "真冬": [1, 2],
    "通年": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  }
  // 長い言葉から先に照合し、当たった部分は消してから次を見る。
  // そのまま includes で見ると「初夏」が「夏」にも、「早春」が「春」にも当たってしまう
  let rest = text
  const keys = Object.keys(seasonMap).sort((a, b) => b.length - a.length)
  for (const key of keys) {
    if (!rest.includes(key)) continue
    for (const m of seasonMap[key]) months.add(m)
    rest = rest.split(key).join("　")
  }
  return months
}

/** その植物が、その月（1〜12）のおすすめか */
export function isRecommendedInMonth(
  plant: { feature_flower: string | null | undefined },
  month: number
): boolean {
  return bloomMonthsFromText(plant.feature_flower).has(month)
}
