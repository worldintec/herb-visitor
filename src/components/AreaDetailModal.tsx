"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { X, MapPin } from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { Plant } from "@/types/database"

// ─── ミニマップ ──────────────────────────────────────────────────────────────

interface PlantPos {
  name: string
  x: number // Excel座標系
  y: number
}

function AreaMiniMap({ positions }: { positions: PlantPos[] }) {
  if (positions.length === 0) return null

  const PAD = 20
  const W = 320
  const H = 180

  const xs = positions.map((p) => p.x)
  const ys = positions.map((p) => p.y)
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
    <div className="bg-green-50/40 rounded-xl overflow-hidden">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        aria-label="エリア植物配置参考図"
      >
        <rect width={W} height={H} fill="rgba(29,158,117,0.04)" />
        {positions.map((p, i) => {
          const { x, y } = toSvg(p.x, p.y)
          return (
            <g key={i}>
              <title>{p.name}</title>
              <circle
                cx={x}
                cy={y}
                r={7}
                fill="#1D9E75"
                fillOpacity={0.75}
                stroke="white"
                strokeWidth={1.5}
              />
              <text
                x={x}
                y={y + 16}
                textAnchor="middle"
                fontSize={8}
                fill="#1D9E75"
                className="select-none pointer-events-none"
              >
                {i + 1}
              </text>
            </g>
          )
        })}
      </svg>
      <p className="text-center text-xs text-herb-text-secondary pb-1.5">
        配置参考図（番号は左リストと対応）
      </p>
    </div>
  )
}

// ─── Props ───────────────────────────────────────────────────────────────────

export interface AreaDetailModalProps {
  /** 選択中のエリアID（A〜W）。null のときモーダルは閉じる */
  areaId: string | null
  /** EXCEL_PLANTS から絞り込んだ座標データ（ミニマップ用） */
  positions: PlantPos[]
  onClose: () => void
}

// ─── コンポーネント ───────────────────────────────────────────────────────────

export function AreaDetailModal({
  areaId,
  positions,
  onClose,
}: AreaDetailModalProps) {
  const [plants, setPlants] = useState<Plant[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!areaId) {
      setPlants([])
      return
    }
    setLoading(true)
    supabase
      .from("plants")
      .select("*")
      .eq("area", areaId)
      .order("plant_no")
      .then(({ data }) => {
        setPlants((data || []) as Plant[])
        setLoading(false)
      })
  }, [areaId])

  const handleBackdrop = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose()
    },
    [onClose]
  )

  if (!areaId) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 px-0 sm:px-4"
      onClick={handleBackdrop}
    >
      <div className="bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[85vh]">

        {/* ヘッダー */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-herb-primary" />
            <h2 className="text-base font-semibold">エリア {areaId} 拡大図</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
            aria-label="閉じる"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* ボディ（2カラム） */}
        <div className="flex flex-col sm:flex-row gap-4 p-4 flex-1 overflow-hidden min-h-0">

          {/* 左：植物リスト（35%） */}
          <div className="sm:w-[35%] min-w-[130px] sm:border-r border-gray-100 sm:pr-4 overflow-y-auto max-h-[28vh] sm:max-h-full">
            {loading ? (
              <p className="text-sm text-herb-text-secondary py-4 text-center">
                読み込み中...
              </p>
            ) : plants.length === 0 ? (
              <p className="text-sm text-herb-text-secondary py-4 text-center">
                このエリアに登録済みの植物がありません
              </p>
            ) : (
              <div className="space-y-0.5">
                <p className="text-xs text-herb-text-secondary mb-2">
                  {plants.length}種 — タップで詳細
                </p>
                {plants.map((plant, idx) => (
                  <Link
                    key={plant.id}
                    href={`/areas/${areaId}`}
                    onClick={onClose}
                    className="w-full flex items-start gap-2 px-2 py-2 rounded-lg hover:bg-green-50 active:bg-green-100 transition-colors min-h-[44px]"
                  >
                    {/* 番号バッジ（ミニマップと対応） */}
                    <span className="mt-0.5 size-5 shrink-0 rounded-full bg-green-100 text-green-700 text-xs font-medium flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium leading-snug text-gray-800">
                        {plant.name}
                      </div>
                      {plant.category && (
                        <div className="text-xs text-herb-text-secondary">
                          {plant.category}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* 右：ミニマップ（65%） */}
          <div className="flex-1 min-w-0 flex flex-col justify-start">
            {positions.length > 0 ? (
              <AreaMiniMap positions={positions} />
            ) : (
              <div className="bg-gray-50 rounded-xl flex items-center justify-center h-40">
                <p className="text-xs text-herb-text-secondary">位置データなし</p>
              </div>
            )}
          </div>

        </div>

        {/* フッター：エリア詳細ページへのリンク */}
        <div className="px-4 pb-4 pt-2 flex-shrink-0 border-t border-gray-100">
          <Link
            href={`/areas/${areaId}`}
            onClick={onClose}
            className="block w-full text-center py-2.5 rounded-xl bg-herb-primary text-white text-sm font-medium active:opacity-90 transition-opacity"
          >
            エリア {areaId} の詳細ページを見る
          </Link>
        </div>

      </div>
    </div>
  )
}
