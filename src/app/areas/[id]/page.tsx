"use client"

import { useState, useEffect, use, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Leaf, MapPin } from "lucide-react"
import { fetchPlants, PLANTS_LOAD_ERROR } from "@/lib/plants-api"
import { fetchPlantPositions, MAP_LOAD_ERROR } from "@/lib/map-api"
import type { Plant, PlantPhoto } from "@/types/database"
import { getRepresentativePhoto } from "@/lib/photo-utils"
import PlantImage from "@/components/plant-image"

type PlantPos = { name: string; x: number; y: number }

// ─── 配置マップの描画設定 ───────────────────────────────────────────────────────

// 描画領域（viewBox）の大きさ
const MAP_W = 320
const MAP_H = 200

// Excel座標は、全体マップのSVG座標に比べて縦が約1.6倍の単位系になっている。
// 2026年10月14日に実データで検算した結果、エリアAで0.642、エリアBで0.598。
// 厳密な座標変換ではなく、見た目の縦横比をそろえるための補正。
// plant_positions の値は変えず、表示のときだけ掛ける。
const Y_SCALE = 0.6

// 倍率の上限。2026年10月14日の実データで、植物の多いエリア（T・B・W・A・K）の
// 倍率が1.1〜2.0だったため、その2倍を上限とした。
// 株数の少ない小さなエリアで、近くの株が描画領域いっぱいに離れて描かれるのを防ぐ。
const MAX_SCALE = 4

// マーカーの範囲の最小サイズ（描画領域内の値）。1件だけ・一直線に並ぶエリアで
// 枠が点や細い棒にならないよう、中心を保ったままこの大きさまで広げる。
const MIN_EXTENT_W = 60
const MIN_EXTENT_H = 40

// マーカーの範囲から枠までの余白（マーカー半径8＋余白10）
const FRAME_PAD = 18
// 枠の線が描画領域の端で切れないための余白
const EDGE_PAD = 4

