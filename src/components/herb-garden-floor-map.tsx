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
// 文字（エリア名・手がかり）は回さず、回した先の位置に正立で置く。
// 元の向きに戻すときは false にする。エリア詳細の配置マップは areas/[id]/page.tsx で別に切り替える。
const ROTATE_FLOOR_MAP_180 = true

// 平面図の画像の位置。元の向きの座標
const FLOOR_IMAGE = { x: 10, y: 145, w: 980, h: 224 }

// ─── 回したあとの地図の並び ─────────────────────────────────────────────────────
// 上から: 上の帯（中央に「歩道」、右上に方位記号）→ 歩道の線 → 園の図面。
// 図面の左下（輪郭の外の空き）に、T（ミント園）の引き出し図を置く。
// 手がかりや引き出し図の位置は、すべて「回したあとの地図」の座標で決める。
// 回転を切ったときは、決めた位置を点対称に移して描く（toShown）。
const WALKWAY_Y = 74 // 歩道の線の高さ。上の帯に方位記号（上の「東」まで）が収まる
const IMAGE_TOP = WALKWAY_Y + 24 // 図面の上端（枠の上端に置く G・Q のエリア名とも離す）
const ROTATE_CX = 500 // 回転の中心。図面（10〜990）の真ん中
const ROTATE_CY = (IMAGE_TOP + FLOOR_IMAGE.y + FLOOR_IMAGE.h) / 2 // 図面の下端（元の y=369）が IMAGE_TOP に来る

// 回したあとの図面で、左下（x=10〜262）の輪郭がいちばん下まで来る位置（図面の上端から）。
// 2026年11月に図面の画像（public/ハーブ園図面加工後.png）の線から測った値。
// 引き出し図はこれより下に置き、園の輪郭にかぶせない。
const OUTLINE_BOTTOM_LEFT = 132

// ─── 位置の手がかり（歩道・用水路・神社・トイレ・駐車場・方角） ─────────────────
// 園の輪郭の外の余白に、エリア名より小さく薄く描く。主役はエリア。
// 用水路・神社とトイレ・駐車場は園に接していないので、矢印で「その方向の先」を示す。
const GUIDE_FONT_SIZE = 20 // エリア名（28・太字）より小さく
const GUIDE_COLOR = "#8a8a82" // エリア名（#0F6E56）より薄く
const SIDE_BLOCK_HALF = 16 // 左右の手がかり（縦書き＋短い矢印）の幅の半分。地図を小さくしすぎないよう細くする
const SIDE_GAP = 10 // いちばん外のエリアの枠と、左右の手がかりのあいだ
const SIDE_EDGE = 8 // 左右の手がかりと、描画領域の端のあいだ

// ─── T（ミント園）の区画と引き出し図 ───────────────────────────────────────────
// ミント園の園内での位置は map_plots にも zone_offsets にも無い（T は最初から別枠で描く作り）。
// 元の平面図ではミント園は網目の細長い四角で描かれ、そこから拡大図へ引き出し線が伸びている。
// その四角を水色で塗り分け、左下の引き出し図と細い実線でつなぐ。
//
// 位置は元の平面図（PDF）から割合で測った値（2026年11月）。背景の画像（加工後）からは
// 網目が消えているため、画像からは読み取れない。現地で確かめて動かすときは、この1行を直す。
//   cx, cy … 回したあとの図面での中心（図面の左端・上端からの割合）
//   w, h   … 長さと幅（図の単位）　angle … 傾き（度。時計回りが正）
const MINT_AREA = { cx: 0.278, cy: 0.516, w: 42, h: 10, angle: 25 }
const MINT_FILL = "rgba(56,189,248,0.22)" // 薄い水色。点（緑・ピンク・紺）と紛れない色
const MINT_STROKE = "#0ea5e9" // 塗りより少し濃い水色の輪郭（樹木の点の紺とは明るさで分ける）
const INSET_X = FLOOR_IMAGE.x + 4 // 引き出し図の左端
const INSET_MAX_W = 248 // 中身（T の枠）の幅の上限。左下の空きに収める
const INSET_MAX_H = 150 // 中身の高さの上限（図面の下にはみ出してよい）
const INSET_PAD = 8
const INSET_HEADER = 26 // 見出し「T ミント園（拡大図）」の行
const INSET_COLOR = "#4f6f63"
// 引き出し線と区画の輪郭の太さは画面上の px で決める（vector-effect="non-scaling-stroke"）。
// 図の単位で決めると、幅390px（約0.26〜0.3倍）では 1px に届かず線が消えかかるため
const LEADER_WIDTH_PX = 1.5

