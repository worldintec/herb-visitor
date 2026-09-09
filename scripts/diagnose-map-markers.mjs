/**
 * 診断スクリプト（読み取り専用）: 園内マップに残るオレンジ色マーカーの照合
 *
 * herb-garden-floor-map.tsx:159-175 の照合ロジックをそのまま再現し、
 * map_plots と突合できずオレンジ（#F59E0B）で残留表示されている
 * EXCEL_PLANTS を洗い出して、不一致の理由を分類する。
 *
 * このスクリプトは SELECT（GET）しか行わない。DBへの書き込みは一切しない。
 *
 * 使い方:
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_KEY=eyJ... \
 *     node scripts/diagnose-map-markers.mjs
 *
 *   SupabaseのURLとANON KEYはVercelの環境変数から確認してください。
 *   （NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY でも可）
 *
 * DBに接続できない場合は、map_plots を JSON 配列で書き出したファイルを渡せる:
 *   node scripts/diagnose-map-markers.mjs --plots ./map_plots.json
 *   （[{ "zone": "A", "name": "ユキノシタ", "type": "herb" }, ...] の形式）
 */

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── EXCEL_PLANTS の読み込み ──────────────────────────────────────────────────
// src/data/excel-plants.ts をパースする。データを二重に持つと必ずズレるため、
// アプリが実際に描画しているファイルを唯一の情報源にする。

function loadExcelPlants() {
  const src = readFileSync(resolve(__dirname, "../src/data/excel-plants.ts"), "utf8")
  const entryPattern =
    /\{\s*id:\s*"([^"]+)"\s*,\s*name:\s*"([^"]+)"\s*,\s*area:\s*"([^"]+)"/g
  const plants = []
  let m
  while ((m = entryPattern.exec(src)) !== null) {
    plants.push({ id: m[1], name: m[2], area: m[3] })
  }
  if (plants.length === 0) {
    throw new Error("excel-plants.ts から植物データを読み取れませんでした")
  }
  return plants
}

// ─── map_plots の取得 ─────────────────────────────────────────────────────────

async function loadMapPlotsFromSupabase(url, key) {
  const endpoint = `${url.replace(/\/$/, "")}/rest/v1/map_plots?select=id,zone,name,type&order=created_at`
  const res = await fetch(endpoint, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  if (!res.ok) {
    throw new Error(`map_plots の取得に失敗しました: ${res.status} ${await res.text()}`)
  }
  return res.json()
}

function loadMapPlotsFromFile(path) {
  const parsed = JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8"))
  return Array.isArray(parsed) ? parsed : parsed.map_plots ?? []
}

// ─── 名前の正規化 ─────────────────────────────────────────────────────────────

// herb-garden-floor-map.tsx:157 と完全に同一。ここを変えると照合結果がズレる。
const stripSuffix = (name) => name.replace(/\s*\([^)]*\)\s*$/, "").trim()

// 表記ゆれ検出用のゆるい正規化（アプリ側の照合には使われていない）
function normalizeLoose(name) {
  return stripSuffix(name)
    .normalize("NFKC")
    .replace(/[\s　]/g, "")
    .replace(/[‐‑‒–—―ｰ\-]/g, "ー")
    .replace(/[・･]/g, "")
    .toLowerCase()
}

// ─── 照合 ─────────────────────────────────────────────────────────────────────

