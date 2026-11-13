"use client"

import { Heart } from "lucide-react"
import { useFavorites } from "@/hooks/useFavorites"

interface Props {
  plantId: string | number
  /**
   * 同じ名前の株の id（自分も含む）。お気に入りは保存は株ごとだが、来園者は「名前」で考えるので、
   * ハートは名前でそろえる（C #81 の続き）。
   *   点灯 … 同じ名前のどれか1株がお気に入りなら点灯
   *   押す … 消えているときは表示している株を加える／点灯しているときは同じ名前の株を全部外す
   * 渡さなければ、この株だけで判定する。
   */
  groupIds?: (string | number)[]
  variant?: "light" | "dark"
  size?: number
  className?: string
}

/**
 * ハーブのお気に入りトグルボタン。画像に重ねて使用する想定のため、
 * 親要素がLinkの場合でもタップがカード遷移に伝播しないようstopPropagationする。
 */
export default function FavoriteButton({
  plantId,
  groupIds,
  variant = "light",
  size = 18,
  className = "",
}: Props) {
  const { isFavorite, toggleFavorite, removeFavorites } = useFavorites()
  const ids = groupIds && groupIds.length > 0 ? groupIds : [plantId]
  const active = ids.some((id) => isFavorite(id))

  const baseStyle =
    variant === "dark"
      ? "bg-black/30 backdrop-blur-sm"
      : "bg-white/90 backdrop-blur-sm shadow-sm"

  const iconColor = active
    ? "text-rose-500"
    : variant === "dark"
      ? "text-white"
      : "text-herb-text-secondary"

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        // 点灯しているときは同じ名前の株を全部外す（表示中の株だけ外すと、ほかの株が残って消えない）
        if (active) removeFavorites(ids)
        else toggleFavorite(plantId)
      }}
      aria-label={active ? "お気に入りから削除" : "お気に入りに追加"}
      aria-pressed={active}
      className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-transform ${baseStyle} ${className}`}
    >
      <Heart
        size={size}
        className={iconColor}
        fill={active ? "currentColor" : "none"}
        strokeWidth={2}
      />
    </button>
  )
}
