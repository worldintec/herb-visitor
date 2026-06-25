"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import type { MapPlot } from "@/types/database"
import { EXCEL_PLANTS } from "@/data/excel-plants"
import { resetPinchZoom } from "@/lib/reset-pinch-zoom"

// ─── ゾーン定義 ────────────────────────────────────────────────────────────────

const ZONES = [
  "A","B","C","D","E","F","G","H","I","J","K","L","M",
  "N","O","P","Q","R","S","T","U","V","W",
] as const
type Zone = (typeof ZONES)[number]

// ─── ZONE_AREAS（herb-gardenのmap-client.tsxと同一の調整済み座標） ─────────────
const ZONE_AREAS: Record<Zone, { x: number; y: number; w: number; h: number }> = {
  A: { x: 10,  y: 311, w: 152, h: 58  },
  B: { x: 99,  y: 240, w: 246, h: 80  },
  C: { x: 197, y: 293, w: 38,  h: 32  },
  D: { x: 176, y: 265, w: 46,  h: 30  },
  E: { x: 298, y: 320, w: 26,  h: 24  },
  F: { x: 258, y: 317, w: 205, h: 52  },
  G: { x: 368, y: 302, w: 26,  h: 32  },
  H: { x: 388, y: 292, w: 26,  h: 30  },
  I: { x: 420, y: 288, w: 26,  h: 28  },
  J: { x: 444, y: 275, w: 54,  h: 98  },
  K: { x: 453, y: 155, w: 248, h: 125 },
  L: { x: 590, y: 175, w: 32,  h: 28  },
  M: { x: 574, y: 244, w: 50,  h: 55  },
  N: { x: 535, y: 270, w: 32,  h: 80  },
  O: { x: 568, y: 333, w: 70,  h: 40  },
  P: { x: 645, y: 260, w: 38,  h: 82  },
  Q: { x: 682, y: 207, w: 75,  h: 163 },
  R: { x: 656, y: 210, w: 36,  h: 44  },
  S: { x: 680, y: 258, w: 40,  h: 44  },
  T: { x: 628, y: 38,  w: 265, h: 185 },
  U: { x: 808, y: 272, w: 115, h: 32  },
  V: { x: 733, y: 298, w: 125, h: 30  },
  W: { x: 814, y: 274, w: 102, h: 80  },
}

// 面積の大きい順に描画（小ゾーンが上に来てクリックを受け取る）
const ZONES_BY_SIZE = [...ZONES].sort(
  (a, b) =>
    ZONE_AREAS[b].w * ZONE_AREAS[b].h - ZONE_AREAS[a].w * ZONE_AREAS[a].h
)

// ─── Excel座標 → SVG座標 変換 ──────────────────────────────────────────────────
function excelToSvg(ex: number, ey: number): { x: number; y: number } {
  const x = ex * (980 / 969) + 10
  const y = 0.00876 * ex + 0.599 * ey + 87.3
  return { x: Math.round(x), y: Math.round(y) }
}

// ─── 種別カラー ─────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  herb:      "#1D9E75",
  flower:    "#D4537E",
  vegetable: "#639922",
  tree:      "#185FA5",
  other:     "#888780",
}

const TYPE_LABELS: Record<string, string> = {
  herb:      "ハーブ",
  flower:    "花",
  vegetable: "野菜",
  tree:      "樹木",
  other:     "その他",
}

// ─── コンポーネント ─────────────────────────────────────────────────────────────

