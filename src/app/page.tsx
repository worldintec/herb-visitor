"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Search, Leaf, MapPin, ChevronRight, Sparkles } from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { Plant, PlantPhoto } from "@/types/database"
import { getRepresentativePhoto } from "@/lib/photo-utils"
import PlantImage from "@/components/plant-image"

const AREAS = "ABCDEFGHIJKLMNOPQRSTUVW".split("")

// feature_flowerテキストから開花月を推定（1-12）
function bloomMonthsFromText(text: string | null | undefined): Set<number> {
  const months = new Set<number>()
  if (!text) return months
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
  for (const [key, ms] of Object.entries(seasonMap)) {
    if (text.includes(key)) for (const m of ms) months.add(m)
  }
  return months
}

export default function HomePage() {
  const [plants, setPlants] = useState<Plant[]>([])
  const [photos, setPhotos] = useState<Record<string, PlantPhoto>>({})
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const currentMonth = new Date().getMonth() + 1

  useEffect(() => {
    async function fetchData() {
      // 植栽マスタを直接カウント（is_planted フィルターは外す）
      // 来園者向けには「植えられているか」=「マスタに登録されているか」で判定
      const { data: plantData } = await supabase
        .from("plants")
        .select("*")
        .order("created_at", { ascending: false })

      if (plantData) {
        setPlants(plantData)

        const names = plantData.map((p) => p.name)
        const { data: photoData } = await supabase
          .from("plant_photos")
          .select("*")
          .in("plant_name", names)

        if (photoData) {
          // 植物ごとに写真を集約し、キャプション優先順位で代表写真を選択
          const photosByPlant: Record<string, PlantPhoto[]> = {}
          for (const photo of photoData) {
            if (!photosByPlant[photo.plant_name]) photosByPlant[photo.plant_name] = []
            photosByPlant[photo.plant_name].push(photo)
          }
          const photoMap: Record<string, PlantPhoto> = {}
          for (const [name, list] of Object.entries(photosByPlant)) {
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

  // 現在月に開花する植物を抽出 + 「開花」キャプション写真がある植物を最優先に
  const seasonalPlants = plants
    .filter(p => bloomMonthsFromText(p.feature_flower).has(currentMonth))
    .sort((a, b) => {
      // 開花キャプション写真の有無でソート（あり=0、なし=1）
      const aHasBloom = photos[a.name]?.caption?.trim() === "開花" ? 0 : 1
      const bHasBloom = photos[b.name]?.caption?.trim() === "開花" ? 0 : 1
      if (aHasBloom !== bHasBloom) return aHasBloom - bHasBloom
      // 次に写真の有無でソート（あり=0、なし=1）
      const aHasPhoto = photos[a.name] ? 0 : 1
      const bHasPhoto = photos[b.name] ? 0 : 1
      return aHasPhoto - bHasPhoto
    })
    .slice(0, 8)

  const areaCounts = plants.reduce(
    (acc, p) => {
      acc[p.area] = (acc[p.area] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const filteredPlants = searchQuery
    ? plants.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.category && p.category.includes(searchQuery)) ||
          (p.herb_use && p.herb_use.includes(searchQuery))
      )
    : []

  const recentPlants = plants.slice(0, 6)

  return (
    <div className="min-h-dvh">
      {/* Hero */}
      <section className="hero-gradient px-5 pt-12 pb-8 rounded-b-3xl">
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1 mb-4">
            <Leaf size={14} className="text-white" />
            <span className="text-white/90 text-xs font-medium">
              Herb Garden Guide
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white leading-tight mb-2">
            見沼氷川公園
            <br />
            ハーブ園
          </h1>
          <p className="text-white/80 text-sm">
            園内のハーブを写真付きでご案内します
          </p>
        </div>

        {/* Search */}
        <div className="mt-6 relative">
          <Search
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-herb-text-secondary"
          />
          <input
            type="text"
            placeholder="ハーブを検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 pl-10 pr-4 rounded-2xl bg-white text-herb-text placeholder:text-herb-text-secondary/60 text-sm shadow-lg border-0 focus:outline-none focus:ring-2 focus:ring-white/50"
          />
        </div>
      </section>

      {/* Search Results */}
      {searchQuery && (
        <section className="px-4 mt-4">
          <h2 className="text-sm font-semibold text-herb-text-secondary mb-3">
            検索結果 ({filteredPlants.length}件)
          </h2>
          {filteredPlants.length === 0 ? (
            <p className="text-center text-herb-text-secondary text-sm py-8">
              該当するハーブが見つかりませんでした
            </p>
          ) : (
            <div className="space-y-2">
              {filteredPlants.map((plant) => (
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
                    <p className="font-semibold text-sm truncate">
                      {plant.name}
                    </p>
                    <p className="text-xs text-herb-text-secondary">
                      エリア {plant.area}
                      {plant.category && ` ・ ${plant.category}`}
                    </p>
                  </div>
                  <ChevronRight
                    size={16}
                    className="text-herb-text-secondary/50"
                  />
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Seasonal Picks */}
      {!searchQuery && seasonalPlants.length > 0 && (
        <section className="px-4 mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold flex items-center gap-1.5">
              <Sparkles size={16} className="text-herb-primary" />
              {currentMonth}月のおすすめハーブ
            </h2>
            <Link href="/plants" className="text-xs text-herb-primary font-medium flex items-center gap-0.5">
              すべて見る <ChevronRight size={14} />
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x">
            {seasonalPlants.map((plant) => (
              <Link
                key={plant.id}
                href={`/plants/${plant.id}`}
                className="flex-shrink-0 w-36 bg-white rounded-2xl overflow-hidden shadow-sm card-hover snap-start"
              >
                <div className="aspect-[4/3] bg-green-100 relative">
                  <PlantImage
                    storagePath={photos[plant.name]?.storage_path}
                    alt={plant.name}
                    fill
                    sizes="144px"
                    iconSize={28}
                  />
                  <span className="absolute top-2 left-2 bg-herb-primary/90 backdrop-blur-sm rounded-full px-2 py-0.5 text-[10px] font-semibold text-white">
                    見頃
                  </span>
                </div>
                <div className="p-2.5">
                  <h3 className="font-semibold text-sm truncate">{plant.name}</h3>
                  <p className="text-xs text-herb-text-secondary mt-0.5">
                    エリア {plant.area}
                    {plant.category && ` ・ ${plant.category}`}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Area Overview */}
      {!searchQuery && (
        <>
          <section className="px-4 mt-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold">エリアマップ</h2>
              <Link
                href="/areas"
                className="text-xs text-herb-primary font-medium flex items-center gap-0.5"
              >
                すべて見る
                <ChevronRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {AREAS.map((area) => (
                <Link
                  key={area}
                  href={`/areas/${area}`}
                  className={`area-${area.toLowerCase()} rounded-xl p-2.5 text-center card-hover shadow-sm`}
                >
                  <span className="text-lg font-bold text-herb-text">
                    {area}
                  </span>
                  <p className="text-[10px] text-herb-text-secondary mt-0.5">
                    {areaCounts[area] || 0}種
                  </p>
                </Link>
              ))}
            </div>
          </section>

          {/* Recent Plants */}
          <section className="px-4 mt-8 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold">ハーブ一覧</h2>
              <Link
                href="/plants"
                className="text-xs text-herb-primary font-medium flex items-center gap-0.5"
              >
                すべて見る
                <ChevronRight size={14} />
              </Link>
            </div>
            {loading ? (
              <div className="grid grid-cols-2 gap-3">
                {[...Array(4)].map((_, i) => (
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
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {recentPlants.map((plant) => (
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
                        <p className="text-xs text-herb-text-secondary mt-0.5">
                          {plant.category}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