type Rect = { x: number; y: number; w: number; h: number }
type Point = { x: number; y: number }

// 元の向きの座標を、回したあとの座標へ（180度回転は自分自身が逆変換）
function rotPoint(p: Point): Point {
  return { x: 2 * ROTATE_CX - p.x, y: 2 * ROTATE_CY - p.y }
}
function rotRect(r: Rect): Rect {
  return { x: 2 * ROTATE_CX - (r.x + r.w), y: 2 * ROTATE_CY - (r.y + r.h), w: r.w, h: r.h }
}
// 「回したあとの地図」で決めた位置を、実際に描く位置へ。回転を切ったときは点対称に移す
function toShown(p: Point): Point {
  return ROTATE_FLOOR_MAP_180 ? p : rotPoint(p)
}
function toShownRect(r: Rect): Rect {
  return ROTATE_FLOOR_MAP_180 ? r : rotRect(r)
}

function rectsHit(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

// 線分が長方形を横切るか（Liang–Barsky）
function segmentHitsRect(p: Point, q: Point, r: Rect): boolean {
  let t0 = 0
  let t1 = 1
  const dx = q.x - p.x
  const dy = q.y - p.y
  const checks: [number, number][] = [
    [-dx, p.x - r.x],
    [dx, r.x + r.w - p.x],
    [-dy, p.y - r.y],
    [dy, r.y + r.h - p.y],
  ]
  for (const [pp, qq] of checks) {
    if (pp === 0) {
      if (qq < 0) return false
    } else {
      const t = qq / pp
      if (pp < 0) t0 = Math.max(t0, t)
      else t1 = Math.min(t1, t)
      if (t0 > t1) return false
    }
  }
  return true
}

// エリア名の文字の範囲（回したあとの地図での置き方。描画の規則と同じ）
function rotatedLabelBox(zone: Zone, f: Rect): Rect {
  const atBottom = !LABEL_AT_BOTTOM.has(zone)
  const baseline = atBottom ? f.y + f.h - LABEL_INSET : f.y + LABEL_TOP_BASELINE
  const right = f.x + f.w - LABEL_INSET + (ROTATED_LABEL_NUDGE_X[zone] ?? 0)
  return { x: right - 22, y: baseline - 22, w: 22, h: 24 }
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

// 回したときだけ、横にずらすエリア名（負は左）。C と D は文字のあいだが約1しかなく、
// 地図の表示倍率によって文字幅の測れ方が変わると触れてしまうため、C を少し離す。
const ROTATED_LABEL_NUDGE_X: Partial<Record<Zone, number>> = { C: -3 }

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

  // ── 回したあとの地図での配置（手がかり・引き出し図）──────────────────────
  // 当たり判定に使う、T 以外のエリアの枠・点・エリア名（回したあとの座標）
  const mainZones = ZONES.filter((zone) => zone !== "T")
  const rotFrames = new Map(mainZones.map((zone) => [zone, rotRect(zoneFrame(zone))] as const))
  const obstacleFrames = [...rotFrames.values()]
  const obstacleLabels = mainZones.map((zone) => rotatedLabelBox(zone, rotFrames.get(zone)!))
  const obstacleDots = plots
    .filter((plot) => plot.zone !== "T")
    .map((plot) => {
      const p = rotPoint({ x: plot.x, y: plot.y })
      return { x: p.x - PLOT_RADIUS, y: p.y - PLOT_RADIUS, w: PLOT_RADIUS * 2, h: PLOT_RADIUS * 2 }
    })
  const obstacles = [...obstacleFrames, ...obstacleLabels, ...obstacleDots]

  // 左右の手がかりは、図面といちばん外のエリアの枠のさらに外に置く
  const leftMost = Math.min(FLOOR_IMAGE.x, ...obstacleFrames.map((f) => f.x))
  const rightMost = Math.max(FLOOR_IMAGE.x + FLOOR_IMAGE.w, ...obstacleFrames.map((f) => f.x + f.w))
  const leftBlockX = leftMost - SIDE_GAP - SIDE_BLOCK_HALF
  const rightBlockX = rightMost + SIDE_GAP + SIDE_BLOCK_HALF
  // 回転を切ると左右が入れ替わるので、広いほうにそろえる
  const sideMargin = Math.max(
    -(leftBlockX - SIDE_BLOCK_HALF - SIDE_EDGE),
    rightBlockX + SIDE_BLOCK_HALF + SIDE_EDGE - 1000,
  )
  const imageMidY = IMAGE_TOP + FLOOR_IMAGE.h / 2

  // 引き出し図：T の枠を回して、左下の空きに収まる大きさに縮める
  const tFrameRot = rotRect(zoneFrame("T"))
  const insetScale = Math.min(1, INSET_MAX_W / tFrameRot.w, INSET_MAX_H / tFrameRot.h)
  const insetW = tFrameRot.w * insetScale + INSET_PAD * 2
  const insetH = INSET_HEADER + tFrameRot.h * insetScale + INSET_PAD
  // 輪郭と、同じ横幅にある枠・点・エリア名より下に置く
  const insetSpan = { x: INSET_X, y: 0, w: insetW, h: 10000 }
  const insetTop = Math.max(
    IMAGE_TOP + OUTLINE_BOTTOM_LEFT,
    ...obstacles.filter((o) => rectsHit(o, insetSpan)).map((o) => o.y + o.h + 8),
  )
  const insetRot: Rect = { x: INSET_X, y: insetTop, w: insetW, h: insetH }

  // ミント園の区画（回したあとの座標）。中心と四隅
  const mintCenterRot: Point = {
    x: FLOOR_IMAGE.x + MINT_AREA.cx * FLOOR_IMAGE.w,
    y: IMAGE_TOP + MINT_AREA.cy * FLOOR_IMAGE.h,
  }
  const mintAngle = (MINT_AREA.angle * Math.PI) / 180
  const mintPoint = (u: number, v: number): Point => ({
    x: mintCenterRot.x + u * Math.cos(mintAngle) - v * Math.sin(mintAngle),
    y: mintCenterRot.y + u * Math.sin(mintAngle) + v * Math.cos(mintAngle),
  })
  // 引き出し線の出発点の候補：四隅と各辺の中点
  const hw = MINT_AREA.w / 2
  const hh = MINT_AREA.h / 2
  const mintStarts = [
    mintPoint(-hw, -hh), mintPoint(hw, -hh), mintPoint(hw, hh), mintPoint(-hw, hh),
    mintPoint(0, -hh), mintPoint(hw, 0), mintPoint(0, hh), mintPoint(-hw, 0),
  ]

  // 引き出し線：区画から引き出し図の上辺へ。出発点と上辺のつなぎ先は、線がほかの枠・点・
  // エリア名に当たる数がいちばん少ない組み合わせ（同じなら線が短いほう）にする
  const attachCandidates: Point[] = []
  for (let x = insetRot.x + 16; x <= insetRot.x + insetRot.w - 16; x += 8) {
    attachCandidates.push({ x, y: insetRot.y })
  }
  const best = mintStarts
    .flatMap((m) => attachCandidates.map((a) => ({ m, a })))
    .map(({ m, a }) => {
      const hits = obstacles.filter((o) => segmentHitsRect(m, a, o)).length
      return { m, a, cost: hits * 10 + Math.hypot(a.x - m.x, a.y - m.y) / 1000 }
    })
    .reduce((x, y) => (y.cost < x.cost ? y : x))

  // 描画領域の高さ。回転を切ったときは点対称の位置に移るので、その範囲も入れる
  const rotatedHeight = Math.max(IMAGE_TOP + FLOOR_IMAGE.h, insetRot.y + insetRot.h) + 12
  const viewHeight = ROTATE_FLOOR_MAP_180 ? rotatedHeight : Math.max(480, 2 * ROTATE_CY)

  // 実際に描く位置
  const inset = toShownRect(insetRot)
  // 中身は、枠がどこへ移っても見出しの下に置く（枠だけを点対称に移す）
  const insetContent: Rect = {
    x: inset.x + INSET_PAD,
    y: inset.y + INSET_HEADER,
    w: tFrameRot.w * insetScale,
    h: tFrameRot.h * insetScale,
  }
  const leaderStart = toShown(best.m)
  const attach = toShown(best.a)
  // 区画は図面と同じ回転の中に描くので、元の向きの座標で持つ（回転を切ると点対称に移る）
  const mintCenterOrig = rotPoint(mintCenterRot)
  // 引き出し図の中身：T の枠（元の向き）を、回して（または回さずに）縮めて枠の中へ
  const tFrame = zoneFrame("T")
  const insetTransform = ROTATE_FLOOR_MAP_180
    ? `translate(${insetContent.x} ${insetContent.y}) scale(${insetScale}) translate(${-tFrameRot.x} ${-tFrameRot.y}) rotate(180 ${ROTATE_CX} ${ROTATE_CY})`
    : `translate(${insetContent.x} ${insetContent.y}) scale(${insetScale}) translate(${-tFrame.x} ${-tFrame.y})`

  // 左右の手がかり（矢印の向きは、回転を切ると反対になる）
  const k = ROTATE_FLOOR_MAP_180 ? 1 : -1
  const leftGuide = toShown({ x: leftBlockX, y: imageMidY })
  const rightGuide = toShown({ x: rightBlockX, y: imageMidY + 20 }) // やや下寄り
  const walkwayA = toShown({ x: FLOOR_IMAGE.x, y: WALKWAY_Y })
  const walkwayB = toShown({ x: FLOOR_IMAGE.x + FLOOR_IMAGE.w, y: WALKWAY_Y })
  const walkwayLabel = toShown({ x: ROTATE_CX, y: WALKWAY_Y - 14 })
  const compass = toShown({ x: 1000 - 50, y: WALKWAY_Y - 36 })

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
          viewBox={`${-sideMargin} 0 ${1000 + sideMargin * 2} ${viewHeight}`}
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
          <rect x={-sideMargin} width={1000 + sideMargin * 2} height={viewHeight} fill="url(#floorgrid)" />

          {/* ここから閉じタグまでが地図の図形（T は引き出し図に描く）。文字はこの外に正立で描く */}
          <g transform={ROTATE_FLOOR_MAP_180 ? `rotate(180 ${ROTATE_CX} ${ROTATE_CY})` : undefined}>
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

            {/* T（ミント園）の区画。枠と点より下に描き、点を隠さない */}
            <rect
              x={-MINT_AREA.w / 2}
              y={-MINT_AREA.h / 2}
              width={MINT_AREA.w}
              height={MINT_AREA.h}
              transform={`translate(${mintCenterOrig.x} ${mintCenterOrig.y}) rotate(${MINT_AREA.angle})`}
              fill={MINT_FILL}
              stroke={MINT_STROKE}
              strokeWidth={LEADER_WIDTH_PX}
              vectorEffect="non-scaling-stroke"
              className="pointer-events-none"
            />

            {/* ゾーン（面積降順で描画） */}
            {ZONES_BY_SIZE.filter((zone) => zone !== "T").map(renderZone)}

            {/* プロットマーカー */}
            {plots.filter((plot) => plot.zone !== "T").map(renderPlot)}
          </g>

          {/* 位置の手がかり（園の輪郭の外の余白。文字・矢印は正立で、回転の外に描く） */}
          <g className="pointer-events-none select-none">
            {/* 歩道：図面の上端に沿った細い破線。園に接しているので矢印は付けない */}
            <line
              x1={walkwayA.x} y1={walkwayA.y} x2={walkwayB.x} y2={walkwayB.y}
              stroke={GUIDE_COLOR}
              strokeOpacity={0.6}
              strokeWidth={1.2}
              strokeDasharray="10,6"
            />
            <GuideText text="歩道" x={walkwayLabel.x} y={walkwayLabel.y} />

            {/* 用水路・神社：園から離れているので、その方向（左）を指す矢印を添える。
                幅を取らないよう縦書きにし、矢印は文字の上に置く */}
            <GuideArrow x={leftGuide.x} y={leftGuide.y - 86 * k} dx={-k} dy={0} />
            <GuideText text="用水路・神社" x={leftGuide.x} y={leftGuide.y} vertical />

            {/* トイレ・駐車場：同じく離れているので、文字の下に下向きの矢印 */}
            <GuideText text="トイレ・駐車場" x={rightGuide.x} y={rightGuide.y} vertical />
            <GuideArrow x={rightGuide.x} y={rightGuide.y + 100 * k} dx={0} dy={k} />

            {/* 方位記号。回したときは 左＝北・上＝東・右＝南・下＝西 */}
            <g>
              <line x1={compass.x - 12} y1={compass.y} x2={compass.x + 12} y2={compass.y} stroke={GUIDE_COLOR} strokeWidth={1.2} />
              <line x1={compass.x} y1={compass.y - 12} x2={compass.x} y2={compass.y + 12} stroke={GUIDE_COLOR} strokeWidth={1.2} />
              <GuideText text="北" x={compass.x - 25 * k} y={compass.y} size={16} />
              <GuideText text="東" x={compass.x} y={compass.y - 25 * k} size={16} />
              <GuideText text="南" x={compass.x + 25 * k} y={compass.y} size={16} />
              <GuideText text="西" x={compass.x} y={compass.y + 25 * k} size={16} />
            </g>
          </g>

          {/* T（ミント園）の引き出し図。区画から細い実線で引き出す */}
          <line
            x1={leaderStart.x} y1={leaderStart.y} x2={attach.x} y2={attach.y}
            stroke={INSET_COLOR}
            strokeWidth={LEADER_WIDTH_PX}
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            className="pointer-events-none"
          />
          {/* 引き出した枠は実線・白地にして、エリアの破線の枠と見分ける */}
          <rect
            x={inset.x} y={inset.y} width={inset.w} height={inset.h}
            rx={4}
            fill="#ffffff"
            stroke={INSET_COLOR}
            strokeWidth={1.4}
            className="pointer-events-none"
          />
          <text
            x={inset.x + INSET_PAD} y={inset.y + 18}
            fontSize={16}
            fontWeight={700}
            fill={INSET_COLOR}
            className="pointer-events-none select-none"
          >
            T ミント園（拡大図）
          </text>
          <g transform={insetTransform}>
            {renderZone("T")}
            {plots.filter((plot) => plot.zone === "T").map(renderPlot)}
          </g>

          {/* ゾーンラベル（マーカーに隠れないよう最後に描く）。回したあとの枠を基準に置く。
              T は引き出し図の中の枠を基準にする */}
          {ZONES.map((zone) => {
            const f = zone === "T" ? insetContent : toShownRect(rotRect(zoneFrame(zone)))
            // 回すと上下・左右が入れ替わる
            const atBottom = LABEL_AT_BOTTOM.has(zone) !== ROTATE_FLOOR_MAP_180
            const y = atBottom
              ? f.y + f.h - LABEL_INSET
              : f.y + LABEL_TOP_BASELINE
            return (
              <text
                key={zone}
                x={
                  ROTATE_FLOOR_MAP_180
                    ? f.x + f.w - LABEL_INSET + (ROTATED_LABEL_NUDGE_X[zone] ?? 0)
                    : f.x + LABEL_INSET
                }
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

// 位置の手がかりの矢印。(x, y) は矢印の中心、(dx, dy) は向き（-1・0・1）
function GuideArrow({ x, y, dx, dy }: { x: number; y: number; dx: number; dy: number }) {
  const LEN = dx !== 0 ? 30 : 40 // 横向きは余白の幅に収まる長さ
  const HEAD = 9
  const tip = { x: x + (dx * LEN) / 2, y: y + (dy * LEN) / 2 }
  const tail = { x: x - (dx * LEN) / 2, y: y - (dy * LEN) / 2 }
  // 矢じりは、向きに直交する方向へ開く
  const px = -dy
  const py = dx
  const back = { x: tip.x - dx * HEAD, y: tip.y - dy * HEAD }
  return (
    <g stroke={GUIDE_COLOR} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <line x1={tail.x} y1={tail.y} x2={tip.x} y2={tip.y} />
      <polyline
        points={`${back.x + px * HEAD * 0.7},${back.y + py * HEAD * 0.7} ${tip.x},${tip.y} ${back.x - px * HEAD * 0.7},${back.y - py * HEAD * 0.7}`}
      />
    </g>
  )
}
