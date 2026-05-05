"use client"

import { useRouter } from "next/navigation"

/**
 * 見沼氷川公園ハーブ園 平面図モックアップ
 * 3ブロック構成（西7区画/中央4区画/東12区画 = 計23区画 A〜W）
 *
 * Props:
 *   areaCounts - 各エリアの植物種数 { A: 5, B: 8, ... }
 *   currentLocation - 現在地アイコンの座標 { x: number, y: number } | null
 */
type Props = {
  areaCounts?: Record<string, number>
  currentLocation?: { x: number; y: number } | null
}

// エリアIDごとのタップ判定用透明領域（クリック領域）
// 表示の <text> 位置に近い透明矩形を重ねて、ラベル+周辺もタップできるように
type HitArea = { id: string; x: number; y: number; w: number; h: number; labelX: number; labelY: number }

const HIT_AREAS: HitArea[] = [
  // 西エリア
  { id: "A", x: 70, y: 175, w: 60, h: 90, labelX: 95, labelY: 215 },
  { id: "B", x: 135, y: 175, w: 65, h: 90, labelX: 160, labelY: 215 },
  { id: "E", x: 205, y: 130, w: 65, h: 80, labelX: 232, labelY: 170 },
  { id: "F", x: 275, y: 130, w: 65, h: 80, labelX: 302, labelY: 170 },
  { id: "G", x: 345, y: 145, w: 65, h: 90, labelX: 370, labelY: 190 },
  { id: "H", x: 235, y: 230, w: 75, h: 90, labelX: 270, labelY: 270 },
  { id: "I", x: 345, y: 240, w: 70, h: 80, labelX: 370, labelY: 280 },
  // 中央エリア
  { id: "J", x: 580, y: 110, w: 80, h: 70, labelX: 620, labelY: 148 },
  { id: "K", x: 660, y: 180, w: 70, h: 80, labelX: 700, labelY: 225 },
  { id: "L", x: 580, y: 270, w: 80, h: 60, labelX: 620, labelY: 305 },
  { id: "M", x: 510, y: 180, w: 70, h: 80, labelX: 540, labelY: 225 },
  // 東エリア（外周10区画）
  { id: "N", x: 770, y: 195, w: 60, h: 60, labelX: 800, labelY: 225 },
  { id: "O", x: 810, y: 130, w: 65, h: 60, labelX: 838, labelY: 160 },
  { id: "P", x: 880, y: 110, w: 60, h: 50, labelX: 908, labelY: 135 },
  { id: "Q", x: 940, y: 100, w: 60, h: 50, labelX: 970, labelY: 128 },
  { id: "R", x: 1000, y: 110, w: 65, h: 50, labelX: 1032, labelY: 135 },
  { id: "S", x: 1070, y: 130, w: 65, h: 60, labelX: 1100, labelY: 160 },
  { id: "T", x: 1110, y: 195, w: 65, h: 60, labelX: 1140, labelY: 225 },
  { id: "U", x: 1070, y: 255, w: 65, h: 60, labelX: 1100, labelY: 285 },
  { id: "V", x: 1000, y: 280, w: 65, h: 50, labelX: 1032, labelY: 310 },
  { id: "W", x: 880, y: 280, w: 60, h: 50, labelX: 908, labelY: 310 },
  // 東エリア（内側2区画）
  { id: "C", x: 920, y: 195, w: 50, h: 60, labelX: 945, labelY: 225 },
  { id: "D", x: 970, y: 195, w: 60, h: 60, labelX: 1000, labelY: 225 },
]

const PLANT_LABELS: Record<string, string> = {
  A: "ドイツスズラン",
  B: "チャイブ等",
  H: "コンフリー",
  K: "チョウジソウ",
  N: "ボリジ",
  Q: "アルカネット",
  C: "ローズマリー",
  V: "アカンサス等",
}

