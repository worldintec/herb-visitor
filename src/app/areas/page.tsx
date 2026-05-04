"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { MapPin, Leaf, ChevronRight, Map } from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { Plant } from "@/types/database"

const AREAS = "ABCDEFGHIJKLMNOPQRSTUVW".split("")

// 平面図に基づくSVGレイアウト座標（viewBox: 0 0 800 600）
// 5列×5行のグリッド構成、A〜Wを園内の概略配置で展開
type AreaShape = {
  id: string
  x: number
  y: number
  w: number
  h: number
}
const AREA_LAYOUT: AreaShape[] = [
  // 北端: A B C D E
  { id: "A", x: 30, y: 30, w: 140, h: 90 },
  { id: "B", x: 180, y: 30, w: 140, h: 90 },
  { id: "C", x: 330, y: 30, w: 140, h: 90 },
  { id: "D", x: 480, y: 30, w: 140, h: 90 },
  { id: "E", x: 630, y: 30, w: 140, h: 90 },
  // 北中: F G H I J
  { id: "F", x: 30, y: 130, w: 140, h: 90 },
  { id: "G", x: 180, y: 130, w: 140, h: 90 },
  { id: "H", x: 330, y: 130, w: 140, h: 90 },
  { id: "I", x: 480, y: 130, w: 140, h: 90 },
  { id: "J", x: 630, y: 130, w: 140, h: 90 },
  // 中央: K L M N O
  { id: "K", x: 30, y: 230, w: 140, h: 90 },
  { id: "L", x: 180, y: 230, w: 140, h: 90 },
  { id: "M", x: 330, y: 230, w: 140, h: 90 },
  { id: "N", x: 480, y: 230, w: 140, h: 90 },
  { id: "O", x: 630, y: 230, w: 140, h: 90 },
  // 南中: P Q R S T
  { id: "P", x: 30, y: 330, w: 140, h: 90 },
  { id: "Q", x: 180, y: 330, w: 140, h: 90 },
  { id: "R", x: 330, y: 330, w: 140, h: 90 },
  { id: "S", x: 480, y: 330, w: 140, h: 90 },
  { id: "T", x: 630, y: 330, w: 140, h: 90 },
  // 南端: U V W
  { id: "U", x: 105, y: 430, w: 200, h: 130 },
  { id: "V", x: 320, y: 430, w: 200, h: 130 },
  { id: "W", x: 535, y: 430, w: 160, h: 130 },
]

const AREA_NAMES: Record<string, string> = {
  A: "エリアA",
  B: "エリアB",
  C: "エリアC",
  D: "エリアD",
  E: "エリアE",
  F: "エリアF",
  G: "エリアG",
  H: "エリアH",
  I: "エリアI",
  J: "エリアJ",
  K: "エリアK",
  L: "エリアL",
  M: "エリアM",
  N: "エリアN",
  O: "エリアO",
  P: "エリアP",
  Q: "エリアQ",
  R: "エリアR",
  S: "エリアS",
  T: "エリアT",
  U: "エリアU",
  V: "エリアV",
  W: "エリアW",
}

