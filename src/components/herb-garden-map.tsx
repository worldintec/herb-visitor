"use client"

import { useRouter } from "next/navigation"

/**
 * 見沼氷川公園ハーブ園 エリアマップ（カード型）
 * A〜W 全23区画を色付き角丸カードとして表示
 *
 * Props:
 *   areaCounts - 各エリアの植物種数 { A: 5, B: 8, ... }
 */
type Props = {
  areaCounts?: Record<string, number>
}

// エリアごとの色（herb-garden-two に準拠）
const AREA_COLORS: Record<string, { bg: string; border: string; text: string; count: string }> = {
  A: { bg: "#dcfce7", border: "#16a34a", text: "#14532d", count: "#166534" },
  B: { bg: "#dbeafe", border: "#2563eb", text: "#1e3a5f", count: "#1e40af" },
  C: { bg: "#fef9c3", border: "#ca8a04", text: "#713f12", count: "#854d0e" },
  D: { bg: "#fce7f3", border: "#db2777", text: "#831843", count: "#9d174d" },
  E: { bg: "#f3e8ff", border: "#9333ea", text: "#581c87", count: "#6b21a8" },
  F: { bg: "#ffedd5", border: "#ea580c", text: "#7c2d12", count: "#9a3412" },
  G: { bg: "#ccfbf1", border: "#0d9488", text: "#134e4a", count: "#0f766e" },
  H: { bg: "#e0e7ff", border: "#4f46e5", text: "#312e81", count: "#3730a3" },
  I: { bg: "#fce4ec", border: "#e91e63", text: "#880e4f", count: "#a21caf" },
  J: { bg: "#e8f5e9", border: "#43a047", text: "#1b5e20", count: "#15803d" },
  K: { bg: "#fff3e0", border: "#ef6c00", text: "#bf360c", count: "#c2410c" },
  L: { bg: "#e3f2fd", border: "#1e88e5", text: "#0d47a1", count: "#1565c0" },
  M: { bg: "#f3e5f5", border: "#8e24aa", text: "#4a148c", count: "#7e22ce" },
  N: { bg: "#e0f2f1", border: "#00897b", text: "#004d40", count: "#0f766e" },
  O: { bg: "#fff8e1", border: "#f9a825", text: "#e65100", count: "#b45309" },
  P: { bg: "#fbe9e7", border: "#d84315", text: "#6d1f00", count: "#9a3412" },
  Q: { bg: "#ede7f6", border: "#5e35b1", text: "#311b92", count: "#4c1d95" },
  R: { bg: "#e8eaf6", border: "#3949ab", text: "#1a237e", count: "#1e3a8a" },
  S: { bg: "#f1f8e9", border: "#7cb342", text: "#33691e", count: "#3f6212" },
  T: { bg: "#e0f7fa", border: "#00acc1", text: "#006064", count: "#0e7490" },
  U: { bg: "#fce4ec", border: "#ec407a", text: "#880e4f", count: "#9d174d" },
  V: { bg: "#f9fbe7", border: "#9e9d24", text: "#524c00", count: "#713f12" },
  W: { bg: "#efebe9", border: "#795548", text: "#3e2723", count: "#44403c" },
}

function getColor(area: string) {
  return AREA_COLORS[area] || { bg: "#f3f4f6", border: "#6b7280", text: "#1f2937", count: "#374151" }
}

// カードの幅・高さ（SVG 座標系）
const CW = 72  // card width
const CH = 54  // card height
const RX = 9   // corner radius

