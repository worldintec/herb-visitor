"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import type { MapPlot } from "@/types/database"
import { fetchMapPlots, fetchZoneOffsets, MAP_LOAD_ERROR } from "@/lib/map-api"
import { ZONES, type Zone } from "@/lib/zones"

// ─── ZONE_AREAS（herb-gardenのmap-client.tsxと同一の調整済み座標） ─────────────
const ZONE_AREAS: Record<Zone, { x: number; y: number; w: number; h: number }> = {
  A: { x: 10,  y: 311, w: 152, h: 58  },
  B: { x: 99,  y: 240, w: 246, h: 80  },
  C: { x: 197, y: 293, w: 38,  h: 32  },
  D: { x: 176, y: 265, w: 46,  h: 30  },
  E: { x: 298, y: 320, w: 26,  h: 24  },
  F: { x: 258, y: 317, w: 205, h: 52  },
  G: { x: 368, y: 302, w: 26,  h: 32  },
  H: { x: 388, y: 292, w: 26,  h: 30  },
  I: { x: 420, y: 288, w: 26,  h: 28  },
  J: { x: 444, y: 275, w: 54,  h: 98  },
  K: { x: 453, y: 155, w: 248, h: 125 },
  L: { x: 590, y: 175, w: 32,  h: 28  },
  M: { x: 574, y: 244, w: 50,  h: 55  },
  N: { x: 535, y: 270, w: 32,  h: 80  },
  O: { x: 568, y: 333, w: 70,  h: 40  },
  P: { x: 645, y: 260, w: 38,  h: 82  },
  Q: { x: 682, y: 207, w: 75,  h: 163 },
  R: { x: 656, y: 210, w: 36,  h: 44  },
  S: { x: 680, y: 258, w: 40,  h: 44  },
  T: { x: 628, y: 38,  w: 265, h: 185 },
  U: { x: 808, y: 272, w: 115, h: 32  },
  V: { x: 733, y: 298, w: 125, h: 30  },
  W: { x: 814, y: 274, w: 102, h: 80  },
}

// 面積の大きい順に描画（小ゾーンが上に来てクリックを受け取る）
const ZONES_BY_SIZE = [...ZONES].sort(
  (a, b) =>
    ZONE_AREAS[b].w * ZONE_AREAS[b].h - ZONE_AREAS[a].w * ZONE_AREAS[a].h
)

// ─── 地図の向き ─────────────────────────────────────────────────────────────────
// 園内で立つ向き（駐車場側が下、A エリアが右）に合わせて、図面・枠・点を180度回して描く。
// 座標のデータ（map_plots・zone_offsets・ZONE_AREAS）は元の向きのまま。
// 文字（エリア名・ミント園）は回さず、回した先の位置に正立で置く。
// 元の向きに戻すときは false にする。エリア詳細の配置マップは areas/[id]/page.tsx で別に切り替える。
const ROTATE_FLOOR_MAP_180 = true

// 回転の中心の x。図面（10〜990）の真ん中。y は描くたびに決める（下の floorLayout）。
const ROTATE_CX = 500

// ミント園（別枠）の枠。元の向きの座標
const MINT_FRAME = { x: 620, y: 30, w: 282, h: 118 }

// 平面図の画像の位置。元の向きの座標
const FLOOR_IMAGE = { x: 10, y: 145, w: 980, h: 224 }

// ─── 位置の手がかり（歩道・用水路・神社・トイレ・駐車場・方角） ─────────────────
// 園の輪郭の外の余白に、エリア名より小さく薄く描く。主役はエリア。
// 位置は「回したあとの地図」で決めてあり、回転を切ると点対称の位置に移る。
//
// 回したときの並び（上から）:
//   上の帯 … 左にミント園（T エリアごと移す）、中央に「歩道」、右に方位記号
//   歩道の線
//   園の図面（元の図面を180度回したもの）
// 左右の余白に縦書きで、左は用水路・神社、右（やや下）はトイレ・駐車場。
const SIDE_TEXT_GAP = 18 // いちばん外のエリアの枠と、左右の縦書きの中心のあいだ
const SIDE_EDGE = 16 // 左右の縦書きの中心と、描画領域の端のあいだ
const GUIDE_FONT_SIZE = 20 // エリア名（28・太字）より小さく
const GUIDE_COLOR = "#8a8a82" // エリア名（#0F6E56）より薄く
const BAND_INSET = 10 // 上の帯の、外周からの余白
const WALKWAY_GAP = 12 // ミント園の下端と歩道の線のあいだ
const IMAGE_GAP = 24 // 歩道の線と図面の上端のあいだ（枠の上端に置く G・Q のエリア名とも離す）
const MIN_WALKWAY_Y = 74 // 方位記号（上の「東」まで）が収まる高さ

