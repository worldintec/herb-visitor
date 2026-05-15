"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { Search, Leaf, MapPin, Filter, X } from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { Plant, PlantPhoto } from "@/types/database"
import { getRepresentativePhoto } from "@/lib/photo-utils"
import PlantImage from "@/components/plant-image"

export default function PlantsPage() {
  const [plants, setPlants] = useState<Plant[]>([])
  const [photos, setPhotos] = useState<Record<string, PlantPhoto>>({})
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedArea, setSelectedArea] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("")
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    async function fetchData() {
      const { data: plantData } = await supabase
        .from("plants")
        .select("*")
        .order("area")
        .order("name")

      if (plantData) {
        setPlants(plantData)

        const names = plantData.map((p) => p.name)
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
      setLoading(false)
    }
    fetchData()
  }, [])

  const areas = useMemo(
    () => [...new Set(plants.map((p) => p.area))].sort(),
    [plants]
  )

  const categories = useMemo(
    () =>
      [...new Set(plants.map((p) => p.category).filter(Boolean))].sort() as string[],
    [plants]
  )

  // 同一ハーブ名の重複を排除（複数エリアに存在する場合は最初の1件のみ）
  const uniquePlants = useMemo(() => {
    const seen = new Set<string>()
    return plants.filter((p) => {
      if (seen.has(p.name)) return false
      seen.add(p.name)
      return true
    })
  }, [plants])

  const filteredPlants = useMemo(() => {
    return uniquePlants.filter((p) => {
      if (selectedArea && p.area !== selectedArea) return false
      if (selectedCategory && p.category !== selectedCategory) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return (
          p.name.toLowerCase().includes(q) ||
          (p.category && p.category.toLowerCase().includes(q)) ||
          (p.herb_use && p.herb_use.toLowerCase().includes(q)) ||
          (p.scent && p.scent.toLowerCase().includes(q))
        )
      }
      return true
    })
  }, [uniquePlants, selectedArea, selectedCategory, searchQuery])

  const activeFilterCount =
    (selectedArea ? 1 : 0) + (selectedCategory ? 1 : 0)

  return (
    <div className="min-h-dvh">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-herb-bg/95 backdrop-blur-md border-b border-herb-border">
        <div className="px-4 pt-4 pb-3">
          <h1 className="text-lg font-bold mb-3">ハーブ一覧</h1>

          {/* Search */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-herb-text-secondary"
              />
              <input
                type="text"
                placeholder="名前・用途・香りで検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-9 pr-4 rounded-xl bg-white text-sm border border-herb-border focus:outline-none focus:ring-2 focus:ring-herb-primary/30 focus:border-herb-primary"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`h-10 px-3 rounded-xl border flex items-center gap-1.5 text-sm font-medium transition-colors ${
                activeFilterCount > 0
                  ? "bg-herb-primary text-white border-herb-primary"
                  : "bg-white text-herb-text-secondary border-herb-border"
              }`}
            >
              <Filter size={16} />
              {activeFilterCount > 0 && (
                <span className="bg-white text-herb-primary rounded-full w-4 h-4 text-[10px] flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="mt-3 space-y-2">
              <div>
                <label className="text-xs font-medium text-herb-text-secondary mb-1 block">
                  エリア
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setSelectedArea("")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      !selectedArea
                        ? "bg-herb-primary text-white"
                        : "bg-white text-herb-text-secondary border border-herb-border"
                    }`}
                  >
                    すべて
                  </button>
                  {areas.map((area) => (
                    <button
                      key={area}
                      onClick={() =>
                        setSelectedArea(area === selectedArea ? "" : area)
                      }
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        selectedArea === area
                          ? "bg-herb-primary text-white"
                          : "bg-white text-herb-text-secondary border border-herb-border"
                      }`}
                    >
                      {area}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-herb-text-secondary mb-1 block">
                  カテゴリ
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setSelectedCategory("")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      !selectedCategory
                        ? "bg-herb-primary text-white"
                        : "bg-white text-herb-text-secondary border border-herb-border"
                    }`}
                  >
                    すべて
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() =>
                        setSelectedCategory(
                          cat === selectedCategory ? "" : cat
                        )
                      }
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        selectedCategory === cat
                          ? "bg-herb-primary text-white"
                          : "bg-white text-herb-text-secondary border border-herb-border"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              {activeFilterCount > 0 && (
                <button
                  onClick={() => {
                    setSelectedArea("")
                    setSelectedCategory("")
                  }}
                  className="flex items-center gap-1 text-xs text-rose-500 font-medium"
                >
                  <X size={12} />
                  フィルターをクリア
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="px-4 py-2">
        <p className="text-xs text-herb-text-secondary">
          {filteredPlants.length}種のハーブ
        </p>
      </div>

      {/* Plant Grid */}
      <div className="px-4 pb-6">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl overflow-hidden shadow-sm animate-pulse"
              >
                <div className="aspect-[4/3] bg-green-100" />
                <div className="p-3 space-y-2">
                  <div className="h-4 bg-green-100 rounded w-3/4" />
                  <div className="h-3 bg-green-50 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredPlants.length === 0 ? (
          <div className="text-center py-16">
            <Leaf size={40} className="text-green-200 mx-auto mb-3" />
            <p className="text-herb-text-secondary text-sm">
              該当するハーブが見つかりませんでした
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredPlants.map((plant) => (
              <Link
                key={plant.id}
                href={`/plants/${plant.id}`}
                className="bg-white rounded-2xl overflow-hidden shadow-sm card-hover"
              >
                <div className="aspect-[4/3] bg-green-100 relative">
                  <PlantImage
                    storagePath={photos[plant.name]?.storage_path}
                    alt={plant.name}
                    fill
                    sizes="(max-width: 512px) 50vw, 230px"
                    iconSize={32}
                  />
                  <span className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm rounded-full px-2 py-0.5 text-[10px] font-semibold text-herb-primary">
                    <MapPin size={10} className="inline mr-0.5" />
                    {plant.area}
                  </span>
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-sm truncate">
                    {plant.name}
                  </h3>
                  {plant.category && (
                    <p className="text-xs text-herb-text-secondary mt-0.5 truncate">
                      {plant.category}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