// 各エリアカードの中心座標（物理的配置を反映）
// viewBox: 0 0 1220 390
type CardPos = { cx: number; cy: number }
const CARD_POSITIONS: Record<string, CardPos> = {
  // 西ブロック
  A: { cx: 95,  cy: 220 },
  B: { cx: 172, cy: 220 },
  E: { cx: 238, cy: 168 },
  F: { cx: 310, cy: 168 },
  G: { cx: 378, cy: 188 },
  H: { cx: 270, cy: 278 },
  I: { cx: 382, cy: 278 },
  // 中央ブロック
  M: { cx: 544, cy: 220 },
  J: { cx: 618, cy: 148 },
  K: { cx: 692, cy: 220 },
  L: { cx: 618, cy: 292 },
  // 東ブロック（外周）
  N: { cx: 798, cy: 220 },
  O: { cx: 840, cy: 158 },
  P: { cx: 908, cy: 130 },
  Q: { cx: 972, cy: 118 },
  R: { cx: 1036, cy: 130 },
  S: { cx: 1104, cy: 158 },
  T: { cx: 1148, cy: 220 },
  U: { cx: 1104, cy: 282 },
  V: { cx: 1036, cy: 310 },
  W: { cx: 908, cy: 310 },
  // 東ブロック（内側）
  C: { cx: 940, cy: 220 },
  D: { cx: 1006, cy: 220 },
}

// T-U コネクタ: Tの左辺中央 → Uの右辺中央
const T_LEFT_CENTER  = { x: CARD_POSITIONS.T.cx - CW / 2, y: CARD_POSITIONS.T.cy }
const U_RIGHT_CENTER = { x: CARD_POSITIONS.U.cx + CW / 2, y: CARD_POSITIONS.U.cy }

export default function HerbGardenMap({ areaCounts = {} }: Props) {
  const router = useRouter()

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1220 390"
      className="w-full h-auto"
      style={{ fontFamily: "'Noto Sans CJK JP', 'Yu Gothic', sans-serif" }}
      aria-label="ハーブ園エリアマップ"
    >
      {/* 背景 */}
      <rect width="1220" height="390" fill="#F7F8F3" rx="12" />

      {/* ブロック見出し */}
      <text x="258" y="42" textAnchor="middle" fontSize="12" fill="#5C8052" fontWeight="bold" letterSpacing="1">西エリア</text>
      <text x="618" y="42" textAnchor="middle" fontSize="12" fill="#9A7F5A" fontWeight="bold" letterSpacing="1">中央エリア</text>
      <text x="972" y="42" textAnchor="middle" fontSize="12" fill="#A56544" fontWeight="bold" letterSpacing="1">東エリア</text>

      {/* ブロック区切り線 */}
      <line x1="490" y1="58" x2="490" y2="350" stroke="#d1d5db" strokeWidth="1" strokeDasharray="4,4" />
      <line x1="740" y1="58" x2="740" y2="350" stroke="#d1d5db" strokeWidth="1" strokeDasharray="4,4" />

      {/* T-U コネクタ */}
      <line
        x1={T_LEFT_CENTER.x}
        y1={T_LEFT_CENTER.y}
        x2={U_RIGHT_CENTER.x}
        y2={U_RIGHT_CENTER.y}
        stroke="#999"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* エリアカード */}
      {Object.entries(CARD_POSITIONS).map(([area, { cx, cy }]) => {
        const color = getColor(area)
        const count = areaCounts[area] ?? 0
        const x = cx - CW / 2
        const y = cy - CH / 2

        return (
          <g
            key={area}
            onClick={() => router.push(`/areas/${area}`)}
            style={{ cursor: "pointer" }}
            className="group"
          >
            {/* カード本体 */}
            <rect
              x={x}
              y={y}
              width={CW}
              height={CH}
              rx={RX}
              fill={color.bg}
              stroke={color.border}
              strokeWidth={2}
              className="transition-opacity group-hover:opacity-80 group-active:opacity-70"
            />
            {/* エリア記号 */}
            <text
              x={cx}
              y={cy - 6}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="20"
              fontWeight="bold"
              fill={color.text}
              className="pointer-events-none select-none"
            >
              {area}
            </text>
            {/* 種数 */}
            <text
              x={cx}
              y={cy + 16}
              textAnchor="middle"
              fontSize="10"
              fill={color.count}
              className="pointer-events-none select-none"
            >
              {count > 0 ? `${count}種` : "－"}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