type Rect = { x: number; y: number; w: number; h: number }

function unionRect(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y }
}

/**
 * 地図の配置。T エリアの枠とほかのエリアの枠（どちらも点の範囲で変わる。元の向きの座標）を
 * 受け取り、回転の中心 y・ミント園を移す量・歩道の線の高さ・左右の縦書きの位置・viewBox を決める。
 *
 * 回したときは、ミント園と T の枠を合わせた範囲を左上に移し、その下に歩道の線、
 * さらにその下に図面が来るよう、回転の中心 y をずらす。
 * 左右の縦書きは、図面といちばん外のエリアの枠のさらに外に置く（枠や点と重ねない）。
 */
function floorLayout(tFrame: Rect, mainFrames: Rect[]) {
  const group = unionRect(MINT_FRAME, tFrame)
  const walkwayY = Math.max(BAND_INSET + group.h + WALKWAY_GAP, MIN_WALKWAY_Y)
  const imageTop = walkwayY + IMAGE_GAP
  // 図面の下端（元の y=369）が、回したあとに imageTop に来る中心
  const cy = (imageTop + FLOOR_IMAGE.y + FLOOR_IMAGE.h) / 2
  // ミント園＋T を回した先から、左上（図面の左端・帯の上端）へ移す量
  const rotatedGroupX = 2 * ROTATE_CX - (group.x + group.w)
  const rotatedGroupY = 2 * cy - (group.y + group.h)
  const mintShift = ROTATE_FLOOR_MAP_180
    ? { dx: FLOOR_IMAGE.x - rotatedGroupX, dy: BAND_INSET - rotatedGroupY }
    : { dx: 0, dy: 0 }
  // 回さないときは元の高さ。手がかりは点対称の位置（図面の下・左右）に収まる
  const height = ROTATE_FLOOR_MAP_180 ? imageTop + FLOOR_IMAGE.h + 12 : 480
  // 左右の縦書きの中心（回したあとの地図での x）。元の向きの右端が、回すと左端になる
  const origLeft = Math.min(FLOOR_IMAGE.x, ...mainFrames.map((f) => f.x))
  const origRight = Math.max(FLOOR_IMAGE.x + FLOOR_IMAGE.w, ...mainFrames.map((f) => f.x + f.w))
  const leftTextX = 2 * ROTATE_CX - origRight - SIDE_TEXT_GAP
  const rightTextX = 2 * ROTATE_CX - origLeft + SIDE_TEXT_GAP
  // viewBox の左右の余白。回転を切ると左右が入れ替わるので、広いほうにそろえる
  const sideMargin = Math.max(-(leftTextX - SIDE_EDGE), rightTextX + SIDE_EDGE - 1000)
  return { cy, walkwayY, imageTop, mintShift, height, leftTextX, rightTextX, sideMargin }
}

// 回したあとの位置にある長方形（左上と幅・高さ）
function placeRect(r: Rect, cy: number): Rect {
  if (!ROTATE_FLOOR_MAP_180) return r
  return { x: 2 * ROTATE_CX - (r.x + r.w), y: 2 * cy - (r.y + r.h), w: r.w, h: r.h }
}

// 「回したあとの地図」で決めた点を、回転を切ったときは点対称の位置に移す
function placePoint(x: number, y: number, cy: number): { x: number; y: number } {
  return ROTATE_FLOOR_MAP_180 ? { x, y } : { x: 2 * ROTATE_CX - x, y: 2 * cy - y }
}

// ─── エリア名ラベル ─────────────────────────────────────────────────────────────
// スマホ幅（表示幅約302px）で約8.5px。太字・濃い色・白フチで背景の図面の上でも読めるようにする。
const LABEL_FONT_SIZE = 28
// 枠の端からの余白と、左上に置くときの枠の上端からベースラインまで（余白＋大文字の高さ約20）
const LABEL_INSET = 4
const LABEL_TOP_BASELINE = LABEL_INSET + 20

