"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Leaf,
  Flower2,
  Wind,
  UtensilsCrossed,
  AlertTriangle,
  Heart,
  PenLine,
  ChevronLeft,
  ChevronRight,
  MapPin,
  MessageCircle,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { Plant, PlantPhoto } from "@/types/database"
import { sortPhotosByPriority } from "@/lib/photo-utils"

interface PlantNote {
  id: string
  content: string
  author: string | null
  created_at: string
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

function getPhotoUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/plant-photos/${path}`
}

export default function PlantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [plant, setPlant] = useState<Plant | null>(null)
  const [photos, setPhotos] = useState<PlantPhoto[]>([])
  const [notes, setNotes] = useState<PlantNote[]>([])
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const { data: plantData } = await supabase
        .from("plants")
        .select("*")
        .eq("id", id)
        .single()

      if (plantData) {
        setPlant(plantData)

        const [photoRes, noteRes] = await Promise.all([
          supabase
            .from("plant_photos")
            .select("*")
            .eq("plant_name", plantData.name)
            .order("uploaded_at", { ascending: false }),
          // インプット記録の観察ノートを取得（content と作成日のみ）
          supabase
            .from("plant_notes")
            .select("id, content, author, created_at")
            .eq("plant_name", plantData.name)
            .not("content", "is", null)
            .neq("content", "")
            .order("created_at", { ascending: false }),
        ])

        if (photoRes.data) setPhotos(sortPhotosByPriority(photoRes.data))
        if (noteRes.data) setNotes(noteRes.data as PlantNote[])
      }
      setLoading(false)
    }
    fetchData()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-dvh animate-pulse">
        <div className="aspect-square bg-green-100" />
        <div className="p-4 space-y-4">
          <div className="h-6 bg-green-100 rounded w-1/2" />
          <div className="h-4 bg-green-50 rounded w-3/4" />
          <div className="h-4 bg-green-50 rounded w-2/3" />
        </div>
      </div>
    )
  }

  if (!plant) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-4">
        <Leaf size={48} className="text-green-200 mb-4" />
        <p className="text-herb-text-secondary mb-4">
          ハーブが見つかりませんでした
        </p>
        <button
          onClick={() => router.back()}
          className="text-herb-primary font-medium text-sm"
        >
          戻る
        </button>
      </div>
    )
  }

  const infoItems = [
    {
      icon: Flower2,
      label: "花の特徴",
      value: plant.feature_flower,
      color: "text-rose-400",
      bg: "bg-rose-50",
    },
    {
      icon: Leaf,
      label: "葉の特徴",
      value: plant.feature_leaf,
      color: "text-green-500",
      bg: "bg-green-50",
    },
    {
      icon: Wind,
      label: "香り",
      value: plant.scent,
      color: "text-sky-400",
      bg: "bg-sky-50",
    },
    {
      icon: UtensilsCrossed,
      label: "利用法",
      value: plant.herb_use,
      color: "text-amber-500",
      bg: "bg-amber-50",
    },
    {
      icon: Heart,
      label: "育て方のポイント",
      value: plant.care_point,
      color: "text-emerald-500",
      bg: "bg-emerald-50",
    },
    {
      icon: AlertTriangle,
      label: "注意事項",
      value: plant.caution,
      color: "text-rose-500",
      bg: "bg-rose-50",
    },
  ].filter((item) => item.value)

  return (
    <div className="min-h-dvh">
      {/* Photo Gallery */}
      <div className="relative aspect-square bg-green-100">
        {photos.length > 0 ? (
          <>
            <Image
              src={getPhotoUrl(photos[currentPhotoIndex].storage_path)}
              alt={plant.name}
              fill
              className="object-cover"
              sizes="(max-width: 512px) 100vw, 512px"
              priority
            />
            {photos.length > 1 && (
              <>
                <button
                  onClick={() =>
                    setCurrentPhotoIndex((i) =>
                      i === 0 ? photos.length - 1 : i - 1
                    )
                  }
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={() =>
                    setCurrentPhotoIndex((i) =>
                      i === photos.length - 1 ? 0 : i + 1
                    )
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white"
                >
                  <ChevronRight size={20} />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {photos.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPhotoIndex(i)}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        i === currentPhotoIndex
                          ? "bg-white"
                          : "bg-white/50"
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
            {photos[currentPhotoIndex].caption && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-3 pt-8">
                <p className="text-white text-xs">
                  {photos[currentPhotoIndex].caption}
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-green-50">
            <Leaf size={64} className="text-green-300 mb-2" />
            <span className="text-green-500/70 font-medium text-sm">
              写真準備中
            </span>
          </div>
        )}

        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white"
        >
          <ArrowLeft size={20} />
        </button>
      </div>

      {/* Photo thumbnails */}
      {photos.length > 1 && (
        <div className="flex gap-2 px-4 py-3 overflow-x-auto no-scrollbar">
          {photos.map((photo, i) => (
            <button
              key={photo.id}
              onClick={() => setCurrentPhotoIndex(i)}
              className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors ${
                i === currentPhotoIndex
                  ? "border-herb-primary"
                  : "border-transparent"
              }`}
            >
              <Image
                src={getPhotoUrl(photo.storage_path)}
                alt={`${plant.name} ${i + 1}`}
                width={64}
                height={64}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Plant Info */}
      <div className="px-4 py-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h1 className="text-xl font-bold">{plant.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1 bg-green-100 text-herb-primary rounded-full px-2.5 py-0.5 text-xs font-medium">
                <MapPin size={12} />
                エリア {plant.area}
              </span>
              {plant.category && (
                <span className="bg-amber-100 text-amber-600 rounded-full px-2.5 py-0.5 text-xs font-medium">
                  {plant.category}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Info cards */}
        <div className="mt-5 space-y-3">
          {infoItems.map((item) => {
            const Icon = item.icon
            return (
              <div
                key={item.label}
                className="bg-white rounded-2xl p-4 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={`w-8 h-8 rounded-lg ${item.bg} flex items-center justify-center`}
                  >
                    <Icon size={16} className={item.color} />
                  </div>
                  <h3 className="font-semibold text-sm">{item.label}</h3>
                </div>
                <p className="text-sm text-herb-text-secondary leading-relaxed pl-10">
                  {item.value}
                </p>
              </div>
            )
          })}
        </div>

        {/* 観察ノート（ハーブ園スタッフからの一言） */}
        {notes.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <MessageCircle size={16} className="text-emerald-500" />
              </div>
              <h3 className="font-semibold text-sm">観察ノート</h3>
              <span className="text-xs text-herb-text-secondary">（{notes.length}件）</span>
            </div>
            <div className="space-y-2">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="bg-white rounded-2xl p-4 shadow-sm border-l-4 border-emerald-300"
                >
                  <p className="text-sm text-herb-text leading-relaxed whitespace-pre-wrap">
                    {note.content}
                  </p>
                  <p className="text-xs text-herb-text-secondary mt-2">
                    {new Date(note.created_at).toLocaleDateString("ja-JP", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Note button */}
        <div className="mt-6 mb-4">
          <Link
            href={`/my-notes/new?plant_id=${plant.id}&plant_name=${encodeURIComponent(plant.name)}`}
            className="flex items-center justify-center gap-2 w-full h-12 bg-herb-primary text-white rounded-2xl font-semibold text-sm shadow-md active:scale-[0.98] transition-transform"
          >
            <PenLine size={18} />
            ノートを書く
          </Link>
        </div>
      </div>
    </div>
  )
}
