"use client"

import { useCallback, useSyncExternalStore } from "react"

const STORAGE_KEY = "herb_visitor_favorites"

// plants.id はDB上ではUUID文字列だが、型定義(Plant["id"])はnumberのままのため
// 実行時の値と乖離している。将来どちらの形式で来ても壊れないよう両対応する。
type PlantId = string | number

const EMPTY_FAVORITES: PlantId[] = []

let favoriteIds: PlantId[] = EMPTY_FAVORITES
let loaded = false
const listeners = new Set<() => void>()

function loadFromStorage(): PlantId[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter(
          (v): v is PlantId => typeof v === "number" || typeof v === "string"
        )
      : []
  } catch {
    return []
  }
}

function ensureLoaded() {
  if (loaded) return
  loaded = true
  favoriteIds = loadFromStorage()
}

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favoriteIds))
  } catch {
    // localStorage不可環境ではスキップ
  }
}

function emitChange() {
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  ensureLoaded()
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return favoriteIds
}

function getServerSnapshot() {
  return EMPTY_FAVORITES
}

function toggleFavorite(plantId: PlantId) {
  ensureLoaded()
  favoriteIds = favoriteIds.includes(plantId)
    ? favoriteIds.filter((id) => id !== plantId)
    : [...favoriteIds, plantId]
  saveToStorage()
  emitChange()
}

// 指定した株をまとめてお気に入りから外す（同じ名前の株を全部外すときに使う）
function removeFavorites(plantIds: PlantId[]) {
  ensureLoaded()
  const next = favoriteIds.filter((id) => !plantIds.includes(id))
  if (next.length === favoriteIds.length) return
  favoriteIds = next
  saveToStorage()
  emitChange()
}

/**
 * お気に入り（ハーブID）をlocalStorageで管理するフック。
 * useSyncExternalStoreによりページ内の複数コンポーネント間で状態を共有し、
 * SSR時は空配列を返すことでハイドレーションのちらつきを防ぐ。
 */
export function useFavorites() {
  const favoriteIds = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  )

  const isFavorite = useCallback(
    (plantId: PlantId) => favoriteIds.includes(plantId),
    [favoriteIds]
  )

  return { favoriteIds, isFavorite, toggleFavorite, removeFavorites }
}