export default function AreaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: areaId } = use(params)
  const router = useRouter()
  const [plants, setPlants] = useState<Plant[]>([])
  const [positions, setPositions] = useState<PlantPos[]>([])
  const [photos, setPhotos] = useState<Record<string, PlantPhoto>>({})
  const [selectedPlant, setSelectedPlant] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  // 配置マップの取得失敗。植物リストの表示は続けたいので loadError とは分けて持つ。
  const [positionsError, setPositionsError] = useState<string | null>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    async function fetchData() {
      const [plantsData, posData] = await Promise.all([
        // plants も plant_positions も RLS で anon を遮断するため API 経由で読む。
        fetchPlants({ area: areaId, order: "area_plant_no" }).catch((e) => {
          console.error("plants 取得失敗", e)
          return null
        }),
        fetchPlantPositions(areaId).catch((e) => {
          console.error("plant_positions 取得失敗", e)
          return null
        }),
      ])

      // 取得できなかったときは「まだ登録されていません」に見せない
      setLoadError(plantsData === null ? PLANTS_LOAD_ERROR : null)

      if (plantsData) {
        setPlants(plantsData)

        const names = plantsData.map((p) => p.name)
        if (names.length > 0) {
          // plant_photos は RLS で anon を遮断しているため API 経由で読む。
          // 植物名を並べたURLは長くなりすぎるため全件を取得し、手元で絞り込む。
          const photoRes = await fetch("/api/plant-photos")
          const { photos: photoData } = photoRes.ok
            ? await photoRes.json()
            : { photos: [] as PlantPhoto[] }
          const nameSet = new Set(names)
          const scoped = (photoData as PlantPhoto[]).filter((p) => nameSet.has(p.plant_name))

          if (scoped) {
            const byPlant: Record<string, PlantPhoto[]> = {}
            for (const photo of scoped) {
              if (!byPlant[photo.plant_name]) byPlant[photo.plant_name] = []
              byPlant[photo.plant_name].push(photo)
            }
            const photoMap: Record<string, PlantPhoto> = {}
            for (const [name, list] of Object.entries(byPlant)) {
              const rep = getRepresentativePhoto(list)
              if (rep) photoMap[name] = rep
            }
            setPhotos(photoMap)
          }
        }
      }

      // 取得できなかったときは「配置マップなし」に見せない
      setPositionsError(posData === null ? MAP_LOAD_ERROR : null)
      setPositions(posData ?? [])
      setLoading(false)
    }
    fetchData()
  }, [areaId])

  // plant_positions の名前と plants テーブルの名前を2段階マッチングで紐づける
  // Step1: 完全一致を優先
  // Step2: サフィックス（(1)(2)(L)等）除去後のマッチ（未使用DBレコードのみ対象）
  //        数字サフィックスの場合は名前順に処理し、同名植物を順番に割り当てる
  const posNameToPlant = useMemo(() => {
    const result = new Map<string, Plant>()
    const usedIds = new Set<string>()

    // Step1: 完全一致
    for (const pos of positions) {
      const plant = plants.find((p) => p.name === pos.name && !usedIds.has(p.id))
      if (plant) {
        result.set(pos.name, plant)
        usedIds.add(plant.id)
      }
    }

    // Step2: サフィックス除去マッチ（名前順にソートして (1)(2) の順序を保証）
    const unmatched = positions.filter((p) => !result.has(p.name))
    unmatched.sort((a, b) => a.name.localeCompare(b.name, "ja"))

    for (const pos of unmatched) {
      const base = pos.name.replace(/\s*\([^)]*\)\s*$/, "").trim()
      if (base === pos.name) continue

      const candidates = plants
        .filter((p) => p.name === base && !usedIds.has(p.id))
        .sort((a, b) => (a.plant_no ?? 999) - (b.plant_no ?? 999))

      if (candidates.length >= 1) {
        result.set(pos.name, candidates[0])
        usedIds.add(candidates[0].id)
      }
    }

    return result
  }, [plants, positions])

  const getPlantId = (name: string) => posNameToPlant.get(name)?.id
  const getPlantNo = (name: string) => posNameToPlant.get(name)?.plant_no ?? null

  return (
    <div className="min-h-dvh">
      {/* Header */}
      <div className={`area-${areaId.toLowerCase()} px-4 pt-4 pb-5`}>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-herb-text/70 text-sm mb-3"
        >
          <ArrowLeft size={18} />
          戻る
        </button>
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-xl bg-white/60 flex items-center justify-center">
            <span className="text-2xl font-bold text-herb-text">{areaId}</span>
          </div>
          <div>
            <h1 className="text-xl font-bold">エリア {areaId}</h1>
            <p className="text-sm text-herb-text-secondary">
              {plants.length}種のハーブ
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-4 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-xl p-3 shadow-sm animate-pulse"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-green-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-green-100 rounded w-1/2" />
                  <div className="h-3 bg-green-50 rounded w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* 配置マップの取得に失敗したときは「配置情報なし」と区別して伝える */}
          {positionsError && (
            <div className="px-4 pt-4">
              <h2 className="text-sm font-bold mb-2 flex items-center gap-1.5">
                <MapPin size={14} className="text-herb-primary" />
                配置マップ
              </h2>
              <div className="bg-white rounded-2xl p-4 shadow-sm text-sm text-gray-500 text-center">
                {positionsError}
              </div>
            </div>
          )}

          {/* SVG配置マップ（plant_positionsテーブルから取得・自動スケーリング） */}
          {!positionsError && positions.length > 0 && (() => {
            const xs = positions.map((p) => p.x)
            const ys = positions.map((p) => p.y * Y_SCALE)
            const minX = Math.min(...xs)
            const maxX = Math.max(...xs)
            const minY = Math.min(...ys)
            const maxY = Math.max(...ys)
            const rangeX = maxX - minX
            const rangeY = maxY - minY
            // 枠と余白を除いた、マーカーを置ける大きさ
            const availW = MAP_W - (EDGE_PAD + FRAME_PAD) * 2
            const availH = MAP_H - (EDGE_PAD + FRAME_PAD) * 2
            // 範囲が0の向き（1件だけ・一直線）は倍率の計算に使わない
            const scale = Math.min(
              rangeX > 0 ? availW / rangeX : Infinity,
              rangeY > 0 ? availH / rangeY : Infinity,
              MAX_SCALE,
            )
            // マーカーの範囲を最小サイズまで広げ、余白を足して枠にする（中央に置く）
            const frameW = Math.max(rangeX * scale, MIN_EXTENT_W) + FRAME_PAD * 2
            const frameH = Math.max(rangeY * scale, MIN_EXTENT_H) + FRAME_PAD * 2
            const centerX = (minX + maxX) / 2
            const centerY = (minY + maxY) / 2
            const toSvg = (ex: number, ey: number) => ({
              x: MAP_W / 2 + (ex - centerX) * scale,
              y: MAP_H / 2 + (ey * Y_SCALE - centerY) * scale,
            })
            return (
              <div className="px-4 pt-4">
                <h2 className="text-sm font-bold mb-2 flex items-center gap-1.5">
                  <MapPin size={14} className="text-herb-primary" />
                  配置マップ
                </h2>
                <div className="bg-white rounded-2xl p-3 shadow-sm overflow-hidden">
                  <svg
                    viewBox={`0 0 ${MAP_W} ${MAP_H}`}
                    className="w-full"
                    style={{ maxHeight: "260px" }}
                    aria-label={`エリア${areaId} 植物配置図`}
                  >
                    {/* 植物のある範囲の枠。花壇の実際の形ではない */}
                    <rect
                      x={(MAP_W - frameW) / 2}
                      y={(MAP_H - frameH) / 2}
                      width={frameW}
                      height={frameH}
                      rx={6}
                      fill="rgba(29,158,117,0.05)"
                      stroke="#1D9E75"
                      strokeWidth={1.2}
                      strokeDasharray="4,3"
                      strokeOpacity={0.6}
                    />
                    {positions.map((pos, idx) => {
                      const { x, y } = toSvg(pos.x, pos.y)
                      const isSelected = selectedPlant === pos.name
                      const plantNo = getPlantNo(pos.name)
                      const noStr = plantNo != null ? String(plantNo) : ""
                      const r = isSelected ? 10 : 8
                      const fontSize = noStr.length >= 3 ? 5 : noStr.length === 2 ? 6 : 7
                      return (
                        <g
                          key={`${pos.name}-${idx}`}
                          onClick={() => setSelectedPlant(isSelected ? null : pos.name)}
                          style={{ cursor: "pointer" }}
                        >
                          <title>{noStr ? `No.${noStr} ${pos.name}` : pos.name}</title>
                          {isSelected && (
                            <circle cx={x} cy={y} r={r + 6} fill="#1D9E75" fillOpacity={0.15} />
                          )}
                          <circle
                            cx={x} cy={y}
                            r={r}
                            fill={isSelected ? "#1D9E75" : "#34C896"}
                            stroke="white"
                            strokeWidth={1.5}
                          />
                          {noStr && (
                            <text
                              x={x} y={y + fontSize * 0.4}
                              textAnchor="middle"
                              fontSize={fontSize}
                              fill="white"
                              fontWeight="700"
                              className="pointer-events-none select-none"
                            >
                              {noStr}
                            </text>
                          )}
                          {isSelected && (
                            <>
                              <rect
                                x={x - 32} y={y - r - 14}
                                width="64" height="12"
                                rx="3"
                                fill="rgba(15,60,40,0.85)"
                              />
                              <text
                                x={x} y={y - r - 5}
                                textAnchor="middle"
                                fontSize={8}
                                fill="white"
                                fontWeight="600"
                                className="pointer-events-none select-none"
                              >
                                {noStr ? `No.${noStr} ` : ""}{pos.name.length > 7 ? pos.name.slice(0, 6) + "…" : pos.name}
                              </text>
                            </>
                          )}
                        </g>
                      )
                    })}
                  </svg>
                  <p className="text-center text-xs text-herb-text-secondary mt-1">
                    枠は、植物のある範囲のおおよそを示しています。
                  </p>
                  {selectedPlant && (
                    <div className="mt-2 pt-2 border-t border-herb-border">
                      <Link
                        href={`/plants/${getPlantId(selectedPlant) || ""}`}
                        className="flex items-center justify-between p-2 rounded-xl bg-green-50 text-sm"
                      >
                        <span className="font-medium">
                          {getPlantNo(selectedPlant) != null && (
                            <span className="text-herb-primary mr-1">No.{getPlantNo(selectedPlant)}</span>
                          )}
                          {selectedPlant}
                        </span>
                        <span className="text-herb-primary text-xs">詳細を見る →</span>
                      </Link>
                    </div>
                  )}
                  <p className="text-center text-xs text-herb-text-secondary mt-1.5">
                    タップで植物名を表示
                  </p>
                </div>
              </div>
            )
          })()}

          {/* Plant list */}
          <div className="px-4 pt-4 pb-6">
            <h2 className="text-sm font-bold mb-3 flex items-center gap-1.5">
              <Leaf size={14} className="text-herb-primary" />
              ハーブ一覧
            </h2>
            <div className="space-y-2">
              {plants.map((plant) => (
                <Link
                  key={plant.id}
                  href={`/plants/${plant.id}`}
                  className="flex items-center gap-3 bg-white rounded-xl p-3 shadow-sm card-hover"
                >
                  <div className="w-12 h-12 rounded-lg bg-green-100 overflow-hidden flex-shrink-0">
                    <PlantImage
                      storagePath={photos[plant.name]?.storage_path}
                      alt={plant.name}
                      width={48}
                      height={48}
                      className="w-full h-full"
                      iconSize={16}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">
                      {plant.name}
                    </h3>
                    <p className="text-xs text-herb-text-secondary truncate">
                      {plant.category || ""}
                      {plant.plant_no ? ` ・ No.${plant.plant_no}` : ""}
                    </p>
                  </div>
                </Link>
              ))}
              {plants.length === 0 && (
                <div className="text-center py-12">
                  <Leaf size={32} className="text-green-200 mx-auto mb-2" />
                  <p className="text-herb-text-secondary text-sm">
                    {loadError ?? "このエリアにはまだハーブが登録されていません"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
