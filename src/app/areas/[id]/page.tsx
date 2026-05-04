"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Leaf, MapPin } from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { Plant, PlantPosition, PlantPhoto } from "@/types/database"
import { getRepresentativePhoto } from "@/lib/photo-utils"
import PlantImage from "@/components/plant-image"

export default function AreaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: areaId } = use(params)
  const router = useRouter()
  const [plants, setPlants] = useState<Plant[]>([])
  const [positions, setPositions] = useState<PlantPosition[]>([])
  const [photos, setPhotos] = useState<Record<string, PlantPhoto>>({})
  const [selectedPlant, setSelectedPlant] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const [plantsRes, positionsRes] = await Promise.all([
        supabase
          .from("plants")
          .select("*")
          .eq("area", areaId)
          .order("plant_no"),
        supabase.from("plant_positions").select("*").eq("area", areaId),
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

      if (positionsRes.data) setPositions(positionsRes.data)
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
          {/* SVG Map */}
          {positions.length > 0 && (
            <div className="px-4 pt-4">
              <h2 className="text-sm font-bold mb-2 flex items-center gap-1.5">
                <MapPin size={14} className="text-herb-primary" />
                配置マップ
              </h2>
              <div className="bg-white rounded-2xl p-3 shadow-sm overflow-hidden">
                <svg
                  viewBox="0 0 100 100"
                  className="w-full"
                  style={{ maxHeight: "300px" }}
                >
                  {/* Background grid */}
                  <rect
                    x="0"
                    y="0"
                    width="100"
                    height="100"
                    fill="oklch(0.97 0.02 145)"
                    rx="4"
                  />
                  {/* Grid lines */}
                  {[20, 40, 60, 80].map((v) => (
                    <g key={v}>
                      <line
                        x1={v}
                        y1="0"
                        x2={v}
                        y2="100"
                        stroke="oklch(0.92 0.02 145)"
                        strokeWidth="0.3"
                      />
                      <line
                        x1="0"
                        y1={v}
                        x2="100"
                        y2={v}
                        stroke="oklch(0.92 0.02 145)"
                        strokeWidth="0.3"
                      />
                    </g>
                  ))}

                  {/* Plant positions */}
                  {positions.map((pos) => {
                    const isSelected = selectedPlant === pos.name
                    return (
                      <g
                        key={`${pos.name}-${pos.x}-${pos.y}`}
                        onClick={() =>
                          setSelectedPlant(
                            isSelected ? null : pos.name
                          )
                        }
                        className="cursor-pointer"
                      >
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r={isSelected ? 4 : 3}
                          fill={
                            isSelected
                              ? "oklch(0.58 0.18 148)"
                              : "oklch(0.72 0.14 148)"
                          }
                          stroke="white"
                          strokeWidth="0.8"
                        />
                        {isSelected && (
                          <>
                            <rect
                              x={pos.x - 18}
                              y={pos.y - 10}
                              width="36"
                              height="7"
                              rx="1.5"
                              fill="oklch(0.22 0.04 145)"
                              opacity="0.9"
                            />
                            <text
                              x={pos.x}
                              y={pos.y - 5}
                              textAnchor="middle"
                              fontSize="3.5"
                              fill="white"
                              fontWeight="600"
                            >
                              {pos.name.length > 10
                                ? pos.name.slice(0, 10) + "..."
                                : pos.name}
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
                      <span className="text-herb-primary text-xs">
                        詳細を見る →
                      </span>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

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
