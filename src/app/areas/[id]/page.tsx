"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Leaf, MapPin } from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { Plant, PlantPhoto } from "@/types/database"
import { getRepresentativePhoto } from "@/lib/photo-utils"
import PlantImage from "@/components/plant-image"
import { EXCEL_PLANTS } from "@/data/excel-plants"
import { resetPinchZoom } from "@/lib/reset-pinch-zoom"

export default function AreaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: areaId } = use(params)
  const router = useRouter()
  const [plants, setPlants] = useState<Plant[]>([])
  const [photos, setPhotos] = useState<Record<string, PlantPhoto>>({})
  const [selectedPlant, setSelectedPlant] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // EXCEL_PLANTSからこのエリアの植物位置を取得
  const excelPositions = EXCEL_PLANTS.filter((p) => p.area === areaId)

  useEffect(() => {
    // マップでピンチズームした状態から遷移してきた場合に備え、表示直後にズームをリセットする
    resetPinchZoom()
  }, [])

  useEffect(() => {
    async function fetchData() {
      const [plantsRes] = await Promise.all([
        supabase
          .from("plants")
          .select("*")
          .eq("area", areaId)
          .order("plant_no"),
      ])

      if (plantsRes.data) {
        setPlants(plantsRes.data)

        const names = plantsRes.data.map((p) => p.name)
        if (names.length > 0) {
          const { data: photoData } = await supabase
            .from("plant_photos")
            .select("*")
            .in("plant_name", names)

          if (photoData) {
            const byPlant: Record<string, PlantPhoto[]> = {}
            for (const photo of photoData) {
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

      setLoading(false)
    }
    fetchData()
  }, [areaId])

  // Find plant ID by name
  const getPlantId = (name: string) => {
    const p = plants.find((pl) => pl.name === name)
    return p?.id
  }

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
          {/* SVG配置マップ（EXCEL_PLANTSデータ使用・自動スケーリング） */}
          {excelPositions.length > 0 && (() => {
            const PAD = 16
            const W = 320
            const H = 200
            const xs = excelPositions.map((p) => p.x)
            const ys = excelPositions.map((p) => p.y)
            const minX = Math.min(...xs)
            const maxX = Math.max(...xs)
            const minY = Math.min(...ys)
            const maxY = Math.max(...ys)
            const rangeX = maxX - minX || 40
            const rangeY = maxY - minY || 40
            const scaleX = (W - PAD * 2) / rangeX
            const scaleY = (H - PAD * 2) / rangeY
            const scale = Math.min(scaleX, scaleY)
            const toSvg = (ex: number, ey: number) => ({
              x: PAD + (ex - minX) * scale,
              y: PAD + (ey - minY) * scale,
            })
            return (
              <div className="px-4 pt-4">
                <h2 className="text-sm font-bold mb-2 flex items-center gap-1.5">
                  <MapPin size={14} className="text-herb-primary" />
                  配置マップ
                </h2>
                <div className="bg-white rounded-2xl p-3 shadow-sm overflow-hidden">
                  <svg
                    viewBox={`0 0 ${W} ${H}`}
                    className="w-full"
                    style={{ maxHeight: "260px" }}
                    aria-label={`エリア${areaId} 植物配置図`}
                  >
                    <rect width={W} height={H} fill="rgba(29,158,117,0.05)" rx="6" />
                    {excelPositions.map((pos) => {
                      const { x, y } = toSvg(pos.x, pos.y)
                      const isSelected = selectedPlant === pos.name
                      return (
                        <g
                          key={pos.id}
                          onClick={() => setSelectedPlant(isSelected ? null : pos.name)}
                          style={{ cursor: "pointer" }}
                        >
                          <title>{pos.name}</title>
                          {isSelected && (
                            <circle cx={x} cy={y} r={14} fill="#1D9E75" fillOpacity={0.15} />
                          )}
                          <circle
                            cx={x} cy={y}
                            r={isSelected ? 8 : 6}
                            fill={isSelected ? "#1D9E75" : "#34C896"}
                            stroke="white"
                            strokeWidth={1.5}
                          />
                          {isSelected && (
                            <>
                              <rect
                                x={x - 28} y={y - 18}
                                width="56" height="12"
                                rx="3"
                                fill="rgba(15,60,40,0.85)"
                              />
                              <text
                                x={x} y={y - 9}
                                textAnchor="middle"
                                fontSize={8}
                                fill="white"
                                fontWeight="600"
                                className="pointer-events-none select-none"
                              >
                                {pos.name.length > 8 ? pos.name.slice(0, 7) + "…" : pos.name}
                              </text>
                            </>
                          )}
                        </g>
                      )
                    })}
                  </svg>
                  {selectedPlant && (
                    <div className="mt-2 pt-2 border-t border-herb-border">
                      <Link
                        href={`/plants/${getPlantId(selectedPlant) || ""}`}
                        className="flex items-center justify-between p-2 rounded-xl bg-green-50 text-sm"
                      >
                        <span className="font-medium">{selectedPlant}</span>
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
                    このエリアにはまだハーブが登録されていません
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
