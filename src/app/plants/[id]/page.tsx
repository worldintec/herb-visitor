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
  Lock,
  UserPlus,
} from "lucide-react"
import { fetchPlant, PLANTS_LOAD_ERROR } from "@/lib/plants-api"
import type { Plant, PlantPhoto } from "@/types/database"
import { sortPhotosByPriority } from "@/lib/photo-utils"
import FavoriteButton from "@/components/favorite-button"

interface PlantNote {
  id: string
  content: string
  author: string | null
  created_at: string
}

/**
 * 未ログインのときに /api/plants/public から受け取る内容。
 * 香り・利用法・育て方のポイントは見出し（lockedSections）だけが来る。
 * 本文はサーバーから送られていないので、画面で隠しているのではなく存在しない。
 */
interface TeaserPlant {
  id: string
  name: string
  category: string | null
  photoUrl: string | null
  teaser: string
  teaserTruncated: boolean
  teaserLabel: string
  caution: string | null
  lockedSections: string[]
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
  const [teaser, setTeaser] = useState<TeaserPlant | null>(null)
  const [photos, setPhotos] = useState<PlantPhoto[]>([])
  const [notes, setNotes] = useState<PlantNote[]>([])
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      // この画面だけは未ログインでも開ける（園内のQRコードの行き先）。
      // 先にログイン状態を確かめ、未ログインならティザー公開APIに切り替える。
      // 判定できなかったときは会員として扱い、従来の流れに進む。
      const loggedIn = await fetch("/api/auth/me")
        .then((r) => (r.ok ? r.json() : { user: null }))
        .then(({ user }) => !!user)
        .catch(() => true)

      if (!loggedIn) {
        const res = await fetch(
          `/api/plants/public?id=${encodeURIComponent(id)}`
        ).catch(() => null)
        if (res?.ok) {
          const json = await res.json()
          setTeaser(json.plant as TeaserPlant)
        } else if (res?.status !== 404) {
          // 404（見つからない）以外は取得失敗として扱い、文言を分ける
          setLoadError(PLANTS_LOAD_ERROR)
        }
        setLoading(false)
        return
      }

      // plants は RLS で anon を遮断しているため API 経由で読む。
      // 「見つからない」と「取得に失敗した」を区別する。
      const result = await fetchPlant(id)
      setLoadError(result.status === "error" ? PLANTS_LOAD_ERROR : null)
      const plantData = result.status === "ok" ? result.plant : null