function collate(excelPlants, mapPlots) {
  // --- アプリと同一の判定（herb-garden-floor-map.tsx:159-175） ---
  const remaining = new Map()
  for (const plot of mapPlots) {
    const key = `${plot.zone}::${stripSuffix(plot.name)}`
    remaining.set(key, (remaining.get(key) ?? 0) + 1)
  }

  const hidden = new Set()
  for (const plant of excelPlants) {
    const key = `${plant.area}::${stripSuffix(plant.name)}`
    const left = remaining.get(key) ?? 0
    if (left > 0) {
      hidden.add(plant.id)
      remaining.set(key, left - 1)
    }
  }

  const leftovers = excelPlants.filter((p) => !hidden.has(p.id))

  // --- 不一致の理由を分類するための索引 ---
  const plotsByZoneBase = new Map() // "zone::base" -> 件数
  const plotsByZoneLoose = new Map() // "zone::loose" -> plot[]
  const plotsByBase = new Map() // base -> plot[]（ゾーン横断）
  const plotsByLoose = new Map() // loose -> plot[]（ゾーン横断）

  for (const plot of mapPlots) {
    const base = stripSuffix(plot.name)
    const loose = normalizeLoose(plot.name)
    const zb = `${plot.zone}::${base}`
    plotsByZoneBase.set(zb, (plotsByZoneBase.get(zb) ?? 0) + 1)
    const zl = `${plot.zone}::${loose}`
    if (!plotsByZoneLoose.has(zl)) plotsByZoneLoose.set(zl, [])
    plotsByZoneLoose.get(zl).push(plot)
    if (!plotsByBase.has(base)) plotsByBase.set(base, [])
    plotsByBase.get(base).push(plot)
    if (!plotsByLoose.has(loose)) plotsByLoose.set(loose, [])
    plotsByLoose.get(loose).push(plot)
  }

  const classified = leftovers.map((plant) => {
    const base = stripSuffix(plant.name)
    const loose = normalizeLoose(plant.name)

    // 1. 同ゾーンに同名レコードはあるが、Excel側の件数のほうが多い
    if ((plotsByZoneBase.get(`${plant.area}::${base}`) ?? 0) > 0) {
      const n = plotsByZoneBase.get(`${plant.area}::${base}`)
      return {
        ...plant,
        reason: "件数不足",
        detail: `ゾーン ${plant.area} に「${base}」は ${n} 件登録済みだが、Excel側の同名の数のほうが多い`,
        fixable: true,
      }
    }

    // 2. 同ゾーンに、正規化すれば一致する名前がある = 表記ゆれ
    const looseSameZone = plotsByZoneLoose.get(`${plant.area}::${loose}`)
    if (looseSameZone && looseSameZone.length > 0) {
      return {
        ...plant,
        reason: "名前の表記ゆれ",
        detail: `ゾーン ${plant.area} の map_plots「${looseSameZone.map((p) => p.name).join(" / ")}」と表記のみ相違`,
        fixable: true,
      }
    }

    // 3. 別ゾーンに同名（または正規化一致）レコードがある = ゾーン違い
    const otherZone = (plotsByBase.get(base) ?? plotsByLoose.get(loose) ?? []).filter(
      (p) => p.zone !== plant.area
    )
    if (otherZone.length > 0) {
      const zones = [...new Set(otherZone.map((p) => p.zone))].join(", ")
      return {
        ...plant,
        reason: "ゾーン違い",
        detail: `map_plots では ゾーン ${zones} に登録されている（Excel は ${plant.area}）`,
        fixable: true,
      }
    }

    // 4. どこにも無い
    return {
      ...plant,
      reason: "map_plots に存在しない",
      detail: "map_plots に対応レコードが見つからない（未移行、または撤去済みの可能性）",
      fixable: true,
    }
  })

  // --- 逆方向: Excel と結び付かなかった map_plots レコード（参考情報） ---
  const excelCount = new Map()
  for (const plant of excelPlants) {
    const key = `${plant.area}::${stripSuffix(plant.name)}`
    excelCount.set(key, (excelCount.get(key) ?? 0) + 1)
  }
  const unmatchedPlots = []
  for (const plot of mapPlots) {
    const key = `${plot.zone}::${stripSuffix(plot.name)}`
    const left = excelCount.get(key) ?? 0
    if (left > 0) excelCount.set(key, left - 1)
    else unmatchedPlots.push(plot)
  }

  return { hidden, leftovers: classified, unmatchedPlots }
}

// ─── レポート出力 ─────────────────────────────────────────────────────────────

const REASON_ORDER = [
  "名前の表記ゆれ",
  "ゾーン違い",
  "件数不足",
  "map_plots に存在しない",
]