// 枠の左下に置くエリア（ほかは左上）。2026年10月の実データの枠で計算すると、
// 左上のままでは Q が R と、G が H とラベルが重なったため。
// 地図を180度回したときは、この置き方を回した先（ほかは右下、G・Q は右上）に置く。
// 枠どうしの位置関係ごと回るので、元の向きで調整した重なりの避け方がそのまま効く。
const LABEL_AT_BOTTOM: ReadonlySet<Zone> = new Set<Zone>(["G", "Q"])

// ─── 種別カラー ─────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  herb:      "#1D9E75",
  flower:    "#D4537E",
  vegetable: "#639922",
  tree:      "#185FA5",
  other:     "#888780",
}

const TYPE_LABELS: Record<string, string> = {
  herb:      "ハーブ",
  flower:    "花",
  vegetable: "野菜",
  tree:      "樹木",
  other:     "その他",
}

// ─── アプリ内ズーム・パン ───────────────────────────────────────────────────────
// ブラウザのネイティブピンチズームに依存すると、ページ遷移後もズーム状態が
// 残ってしまい解除できない（iOS Safariはアクセシビリティのためmaximum-scale/
// user-scalable指定を無視するためJSからの解除が不可能）。そのためマップ自体に
// transform: scaleでズーム・パンを実装し、ネイティブズームはtouch-action: noneで止める。

const MIN_SCALE = 1
const MAX_SCALE = 4

interface MapTransform {
  scale: number
  x: number
  y: number
}