      if (plantData) {
        setPlant(plantData)

        // plant_photos / plant_notes は RLS で anon を遮断しているため API 経由で読む
        const name = encodeURIComponent(plantData.name)
        const [photoRes, noteRes] = await Promise.all([
          fetch(`/api/plant-photos?plantName=${name}`)
            .then((r) => (r.ok ? r.json() : { photos: [] }))
            .catch(() => ({ photos: [] })),
          // インプット記録の観察ノートを取得（content が空のものは除く）
          fetch(`/api/plant-notes?plantName=${name}&nonEmpty=1`)
            .then((r) => (r.ok ? r.json() : { notes: [] }))
            .catch(() => ({ notes: [] })),
        ])

        if (photoRes.photos) setPhotos(sortPhotosByPriority(photoRes.photos))
        if (noteRes.notes) setNotes(noteRes.notes as PlantNote[])
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

  // --- 未ログインのティザー表示 ---
  if (teaser) {
    const backTo = `/plants/${teaser.id}`
    return (
      <div className="min-h-dvh">
        <div className="relative aspect-square bg-green-100">
          {teaser.photoUrl ? (
            <Image
              src={teaser.photoUrl}
              alt={teaser.name}
              fill
              className="object-cover"
              sizes="(max-width: 512px) 100vw, 512px"
              priority
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-green-50">
              <Leaf size={64} className="text-green-300 mb-2" />
              <span className="text-green-500/70 font-medium text-sm">
                写真準備中
              </span>
            </div>
          )}
        </div>

        <div className="px-4 py-4">
          {/* QRコードから直接来た人は、ここが何のページか分からないため園名を出す。
              ログイン済みの表示には足さない（アプリ内から来ているので不要）。 */}
          <p className="text-xs text-herb-text-secondary">見沼氷川公園 ハーブ園</p>
          <h1 className="text-xl font-bold mt-0.5">{teaser.name}</h1>
          {teaser.category && (
            <span className="inline-block mt-2 bg-amber-100 text-amber-600 rounded-sm px-2.5 py-0.5 text-xs font-medium">
              {teaser.category}
            </span>
          )}

          {teaser.teaser && (
            <div className="mt-5 bg-white rounded-2xl p-4 shadow-sm">
              <h3 className="font-semibold text-sm mb-2">{teaser.teaserLabel}</h3>
              <p className="text-sm text-herb-text-secondary leading-relaxed">
                {teaser.teaser}
              </p>
              {teaser.teaserTruncated && (
                <p className="text-xs text-herb-text-secondary/70 mt-2">
                  続きは会員登録後に読めます
                </p>
              )}
            </div>
          )}

          {/* 注意事項は安全に関わるため、未ログインでも全文を出す */}
          {teaser.caution && (
            <div className="mt-3 bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
                  <AlertTriangle size={16} className="text-rose-500" />
                </div>
                <h3 className="font-semibold text-sm">注意事項</h3>
              </div>
              <p className="text-sm text-herb-text-secondary leading-relaxed pl-10">
                {teaser.caution}
              </p>
            </div>
          )}

          {/* 見出しだけを並べる。本文はサーバーから送られていない */}
          {teaser.lockedSections.length > 0 && (
            <div className="mt-3 bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-xs text-herb-text-secondary mb-3">
                会員登録すると、このハーブについて次の説明が読めます。
              </p>
              <ul className="space-y-2">
                {teaser.lockedSections.map((label) => (
                  <li
                    key={label}
                    className="flex items-center gap-2 text-sm text-herb-text-secondary"
                  >
                    <Lock size={14} className="text-herb-text-secondary/60 shrink-0" />
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 mb-4">
            {/* 登録・ログインのあとこのページに戻す。受け取る側は safeRedirect() で検証する */}
            <Link
              href={`/register?redirect=${encodeURIComponent(backTo)}`}
              className="flex items-center justify-center gap-2 w-full h-12 bg-herb-primary text-white rounded-2xl font-semibold text-sm shadow-md active:scale-[0.98] transition-transform"
            >
              <UserPlus size={18} />
              会員登録して続きを読む
            </Link>
            <p className="text-center text-xs text-herb-text-secondary mt-3">
              メールアドレスは不要です。IDとパスワードだけで登録できます。
            </p>
            <p className="text-center text-xs text-herb-text-secondary mt-2">
              すでに会員の方は{" "}
              <Link
                href={`/login?redirect=${encodeURIComponent(backTo)}`}
                className="text-herb-primary font-medium"
              >
                ログイン
              </Link>
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!plant) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-4">
        <Leaf size={48} className="text-green-200 mb-4" />
        <p className="text-herb-text-secondary mb-4 text-center">
          {loadError ?? "この植物の情報が見つかりませんでした"}
        </p>
        {/* QRコードから直接開くと履歴が無く router.back() が無反応になるため、
            トップへのリンクにする（未ログインのときは proxy がログイン画面へ回す）。 */}
        <Link href="/" className="text-herb-primary font-medium text-sm">
          トップへ
        </Link>
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

        {/* Favorite button */}
        <FavoriteButton
          plantId={plant.id}
          variant="dark"
          size={20}
          className="absolute top-4 right-4"
        />
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
              <span className="inline-flex items-center gap-1 bg-green-100 text-herb-primary rounded-sm px-2.5 py-0.5 text-xs font-medium">
                <MapPin size={12} />
                エリア {plant.area}
              </span>
              {plant.category && (
                <span className="bg-amber-100 text-amber-600 rounded-sm px-2.5 py-0.5 text-xs font-medium">
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