function report(excelPlants, mapPlots, result) {
  const { hidden, leftovers, unmatchedPlots } = result

  console.log("=".repeat(72))
  console.log(" 園内マップ オレンジマーカー照合レポート（読み取り専用）")
  console.log("=".repeat(72))
  console.log()
  console.log(`EXCEL_PLANTS（静的ファイル）  : ${excelPlants.length} 件`)
  console.log(`map_plots（Supabase）         : ${mapPlots.length} 件`)

  const byType = new Map()
  for (const p of mapPlots) byType.set(p.type, (byType.get(p.type) ?? 0) + 1)
  console.log(
    `  内訳: ${[...byType.entries()].map(([t, n]) => `${t}(${n})`).join(" / ")}`
  )
  console.log()
  console.log(`map_plots と照合できて非表示 : ${hidden.size} 件`)
  console.log(`▼ オレンジで残っている件数   : ${leftovers.length} 件`)
  console.log()

  if (leftovers.length === 0) {
    console.log("オレンジのドットは1件も残っていません。")
  } else {
    console.log("─".repeat(72))
    console.log(" 【1】不一致の理由の分類")
    console.log("─".repeat(72))
    for (const reason of REASON_ORDER) {
      const n = leftovers.filter((l) => l.reason === reason).length
      if (n > 0) console.log(`  ${reason} : ${n} 件`)
    }
    console.log()

    console.log("─".repeat(72))
    console.log(" 【2】オレンジで残っている植物名とゾーンの一覧")
    console.log("─".repeat(72))
    for (const reason of REASON_ORDER) {
      const items = leftovers.filter((l) => l.reason === reason)
      if (items.length === 0) continue
      console.log()
      console.log(`■ ${reason}（${items.length} 件）`)
      items.sort((a, b) => a.area.localeCompare(b.area) || a.name.localeCompare(b.name, "ja"))
      for (const it of items) {
        console.log(`   ゾーン ${it.area.padEnd(2)} ${it.name}`)
        console.log(`      ${it.detail}`)
      }
    }
    console.log()

    console.log("─".repeat(72))
    console.log(" 【3】map_plots へのレコード追加で解消できるか")
    console.log("─".repeat(72))
    const addable = leftovers.filter((l) => l.reason === "map_plots に存在しない").length
    const renamable = leftovers.filter((l) => l.reason === "名前の表記ゆれ").length
    const rezonable = leftovers.filter((l) => l.reason === "ゾーン違い").length
    const shortfall = leftovers.filter((l) => l.reason === "件数不足").length
    console.log(`  レコード追加で解消      : ${addable} 件`)
    console.log(`  既存レコードの名前修正   : ${renamable} 件（追加ではなく表記統一）`)
    console.log(`  既存レコードのゾーン修正 : ${rezonable} 件（Excel と map_plots のどちらが正か要確認）`)
    console.log(`  同名レコードの追加       : ${shortfall} 件`)
    console.log()
  }

  console.log("─".repeat(72))
  console.log(" 【参考】Excel と結び付かなかった map_plots レコード")
  console.log("─".repeat(72))
  console.log(`  ${unmatchedPlots.length} 件`)
  if (unmatchedPlots.length > 0) {
    for (const p of unmatchedPlots
      .slice()
      .sort((a, b) => a.zone.localeCompare(b.zone) || a.name.localeCompare(b.name, "ja"))) {
      console.log(`   ゾーン ${String(p.zone).padEnd(2)} ${p.name}（${p.type}）`)
    }
    console.log()
    console.log("  ※ これらは Excel 側に対応が無いレコード。map_plots 側のみで")
    console.log("     追加された植物か、名前・ゾーンの相違の裏返しのどちらか。")
  }
  console.log()

  // 機械可読な出力（貼り付け用）
  if (process.argv.includes("--json")) {
    console.log("─".repeat(72))
    console.log(JSON.stringify({ leftovers, unmatchedPlots }, null, 2))
  }
}

// ─── エントリポイント ─────────────────────────────────────────────────────────

async function main() {
  const excelPlants = loadExcelPlants()

  const fileArgIndex = process.argv.indexOf("--plots")
  let mapPlots

  if (fileArgIndex !== -1) {
    mapPlots = loadMapPlotsFromFile(process.argv[fileArgIndex + 1])
  } else {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) {
      console.error("環境変数を設定してください:")
      console.error(
        "  SUPABASE_URL=https://xxx.supabase.co SUPABASE_KEY=eyJ... node scripts/diagnose-map-markers.mjs"
      )
      console.error("")
      console.error("または map_plots の JSON エクスポートを渡してください:")
      console.error("  node scripts/diagnose-map-markers.mjs --plots ./map_plots.json")
      process.exit(1)
    }
    mapPlots = await loadMapPlotsFromSupabase(url, key)
  }

  report(excelPlants, mapPlots, collate(excelPlants, mapPlots))
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