function clampNumber(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

function getMidpoint(pts: { x: number; y: number }[]): { x: number; y: number } {
  const x = pts.reduce((s, p) => s + p.x, 0) / pts.length
  const y = pts.reduce((s, p) => s + p.y, 0) / pts.length
  return { x, y }
}

function getDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

interface ZoomGesture {
  mode: "pan" | "pinch"
  startTransform: MapTransform
  startMidpoint: { x: number; y: number }
  startDist: number
  moved: boolean
}

// ─── コンポーネント ─────────────────────────────────────────────────────────────

export default function HerbGardenFloorMap() {
  const router = useRouter()
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState<MapTransform>({ scale: 1, x: 0, y: 0 })
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map())
  const gestureRef = useRef<ZoomGesture | null>(null)
  const suppressClickRef = useRef(false)
  const [plots, setPlots] = useState<MapPlot[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [hoveredZone, setHoveredZone] = useState<Zone | null>(null)
  const [hoveredPlot, setHoveredPlot] = useState<string | null>(null)
  const [zoneOffsets, setZoneOffsets] = useState<Record<Zone, { dx: number; dy: number }>>(
    () => Object.fromEntries(ZONES.map(z => [z, { dx: 0, dy: 0 }])) as Record<Zone, { dx: number; dy: number }>
  )

  useEffect(() => {
    // map_plots / zone_offsets は RLS で anon を遮断するため API 経由で読む。
    // 失敗を握りつぶすと、プロットが無い真っさらなマップを正常な表示として
    // 見せてしまうため、エラーを表示する。
    Promise.all([
      fetchMapPlots().catch((e) => {
        console.error("map_plots 取得失敗", e)
        return null
      }),
      fetchZoneOffsets().catch((e) => {
        console.error("zone_offsets 取得失敗", e)
        return null
      }),
    ]).then(([plotsRes, offsetsRes]) => {
      if (plotsRes === null || offsetsRes === null) {
        setLoadError(MAP_LOAD_ERROR)
        setLoading(false)
        return
      }
      setLoadError(null)
      setPlots(plotsRes)
      setZoneOffsets(prev => {
        const next = { ...prev }
        offsetsRes.forEach(row => {
          if ((ZONES as readonly string[]).includes(row.zone)) {
            next[row.zone as Zone] = { dx: row.dx, dy: row.dy }
          }
        })
        return next
      })
      setLoading(false)
    })
  }, [])

  // ── ゾーン別プロット境界ボックス（herb-gardenと同一ロジック） ───────────────
  const PLOT_RADIUS = 6
  const PLOT_PADDING = 10

  const zonePlotBounds = useMemo(() => {
    const bounds: Partial<Record<Zone, { minX: number; maxX: number; minY: number; maxY: number }>> = {}

    const expand = (zone: Zone, x: number, y: number) => {
      const b = bounds[zone]
      if (!b) {
        bounds[zone] = { minX: x, maxX: x, minY: y, maxY: y }
      } else {
        b.minX = Math.min(b.minX, x)
        b.maxX = Math.max(b.maxX, x)
        b.minY = Math.min(b.minY, y)
        b.maxY = Math.max(b.maxY, y)
      }
    }

    plots.forEach((plot) => {
      const zone = plot.zone as Zone
      if (!ZONES.includes(zone)) return
      expand(zone, plot.x, plot.y)
    })

    return bounds
  }, [plots])

  // ゾーン枠の位置。プロットが存在する場合はその上下左右範囲に枠を合わせる
  function zoneFrame(zone: Zone): { x: number; y: number; w: number; h: number } {
    const a = ZONE_AREAS[zone]
    const off = zoneOffsets[zone]
    const pb = zonePlotBounds[zone]
    const x = pb ? pb.minX - PLOT_RADIUS - PLOT_PADDING : a.x + off.dx
    const w = pb ? (pb.maxX + PLOT_RADIUS + PLOT_PADDING) - x : a.w
    const y = pb ? pb.minY - PLOT_RADIUS - PLOT_PADDING : a.y + off.dy
    const h = pb ? (pb.maxY + PLOT_RADIUS + PLOT_PADDING) - y : a.h
    return { x, y, w, h }
  }

  // ゾーン枠（ハイライト背景とクリック受付）。座標は元の向き
  function renderZone(zone: Zone) {
    const { x: ax, y: ay, w: aw, h: ah } = zoneFrame(zone)
    const isHovered = hoveredZone === zone
    return (
      <g key={zone}>
        {/* ハイライト背景 */}
        <rect
          x={ax} y={ay} width={aw} height={ah}
          rx={3}
          fill="#1D9E75"
          fillOpacity={isHovered ? 0.18 : 0}
          className="pointer-events-none transition-colors duration-150"
        />
        {/* ゾーン枠（クリック受付） */}
        <rect
          x={ax} y={ay} width={aw} height={ah}
          rx={3}
          fill="transparent"
          stroke="#1D9E75"
          strokeWidth={isHovered ? 1.5 : 0.8}
          strokeDasharray="4,3"
          strokeOpacity={isHovered ? 1 : 0.5}
          style={{ cursor: "pointer" }}
          onMouseEnter={() => setHoveredZone(zone)}
          onMouseLeave={() => setHoveredZone(null)}
          onClick={() => {
            if (suppressClickRef.current) {
              suppressClickRef.current = false
              return
            }
            router.push(`/areas/${zone}`)
          }}
        />
      </g>
    )
  }

  // プロットマーカー。座標は元の向き
  function renderPlot(plot: MapPlot) {
    const color = TYPE_COLORS[plot.type] ?? "#888780"
    const isHovered = hoveredPlot === plot.id
    return (
      <g
        key={plot.id}
        style={{ cursor: "pointer" }}
        onMouseEnter={() => setHoveredPlot(plot.id)}
        onMouseLeave={() => setHoveredPlot(null)}
        onClick={() => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false
            return
          }
          router.push(`/areas/${plot.zone}`)
        }}
      >
        <title>{plot.name}（エリア {plot.zone}）</title>
        {isHovered && (
          <circle
            cx={plot.x} cy={plot.y} r={14}
            fill={color}
            fillOpacity={0.18}
            className="pointer-events-none"
          />
        )}
        <circle
          cx={plot.x} cy={plot.y}
          r={isHovered ? 8 : 6}
          fill={color}
          stroke="white"
          strokeWidth={1.5}
          style={{ transition: "r 0.1s" }}
        />
      </g>
    )
  }

  // ── ズーム・パンのジェスチャー処理 ──────────────────────────────────────────
  function localPoint(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const rect = mapContainerRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function clampTransform(t: MapTransform): MapTransform {
    const el = mapContainerRef.current
    if (!el) return t
    const { width, height } = el.getBoundingClientRect()
    const scale = clampNumber(t.scale, MIN_SCALE, MAX_SCALE)
    if (scale === MIN_SCALE) return { scale, x: 0, y: 0 }
    const minX = width - width * scale
    const minY = height - height * scale
    return {
      scale,
      x: clampNumber(t.x, minX, 0),
      y: clampNumber(t.y, minY, 0),
    }
  }

  function zoomAt(point: { x: number; y: number }, prev: MapTransform, newScale: number): MapTransform {
    const contentX = (point.x - prev.x) / prev.scale
    const contentY = (point.y - prev.y) / prev.scale
    return clampTransform({
      scale: newScale,
      x: point.x - contentX * newScale,
      y: point.y - contentY * newScale,
    })
  }

  function handlePointerDown(e: React.PointerEvent) {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    pointersRef.current.set(e.pointerId, localPoint(e))
    const pts = Array.from(pointersRef.current.values())
    if (pts.length === 1) {
      gestureRef.current = {
        mode: "pan",
        startTransform: transform,
        startMidpoint: pts[0],
        startDist: 0,
        moved: false,
      }
    } else if (pts.length === 2) {
      gestureRef.current = {
        mode: "pinch",
        startTransform: transform,
        startMidpoint: getMidpoint(pts),
        startDist: getDistance(pts[0], pts[1]),
        moved: false,
      }
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!pointersRef.current.has(e.pointerId)) return
    pointersRef.current.set(e.pointerId, localPoint(e))
    const gesture = gestureRef.current
    if (!gesture) return
    const pts = Array.from(pointersRef.current.values())

    if (gesture.mode === "pan" && pts.length === 1) {
      const dx = pts[0].x - gesture.startMidpoint.x
      const dy = pts[0].y - gesture.startMidpoint.y
      if (Math.hypot(dx, dy) > 4) gesture.moved = true
      if (gesture.startTransform.scale > MIN_SCALE) {
        e.preventDefault()
        setTransform(
          clampTransform({
            scale: gesture.startTransform.scale,
            x: gesture.startTransform.x + dx,
            y: gesture.startTransform.y + dy,
          })
        )
      }
    } else if (gesture.mode === "pinch" && pts.length === 2) {
      e.preventDefault()
      const dist = getDistance(pts[0], pts[1])
      const mid = getMidpoint(pts)
      const newScale = clampNumber(
        gesture.startTransform.scale * (dist / gesture.startDist),
        MIN_SCALE,
        MAX_SCALE
      )
      gesture.moved = true
      const contentX = (gesture.startMidpoint.x - gesture.startTransform.x) / gesture.startTransform.scale
      const contentY = (gesture.startMidpoint.y - gesture.startTransform.y) / gesture.startTransform.scale
      setTransform(
        clampTransform({
          scale: newScale,
          x: mid.x - contentX * newScale,
          y: mid.y - contentY * newScale,
        })
      )
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    pointersRef.current.delete(e.pointerId)
    if (gestureRef.current?.moved) {
      suppressClickRef.current = true
    }
    if (pointersRef.current.size === 0) {
      gestureRef.current = null
    } else if (pointersRef.current.size === 1) {
      // 2本指→1本指に減ったらパンを再開
      const [pt] = Array.from(pointersRef.current.values())
      gestureRef.current = {
        mode: "pan",
        startTransform: transform,
        startMidpoint: pt,
        startDist: 0,
        moved: gestureRef.current?.moved ?? false,
      }
    }
  }

  function handleDoubleClick(e: React.MouseEvent) {
    const point = localPoint(e)
    setTransform((prev) =>
      prev.scale > MIN_SCALE
        ? { scale: MIN_SCALE, x: 0, y: 0 }
        : zoomAt(point, prev, 2.2)
    )
  }

  function handleWheel(e: React.WheelEvent) {
    if (!e.ctrlKey) return
    e.preventDefault()
    const point = localPoint(e)
    setTransform((prev) =>
      zoomAt(point, prev, clampNumber(prev.scale * (1 - e.deltaY * 0.01), MIN_SCALE, MAX_SCALE))
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-gray-400">
        読み込み中...
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-center py-12 px-4 text-sm text-gray-500 text-center">
        {loadError}
      </div>
    )
  }

  const layout = floorLayout(
    zoneFrame("T"),
    ZONES.filter((zone) => zone !== "T").map(zoneFrame),
  )

  // ミント園と T エリアの位置を、回した先から左上へ移す
  const shiftMint = (r: Rect): Rect => ({
    ...r,
    x: r.x + layout.mintShift.dx,
    y: r.y + layout.mintShift.dy,
  })

  // 位置の手がかりの文字。中心の座標を「回したあとの地図」で決める
  const imageMidY = layout.imageTop + FLOOR_IMAGE.h / 2
  const guideLabels = [
    { text: "歩道", ...placePoint(ROTATE_CX, layout.walkwayY - 14, layout.cy), vertical: false },
    { text: "用水路", ...placePoint(layout.leftTextX, imageMidY - 52, layout.cy), vertical: true },
    { text: "神社", ...placePoint(layout.leftTextX, imageMidY + 34, layout.cy), vertical: true },
    { text: "トイレ", ...placePoint(layout.rightTextX, imageMidY + 10, layout.cy), vertical: true },
    { text: "駐車場", ...placePoint(layout.rightTextX, imageMidY + 82, layout.cy), vertical: true },
  ]

  return (
    <div className="space-y-2">
      {/* マップSVG（アプリ内ズーム・パン対応） */}
      <div
        ref={mapContainerRef}
        className="relative bg-white rounded-xl overflow-hidden border border-gray-100 select-none"
        style={{ touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
      >
        {transform.scale > MIN_SCALE && (
          <button
            onClick={() => setTransform({ scale: MIN_SCALE, x: 0, y: 0 })}
            className="absolute top-2 right-2 z-10 bg-white/90 backdrop-blur rounded-full px-3 py-1.5 text-xs font-medium text-herb-primary shadow border border-gray-200"
          >
            全体表示に戻す
          </button>
        )}
        <svg
          viewBox={`${-layout.sideMargin} 0 ${1000 + layout.sideMargin * 2} ${layout.height}`}
          className="w-full h-auto block"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: "0 0",
          }}
        >
          <defs>
            <pattern
              id="floorgrid"
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 20 0 L 0 0 0 20"
                fill="none"
                stroke="rgba(0,0,0,0.05)"
                strokeWidth="0.4"
              />
            </pattern>
          </defs>

          {/* グリッド背景（向きに関係ない模様なので回さない） */}
          <rect x={-layout.sideMargin} width={1000 + layout.sideMargin * 2} height={layout.height} fill="url(#floorgrid)" />

          {/* ここから閉じタグまでが地図の図形（T エリアとミント園を除く）。文字はこの外に正立で描く */}
          <g transform={ROTATE_FLOOR_MAP_180 ? `rotate(180 ${ROTATE_CX} ${layout.cy})` : undefined}>
            {/* 平面図背景画像 */}
            <image
              href="/ハーブ園図面加工後.png"
              x={FLOOR_IMAGE.x}
              y={FLOOR_IMAGE.y}
              width={FLOOR_IMAGE.w}
              height={FLOOR_IMAGE.h}
              preserveAspectRatio="none"
              opacity={0.9}
              className="pointer-events-none"
            />

            {/* ゾーン（面積降順で描画） */}
            {ZONES_BY_SIZE.filter((zone) => zone !== "T").map(renderZone)}

            {/* プロットマーカー */}
            {plots.filter((plot) => plot.zone !== "T").map(renderPlot)}
          </g>

          {/* ミント園と T エリア。回したときは、回した先から左上へ移す */}
          <g
            transform={
              ROTATE_FLOOR_MAP_180
                ? `translate(${layout.mintShift.dx} ${layout.mintShift.dy}) rotate(180 ${ROTATE_CX} ${layout.cy})`
                : undefined
            }
          >
            {/* ミント園（別枠）枠線 */}
            <rect
              x={MINT_FRAME.x} y={MINT_FRAME.y} width={MINT_FRAME.w} height={MINT_FRAME.h}
              rx={4}
              fill="rgba(29,158,117,0.04)"
              stroke="rgba(29,158,117,0.3)"
              strokeWidth={0.8}
              strokeDasharray="4,3"
              className="pointer-events-none"
            />
            {renderZone("T")}
            {plots.filter((plot) => plot.zone === "T").map(renderPlot)}
          </g>

          {/* ミント園のラベル。枠の上端の中央に置く */}
          {(() => {
            const m = shiftMint(placeRect(MINT_FRAME, layout.cy))
            return (
              <text
                x={m.x + m.w / 2} y={m.y + 14}
                textAnchor="middle"
                fontSize={9}
                fill="#5f5e5a"
                fillOpacity={0.6}
                className="pointer-events-none select-none"
              >
                ミント園（別枠）
              </text>
            )
          })()}

          {/* 位置の手がかり（園の輪郭の外の余白。文字は正立） */}
          <g className="pointer-events-none select-none">
            {/* 歩道：図面の上端に沿った細い線 */}
            {(() => {
              const a = placePoint(FLOOR_IMAGE.x, layout.walkwayY, layout.cy)
              const b = placePoint(FLOOR_IMAGE.x + FLOOR_IMAGE.w, layout.walkwayY, layout.cy)
              return (
                <line
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={GUIDE_COLOR}
                  strokeOpacity={0.6}
                  strokeWidth={1.2}
                  strokeDasharray="10,6"
                />
              )
            })()}
            {guideLabels.map((g) => (
              <GuideText key={g.text} text={g.text} x={g.x} y={g.y} vertical={g.vertical} />
            ))}
            {/* 方位記号。回したときは 左＝北・上＝東・右＝南・下＝西 */}
            {(() => {
              const c = placePoint(1000 - 50, layout.walkwayY - 36, layout.cy)
              const k = ROTATE_FLOOR_MAP_180 ? 1 : -1
              const ARM = 12
              const AT = 25
              return (
                <g>
                  <line x1={c.x - ARM} y1={c.y} x2={c.x + ARM} y2={c.y} stroke={GUIDE_COLOR} strokeWidth={1.2} />
                  <line x1={c.x} y1={c.y - ARM} x2={c.x} y2={c.y + ARM} stroke={GUIDE_COLOR} strokeWidth={1.2} />
                  <GuideText text="北" x={c.x - AT * k} y={c.y} size={16} />
                  <GuideText text="東" x={c.x} y={c.y - AT * k} size={16} />
                  <GuideText text="南" x={c.x + AT * k} y={c.y} size={16} />
                  <GuideText text="西" x={c.x} y={c.y + AT * k} size={16} />
                </g>
              )
            })()}
          </g>

          {/* ゾーンラベル（マーカーに隠れないよう最後に描く）。回したあとの枠を基準に置く */}
          {ZONES.map((zone) => {
            const placed = placeRect(zoneFrame(zone), layout.cy)
            const f = zone === "T" ? shiftMint(placed) : placed
            // 回すと上下・左右が入れ替わる
            const atBottom = LABEL_AT_BOTTOM.has(zone) !== ROTATE_FLOOR_MAP_180
            const y = atBottom
              ? f.y + f.h - LABEL_INSET
              : f.y + LABEL_TOP_BASELINE
            return (
              <text
                key={zone}
                x={ROTATE_FLOOR_MAP_180 ? f.x + f.w - LABEL_INSET : f.x + LABEL_INSET}
                y={y}
                textAnchor={ROTATE_FLOOR_MAP_180 ? "end" : "start"}
                fontSize={LABEL_FONT_SIZE}
                fontWeight={700}
                fill="#0F6E56"
                fillOpacity={1}
                stroke="#ffffff"
                strokeWidth={3}
                paintOrder="stroke"
                className="pointer-events-none select-none"
              >
                {zone}
              </text>
            )
          })}
        </svg>
      </div>

      {/* 凡例 */}
      {plots.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-1">
          {Object.entries(TYPE_LABELS).map(([type, label]) => {
            const count = plots.filter((p) => p.type === type).length
            if (count === 0) return null
            return (
              <div key={type} className="flex items-center gap-1.5">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: TYPE_COLORS[type] }}
                />
                <span className="text-xs text-gray-500">
                  {label} {count}
                </span>
              </div>
            )
          })}
        </div>
      )}


    </div>
  )
}

// 位置の手がかりの文字。(x, y) は文字の中心。縦書きは1文字ずつ上から並べる
function GuideText({
  text,
  x,
  y,
  vertical = false,
  size = GUIDE_FONT_SIZE,
}: {
  text: string
  x: number
  y: number
  vertical?: boolean
  size?: number
}) {
  const chars = vertical ? Array.from(text) : [text]
  const step = size * 1.05
  const top = y - (step * (chars.length - 1)) / 2
  return (
    <>
      {chars.map((c, i) => (
        <text
          key={i}
          x={x}
          y={top + step * i}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={size}
          fill={GUIDE_COLOR}
          stroke="#ffffff"
          strokeWidth={3}
          paintOrder="stroke"
        >
          {c}
        </text>
      ))}
    </>
  )
}