export default function HerbGardenMap({ areaCounts = {}, currentLocation = null }: Props) {
  const router = useRouter()

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1200 420"
      className="w-full h-auto"
      style={{ fontFamily: "'Noto Sans CJK JP', 'Yu Gothic', sans-serif" }}
      aria-label="ハーブ園平面図"
    >
      {/* 背景 */}
      <rect width="1200" height="420" fill="#FAFAF5" />

      {/* コンパス */}
      <g transform="translate(60, 65)">
        <circle r="24" fill="white" stroke="#666" strokeWidth="1.5" />
        <text y="-6" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#FF3B30">N</text>
        <text y="-19" textAnchor="middle" fontSize="11" fill="#666">↑</text>
      </g>

      {/* ブロック見出し */}
      <text x="265" y="50" textAnchor="middle" fontSize="13" fill="#5C8052" fontWeight="bold">西エリア</text>
      <text x="620" y="80" textAnchor="middle" fontSize="13" fill="#9A7F5A" fontWeight="bold">中央エリア</text>
      <text x="970" y="55" textAnchor="middle" fontSize="13" fill="#A56544" fontWeight="bold">東エリア</text>

      {/* ====== 西ブロック ====== */}
      <g id="west-block">
        <path
          d="M 60 210 C 60 130, 130 95, 180 100 C 220 75, 290 80, 320 100 C 360 80, 420 100, 455 145 C 485 185, 480 235, 460 275 C 425 315, 350 330, 280 320 C 200 330, 120 320, 80 290 C 50 260, 50 230, 60 210 Z"
          fill="#E8F0DC"
          stroke="#5C8052"
          strokeWidth="2.5"
        />
        <path d="M 130 100 Q 110 210, 130 320" fill="none" stroke="#5C8052" strokeWidth="1.5" />
        <path d="M 200 95  Q 180 210, 200 325" fill="none" stroke="#5C8052" strokeWidth="1.5" />
        <path d="M 270 90  Q 260 210, 270 325" fill="none" stroke="#5C8052" strokeWidth="1.5" />
        <path d="M 340 95  Q 350 210, 340 320" fill="none" stroke="#5C8052" strokeWidth="1.5" />
        <path d="M 410 105 Q 430 210, 405 305" fill="none" stroke="#5C8052" strokeWidth="1.5" />
        <path d="M 200 215 Q 280 208, 340 215" fill="none" stroke="#5C8052" strokeWidth="1.5" />
        <path
          d="M 80 260 Q 200 240, 320 260 Q 400 280, 460 215"
          fill="none"
          stroke="#C9A87C"
          strokeWidth="3"
          strokeDasharray="6,3"
        />
      </g>

      {/* ====== 中央ブロック ====== */}
      <g id="center-block">
        <rect x="510" y="110" width="220" height="220" fill="#F5E8D0" stroke="#9A7F5A" strokeWidth="2.5" />
        <line x1="510" y1="110" x2="730" y2="330" stroke="#9A7F5A" strokeWidth="1.8" />
        <line x1="730" y1="110" x2="510" y2="330" stroke="#9A7F5A" strokeWidth="1.8" />
        <circle cx="620" cy="220" r="6" fill="#9A7F5A" />
      </g>

      {/* ====== 東ブロック ====== */}
      <g id="east-block">
        <ellipse cx="970" cy="220" rx="200" ry="115" fill="#FCE8D9" stroke="#A56544" strokeWidth="2.5" />
        <ellipse cx="970" cy="220" rx="80" ry="50" fill="#F8D5BD" stroke="#A56544" strokeWidth="2" />
        {/* ラジアル分割線 */}
        <line x1="770" y1="220" x2="890" y2="220" stroke="#A56544" strokeWidth="1.2" />
        <line x1="800" y1="156" x2="900" y2="180" stroke="#A56544" strokeWidth="1.2" />
        <line x1="870" y1="115" x2="940" y2="172" stroke="#A56544" strokeWidth="1.2" />
        <line x1="970" y1="105" x2="970" y2="170" stroke="#A56544" strokeWidth="1.2" />
        <line x1="1070" y1="115" x2="1000" y2="172" stroke="#A56544" strokeWidth="1.2" />
        <line x1="1140" y1="156" x2="1040" y2="180" stroke="#A56544" strokeWidth="1.2" />
        <line x1="1170" y1="220" x2="1050" y2="220" stroke="#A56544" strokeWidth="1.2" />
        <line x1="1140" y1="284" x2="1040" y2="260" stroke="#A56544" strokeWidth="1.2" />
        <line x1="1070" y1="325" x2="1000" y2="270" stroke="#A56544" strokeWidth="1.2" />
        <line x1="970" y1="335" x2="970" y2="270" stroke="#A56544" strokeWidth="1.2" />
        <line x1="870" y1="325" x2="940" y2="270" stroke="#A56544" strokeWidth="1.2" />
        <line x1="800" y1="284" x2="900" y2="260" stroke="#A56544" strokeWidth="1.2" />
        {/* 内側C/Dの分割 */}
        <line x1="970" y1="170" x2="970" y2="270" stroke="#A56544" strokeWidth="1.5" />
      </g>

      {/* ブロック間の通路（破線） */}
      <line x1="475" y1="220" x2="510" y2="220" stroke="#C9A87C" strokeWidth="3" strokeDasharray="6,3" />
      <line x1="730" y1="220" x2="770" y2="220" stroke="#C9A87C" strokeWidth="3" strokeDasharray="6,3" />

      {/* タップ判定領域＋ラベル */}
      {HIT_AREAS.map((area) => {
        const count = areaCounts[area.id] ?? 0
        const sample = PLANT_LABELS[area.id]
        const fill = area.id <= "I" ? "#2D5016" : area.id <= "M" ? "#5C3A1E" : "#5C2D1E"
        const sampleColor = area.id <= "I" ? "#5C8052" : area.id <= "M" ? "#9A7F5A" : "#A56544"
        return (
          <g
            key={area.id}
            onClick={() => router.push(`/areas/${area.id}`)}
            style={{ cursor: "pointer" }}
            className="group"
          >
            {/* 透明クリック領域 */}
            <rect
              x={area.x}
              y={area.y}
              width={area.w}
              height={area.h}
              fill="transparent"
              className="transition-colors group-hover:fill-black/5 group-active:fill-black/10"
            />
            {/* エリア記号 */}
            <text
              x={area.labelX}
              y={area.labelY}
              fontSize={area.id === "J" || area.id === "K" || area.id === "L" || area.id === "M" ? 22 : 17}
              fontWeight="bold"
              fill={fill}
              textAnchor={area.id === "J" || area.id === "K" || area.id === "L" || area.id === "M" ? "middle" : undefined}
              className="pointer-events-none select-none"
            >
              {area.id}
            </text>
            {/* 種数 */}
            {count > 0 && (
              <text
                x={area.labelX + (area.id === "J" || area.id === "K" || area.id === "L" || area.id === "M" ? 0 : 18)}
                y={area.labelY + 11}
                fontSize="9"
                fill="#666"
                textAnchor={area.id === "J" || area.id === "K" || area.id === "L" || area.id === "M" ? "middle" : "start"}
                className="pointer-events-none select-none"
              >
                {count}種
              </text>
            )}
            {/* 代表植物（一部エリアのみ） */}
            {sample && (
              <text
                x={area.labelX - (area.id === "C" ? 20 : 0)}
                y={area.labelY + 22}
                fontSize="9"
                fill={sampleColor}
                className="pointer-events-none select-none"
              >
                {sample}
              </text>
            )}
          </g>
        )
      })}

      {/* 現在地 */}
      {currentLocation && (
        <g id="current-location">
          <circle
            cx={currentLocation.x}
            cy={currentLocation.y}
            r="11"
            fill="#FF3B30"
            stroke="white"
            strokeWidth="3"
          />
          <circle
            cx={currentLocation.x}
            cy={currentLocation.y}
            r="18"
            fill="none"
            stroke="#FF3B30"
            strokeWidth="2"
            opacity="0.4"
          >
            <animate attributeName="r" values="11;22;11" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;0;0.6" dur="2s" repeatCount="indefinite" />
          </circle>
        </g>
      )}

      {/* 凡例 */}
      <g transform="translate(60, 390)" fontSize="12" fill="#666">
        <line x1="0" y1="-4" x2="30" y2="-4" stroke="#C9A87C" strokeWidth="3" strokeDasharray="6,3" />
        <text x="38" y="0">主要通路</text>
        <circle cx="135" cy="-4" r="6" fill="#FF3B30" stroke="white" strokeWidth="2" />
        <text x="148" y="0">現在地</text>
        <text x="220" y="0">A〜W : エリア記号（全23区画）</text>
      </g>
    </svg>
  )
}