export default function HerbGardenFloorMap() {
  const router = useRouter()
  const [plots, setPlots] = useState<MapPlot[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredZone, setHoveredZone] = useState<Zone | null>(null)
  const [hoveredPlot, setHoveredPlot] = useState<string | null>(null)
  const [zoneOffsets, setZoneOffsets] = useState<Record<Zone, { dx: number; dy: number }>>(
    () => Object.fromEntries(ZONES.map(z => [z, { dx: 0, dy: 0 }])) as Record<Zone, { dx: number; dy: number }>
  )

  useEffect(() => {
    Promise.all([
      supabase.from("map_plots").select("*").order("created_at"),
      supabase.from("zone_offsets").select("*"),
    ]).then(([plotsRes, offsetsRes]) => {
      if (plotsRes.data) setPlots(plotsRes.data as MapPlot[])
      if (offsetsRes.data && offsetsRes.data.length > 0) {
        setZoneOffsets(prev => {
          const next = { ...prev }
          offsetsRes.data!.forEach((row: { zone: string; dx: number; dy: number }) => {
            if (ZONES.includes(row.zone as Zone)) {
              next[row.zone as Zone] = { dx: row.dx, dy: row.dy }
            }
          })
          return next
        })
      }
      setLoading(false)
    })
  }, [])

  // ── ゾーン別プロット境界ボックス（herb-gardenと同一ロジック） ───────────────
  const PLOT_RADIUS = 6
  const PLOT_PADDING = 10

  const zonePlotBounds = useMemo(() => {
    const bounds: Partial<Record<Zone, { minX: number; maxX: number; minY: number; maxY: number }>> = {}

    const expand = (zone: Zone, x: number, y: number) => {
      const b = bounds[zone]
      if (!b) {
        bounds[zone] = { minX: x, maxX: x, minY: y, maxY: y }
      } else {
        b.minX = Math.min(b.minX, x)
        b.maxX = Math.max(b.maxX, x)
        b.minY = Math.min(b.minY, y)
        b.maxY = Math.max(b.maxY, y)
      }
    }

    // Excel植物位置（参照ドット）
    EXCEL_PLANTS.forEach((plant) => {
      const zone = plant.area as Zone
      if (!ZONES.includes(zone)) return
      const off = zoneOffsets[zone]
      const { x, y } = excelToSvg(plant.x, plant.y)
      expand(zone, x + off.dx, y + off.dy)
    })

    // DBに登録されたプロット
    plots.forEach((plot) => {
      const zone = plot.zone as Zone
      if (!ZONES.includes(zone)) return
      expand(zone, plot.x, plot.y)
    })

    return bounds
  }, [plots, zoneOffsets])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-gray-400">
        読み込み中...
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* マップSVG */}
      <div className="bg-white rounded-xl overflow-hidden border border-gray-100">
        <svg
          viewBox="0 0 1000 480"
          className="w-full h-auto block"
        >
          <defs>
            <pattern
              id="floorgrid"
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 20 0 L 0 0 0 20"
                fill="none"
                stroke="rgba(0,0,0,0.05)"
                strokeWidth="0.4"
              />
            </pattern>
          </defs>

          {/* グリッド背景 */}
          <rect width="1000" height="480" fill="url(#floorgrid)" />

          {/* ミント園（別枠）枠線 */}
          <rect
            x={620} y={30} width={282} height={118}
            rx={4}
            fill="rgba(29,158,117,0.04)"
            stroke="rgba(29,158,117,0.3)"
            strokeWidth={0.8}
            strokeDasharray="4,3"
            className="pointer-events-none"
          />
          <text
            x={761} y={44}
            textAnchor="middle"
            fontSize={9}
            fill="#5f5e5a"
            fillOpacity={0.6}
            className="pointer-events-none select-none"
          >
            ミント園（別枠）
          </text>

          {/* 平面図背景画像 */}
          <image
            href="/ハーブ園図面加工後.png"
            x={10}
            y={145}
            width={980}
            height={224}
            preserveAspectRatio="none"
            opacity={0.9}
            className="pointer-events-none"
          />

          {/* ゾーン（面積降順で描画） */}
          {ZONES_BY_SIZE.map((zone) => {
            const a = ZONE_AREAS[zone]
            const off = zoneOffsets[zone]
            // プロットが存在する場合はその上下左右範囲に枠を合わせる
            const pb = zonePlotBounds[zone]
            const ax = pb ? pb.minX - PLOT_RADIUS - PLOT_PADDING : a.x + off.dx
            const aw = pb ? (pb.maxX + PLOT_RADIUS + PLOT_PADDING) - ax : a.w
            const ay = pb ? pb.minY - PLOT_RADIUS - PLOT_PADDING : a.y + off.dy
            const ah = pb ? (pb.maxY + PLOT_RADIUS + PLOT_PADDING) - ay : a.h
            const isHovered = hoveredZone === zone
            return (
              <g key={zone}>
                {/* ハイライト背景 */}
                <rect
                  x={ax} y={ay} width={aw} height={ah}
                  rx={3}
                  fill="#1D9E75"
                  fillOpacity={isHovered ? 0.18 : 0}
                  className="pointer-events-none transition-colors duration-150"
                />
                {/* ゾーン枠（クリック受付） */}
                <rect
                  x={ax} y={ay} width={aw} height={ah}
                  rx={3}
                  fill="transparent"
                  stroke="#1D9E75"
                  strokeWidth={isHovered ? 1.5 : 0.8}
                  strokeDasharray="4,3"
                  strokeOpacity={isHovered ? 1 : 0.5}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHoveredZone(zone)}
                  onMouseLeave={() => setHoveredZone(null)}
                  onClick={() => resetPinchZoom(() => router.push(`/areas/${zone}`))}
                />
                {/* ゾーンラベル（左上固定・見切れ防止） */}
                <text
                  x={ax + 4}
                  y={ay + 11}
                  textAnchor="start"
                  fontSize={11}
                  fontWeight={500}
                  fill={isHovered ? "#0F6E56" : "#5f5e5a"}
                  fillOpacity={isHovered ? 1 : 0.65}
                  className="pointer-events-none select-none"
                >
                  {zone}
                </text>
              </g>
            )
          })}

          {/* Excel植物位置ドット */}
          {EXCEL_PLANTS.map((plant) => {
            const { x: bx, y: by } = excelToSvg(plant.x, plant.y)
            const off = zoneOffsets[plant.area as Zone]
            return (
              <g key={plant.id}>
                <title>{plant.name}（エリア {plant.area}）</title>
                <circle
                  cx={bx + off.dx}
                  cy={by + off.dy}
                  r={3.5}
                  fill="#F59E0B"
                  fillOpacity={0.8}
                  stroke="white"
                  strokeWidth={1}
                  className="pointer-events-none"
                />
              </g>
            )
          })}

          {/* プロットマーカー */}
          {plots.map((plot) => {
            const color = TYPE_COLORS[plot.type] ?? "#888780"
            const isHovered = hoveredPlot === plot.id
            const label =
              plot.name.length > 6 ? plot.name.slice(0, 5) + "…" : plot.name
            return (
              <g
                key={plot.id}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoveredPlot(plot.id)}
                onMouseLeave={() => setHoveredPlot(null)}
                onClick={() => resetPinchZoom(() => router.push(`/areas/${plot.zone}`))}
              >
                <title>{plot.name}（エリア {plot.zone}）</title>
                {isHovered && (
                  <circle
                    cx={plot.x} cy={plot.y} r={14}
                    fill={color}
                    fillOpacity={0.18}
                    className="pointer-events-none"
                  />
                )}
                <circle
                  cx={plot.x} cy={plot.y}
                  r={isHovered ? 8 : 6}
                  fill={color}
                  stroke="white"
                  strokeWidth={1.5}
                  style={{ transition: "r 0.1s" }}
                />
                <text
                  x={plot.x} y={plot.y + 16}
                  textAnchor="middle"
                  fontSize={9}
                  fill={isHovered ? color : "#5f5e5a"}
                  fontWeight={isHovered ? 600 : 400}
                  className="pointer-events-none select-none"
                >
                  {label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* 凡例 */}
      {plots.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-1">
          {Object.entries(TYPE_LABELS).map(([type, label]) => {
            const count = plots.filter((p) => p.type === type).length
            if (count === 0) return null
            return (
              <div key={type} className="flex items-center gap-1.5">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: TYPE_COLORS[type] }}
                />
                <span className="text-xs text-gray-500">
                  {label} {count}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {plots.length === 0 && (
        <p className="text-xs text-center text-gray-400 py-2">
          プロットはまだ登録されていません
        </p>
      )}

    </div>
  )
}