export default function AreasPage() {
  const router = useRouter()
  const [plants, setPlants] = useState<Plant[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<"map" | "list">("map")

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabase
        .from("plants")
        .select("*")

      if (data) setPlants(data)
      setLoading(false)
    }
    fetchData()
  }, [])

  const areaCounts = plants.reduce(
    (acc, p) => {
      acc[p.area] = (acc[p.area] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const areaCategories = plants.reduce(
    (acc, p) => {
      if (!acc[p.area]) acc[p.area] = new Set()
      if (p.category) acc[p.area].add(p.category)
      return acc
    },
    {} as Record<string, Set<string>>
  )

  return (
    <div className="min-h-dvh">
      {/* Header */}
      <div className="hero-gradient px-5 pt-10 pb-6 rounded-b-3xl">
        <div className="flex items-center gap-2 mb-2">
          <MapPin size={20} className="text-white" />
          <h1 className="text-xl font-bold text-white">エリアマップ</h1>
        </div>
        <p className="text-white/80 text-sm">
          全{AREAS.length}エリアのハーブ園をご案内します
        </p>
      </div>

      {/* View切替タブ */}
      <div className="px-4 pt-4">
        <div className="inline-flex rounded-full bg-white shadow-sm p-1">
          <button
            onClick={() => setView("map")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
              view === "map" ? "bg-herb-primary text-white" : "text-herb-text-secondary"
            }`}
          >
            <Map size={14} />
            マップ
          </button>
          <button
            onClick={() => setView("list")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
              view === "list" ? "bg-herb-primary text-white" : "text-herb-text-secondary"
            }`}
          >
            <Leaf size={14} />
            リスト
          </button>
        </div>
      </div>

      {/* SVGグラフィカルマップ */}
      {view === "map" && !loading && (
        <div className="px-4 pt-4">
          <div className="bg-white rounded-2xl p-3 shadow-sm">
            <svg
              viewBox="0 0 800 600"
              className="w-full h-auto"
              aria-label="ハーブ園エリアマップ"
            >
              {/* 園全体の外枠 */}
              <rect
                x="10"
                y="10"
                width="780"
                height="580"
                rx="12"
                fill="oklch(0.97 0.02 145)"
                stroke="oklch(0.58 0.18 148)"
                strokeWidth="2"
              />
              {/* 各エリア */}
              {AREA_LAYOUT.map((area) => {
                const count = areaCounts[area.id] || 0
                return (
                  <g
                    key={area.id}
                    onClick={() => router.push(`/areas/${area.id}`)}
                    className="cursor-pointer group"
                  >
                    <rect
                      x={area.x}
                      y={area.y}
                      width={area.w}
                      height={area.h}
                      rx="6"
                      fill="oklch(0.88 0.08 148)"
                      stroke="oklch(0.58 0.18 148)"
                      strokeWidth="1.5"
                      className="transition-colors group-hover:fill-[oklch(0.78_0.13_148)] group-active:fill-[oklch(0.7_0.16_148)]"
                    />
                    <text
                      x={area.x + area.w / 2}
                      y={area.y + area.h / 2 - 6}
                      textAnchor="middle"
                      fontSize="22"
                      fontWeight="bold"
                      fill="oklch(0.32 0.04 145)"
                      className="pointer-events-none select-none"
                    >
                      {area.id}
                    </text>
                    <text
                      x={area.x + area.w / 2}
                      y={area.y + area.h / 2 + 14}
                      textAnchor="middle"
                      fontSize="11"
                      fill="oklch(0.45 0.04 145)"
                      className="pointer-events-none select-none"
                    >
                      {count}種
                    </text>
                  </g>
                )
              })}
            </svg>
            <p className="text-xs text-herb-text-secondary text-center mt-2">
              エリアをタップすると詳細を表示します
            </p>
          </div>
        </div>
      )}

      {/* Area Grid */}
      <div className={`px-4 py-5 space-y-3 ${view === "map" ? "hidden" : ""}`}>
        {loading
          ? [...Array(6)].map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-4 shadow-sm animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-green-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-green-100 rounded w-1/3" />
                    <div className="h-3 bg-green-50 rounded w-2/3" />
                  </div>
                </div>
              </div>
            ))
          : AREAS.map((area) => {
              const count = areaCounts[area] || 0
              const cats = areaCategories[area]
                ? Array.from(areaCategories[area]).slice(0, 3)
                : []

              return (
                <Link
                  key={area}
                  href={`/areas/${area}`}
                  className="flex items-center gap-3 bg-white rounded-2xl p-4 shadow-sm card-hover"
                >
                  <div
                    className={`area-${area.toLowerCase()} w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0`}
                  >
                    <span className="text-2xl font-bold text-herb-text">
                      {area}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold text-sm">
                        {AREA_NAMES[area]}
                      </h2>
                      <ChevronRight
                        size={16}
                        className="text-herb-text-secondary/50"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Leaf size={12} className="text-green-400" />
                      <span className="text-xs text-herb-text-secondary">
                        {count}種のハーブ
                      </span>
                    </div>
                    {cats.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {cats.map((cat) => (
                          <span
                            key={cat}
                            className="bg-green-50 text-green-600 rounded-full px-2 py-0.5 text-[10px] font-medium"
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
      </div>
    </div>
  )
}
