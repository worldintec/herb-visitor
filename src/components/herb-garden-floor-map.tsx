"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import type { MapPlot } from "@/types/database"

// ─── ゾーン定義 ────────────────────────────────────────────────────────────────

const ZONES = [
  "A","B","C","D","E","F","G","H","I","J","K","L","M",
  "N","O","P","Q","R","S","T","U","V","W",
] as const
type Zone = (typeof ZONES)[number]

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

// ─── Excel座標 → SVG座標 変換 ──────────────────────────────────────────────────
function excelToSvg(ex: number, ey: number): { x: number; y: number } {
  const x = ex * (980 / 969) + 10
  const y = 0.00876 * ex + 0.599 * ey + 87.3
  return { x: Math.round(x), y: Math.round(y) }
}

// ─── Excel植物位置データ（herb-gardenのmap-client.tsxと同一） ─────────────────
const EXCEL_PLANTS = [
  { id:"txt_A_1",  name:"ユキノシタ",              area:"A", x:27.19,  y:396.34 },
  { id:"txt_A_2",  name:"アナベル",                area:"A", x:25.44,  y:406.02 },
  { id:"txt_A_3",  name:"ホトトギス",              area:"A", x:15.79,  y:414.35 },
  { id:"txt_A_4",  name:"ドイツスズラン",          area:"A", x:3.51,   y:426.61 },
  { id:"txt_A_4b", name:"スイートバイオレット",    area:"A", x:0.00,   y:437.12 },
  { id:"txt_A_5",  name:"カシワバアジサイ",        area:"A", x:6.14,   y:446.75 },
  { id:"txt_A_6",  name:"ユーカリ",                area:"A", x:67.79,  y:407.65 },
  { id:"txt_A_7",  name:"ポポラス",                area:"A", x:63.40,  y:415.11 },
  { id:"txt_A_8",  name:"ジューンベリー",          area:"A", x:70.42,  y:436.60 },
  { id:"txt_A_9",  name:"ラベンダー(W)",           area:"A", x:74.81,  y:445.77 },
  { id:"txt_A_10", name:"メキシカンブッシュセージ",area:"A", x:123.79, y:437.23 },
  { id:"txt_A_11", name:"レモングラス",            area:"A", x:145.72, y:425.77 },
  { id:"txt_A_12", name:"ミモザアカシア",          area:"A", x:141.33, y:447.26 },
  { id:"txt_B_13", name:"サラダバーネット",        area:"B", x:104.49, y:311.60 },
  { id:"txt_B_14", name:"ツワブキ",                area:"B", x:116.77, y:320.77 },
  { id:"txt_B_15", name:"チャイブ",                area:"B", x:133.44, y:327.35 },
  { id:"txt_B_16", name:"クラリーセージ",          area:"B", x:103.37, y:333.24 },
  { id:"txt_B_17", name:"ルッコラ",                area:"B", x:143.09, y:337.06 },
  { id:"txt_B_18", name:"ベルガモット",            area:"B", x:106.25, y:341.54 },
  { id:"txt_B_19", name:"サフラン",                area:"B", x:142.87, y:345.14 },
  { id:"txt_B_20", name:"マーレイン",              area:"B", x:138.89, y:351.83 },
  { id:"txt_B_21", name:"バーベイン",              area:"B", x:105.34, y:350.15 },
  { id:"txt_B_22", name:"エキナセア",              area:"B", x:131.76, y:360.02 },
  { id:"txt_B_23", name:"チコリ",                  area:"B", x:98.84,  y:361.54 },
  { id:"txt_B_24", name:"ホースラディッシュ",      area:"B", x:118.61, y:366.99 },
  { id:"txt_B_25", name:"コモンマロー",            area:"B", x:105.67, y:372.54 },
  { id:"txt_B_26", name:"スペアミント",            area:"B", x:91.63,  y:380.93 },
  { id:"txt_B_27", name:"イチゴ",                  area:"B", x:134.37, y:375.94 },
  { id:"txt_B_28", name:"カラミント",              area:"B", x:95.33,  y:387.98 },
  { id:"txt_B_29", name:"オレガノ",                area:"B", x:163.22, y:384.85 },
  { id:"txt_B_30", name:"フェンネル",              area:"B", x:220.07, y:373.44 },
  { id:"txt_B_31", name:"ルッコラ(2)",             area:"B", x:240.29, y:381.56 },
  { id:"txt_B_32", name:"オリーブ",                area:"B", x:216.70, y:391.93 },
  { id:"txt_B_33", name:"クコ",                    area:"B", x:261.96, y:391.63 },
  { id:"txt_B_34", name:"キンカン",                area:"B", x:258.27, y:399.75 },
  { id:"txt_B_35", name:"クチナシ",                area:"B", x:259.39, y:408.44 },
  { id:"txt_B_36", name:"ポポー",                  area:"B", x:282.18, y:387.87 },
  { id:"txt_B_38", name:"キキョウ",                area:"B", x:305.21, y:385.57 },
  { id:"txt_B_39", name:"オオバギボウシ",          area:"B", x:311.95, y:390.87 },
  { id:"txt_B_40", name:"ワイルドストロベリー",    area:"B", x:325.01, y:398.20 },
  { id:"txt_B_41", name:"コモンマロー(2)",         area:"B", x:326.13, y:406.87 },
  { id:"txt_B_42", name:"コモンタイム",            area:"B", x:310.65, y:353.12 },
  { id:"txt_B_1",  name:"タイム",                  area:"B", x:238.99, y:424.26 },
  { id:"txt_B_45", name:"レモンバーム",            area:"B", x:326.04, y:380.76 },
  { id:"txt_C_43", name:"ローズマリー",            area:"C", x:192.61, y:398.89 },
  { id:"txt_C_44", name:"フェンネル(C)",           area:"C", x:216.52, y:417.69 },
  { id:"txt_C_3",  name:"タイム(C)",               area:"C", x:193.73, y:406.12 },
  { id:"txt_D_45", name:"サラダバーネット(D)",     area:"D", x:174.63, y:357.44 },
  { id:"txt_D_47", name:"チャイブ(D)",             area:"D", x:204.40, y:368.37 },
  { id:"txt_D_48", name:"サンショウ",              area:"D", x:172.76, y:362.76 },
  { id:"txt_D_50", name:"カレーミント",            area:"D", x:172.20, y:374.24 },
  { id:"txt_E_52", name:"タラゴン",                area:"E", x:297.55, y:403.75 },
  { id:"txt_E_53", name:"バラ",                    area:"E", x:308.79, y:408.51 },
  { id:"txt_F_51", name:"ラベンダーグロッソ",      area:"F", x:260.47, y:439.12 },
  { id:"txt_F_52", name:"コモンセージ",            area:"F", x:264.40, y:446.12 },
  { id:"txt_F_53", name:"スイートバジル",          area:"F", x:324.27, y:425.55 },
  { id:"txt_F_54", name:"パープルセージ",          area:"F", x:320.90, y:439.88 },
  { id:"txt_F_55", name:"ヤブカンジョウ",          area:"F", x:316.97, y:449.69 },
  { id:"txt_F_56", name:"パッションフルーツ",      area:"F", x:381.89, y:421.81 },
  { id:"txt_F_57", name:"ケツメイシ",              area:"F", x:393.51, y:413.93 },
  { id:"txt_F_58", name:"コリアンダー",            area:"F", x:392.94, y:428.80 },
  { id:"txt_F_59", name:"ローズマリー(F)",         area:"F", x:368.79, y:438.63 },
  { id:"txt_F_60", name:"ディル",                  area:"F", x:423.60, y:406.82 },
  { id:"txt_F_61", name:"アーティーチョーク",      area:"F", x:423.03, y:397.51 },
  { id:"txt_F_62", name:"カールドン",              area:"F", x:447.19, y:406.19 },
  { id:"txt_G_63", name:"ソープワート",            area:"G", x:368.22, y:374.92 },
  { id:"txt_G_64", name:"オレガノ(G)",             area:"G", x:374.97, y:390.93 },
  { id:"txt_H_65", name:"アップルミント",          area:"H", x:392.94, y:365.33 },
  { id:"txt_I_66", name:"カレンデュラ",            area:"I", x:425.28, y:359.36 },
  { id:"txt_J_67", name:"ドチアナセージ",          area:"J", x:441.96, y:322.81 },
  { id:"txt_J_68", name:"エキナセア(J)",           area:"J", x:451.51, y:338.24 },
  { id:"txt_J_69", name:"ラベンダーグロッソ(J)",   area:"J", x:461.62, y:328.94 },
  { id:"txt_J_70", name:"モッコウバラ",            area:"J", x:477.10, y:356.19 },
  { id:"txt_J_71", name:"モッコウバラ(2)",         area:"J", x:482.72, y:395.24 },
  { id:"txt_J_72", name:"コモンマロー(J)",         area:"J", x:479.35, y:415.20 },
  { id:"txt_J_73", name:"ラベンダーグロッソ(J2)",  area:"J", x:470.36, y:431.73 },
  { id:"txt_J_74", name:"スモークツリー",          area:"J", x:469.80, y:438.75 },
  { id:"txt_J_75", name:"メキシカンブッシュセージ(J)",area:"J",x:463.87,y:446.31},
  { id:"txt_J_76", name:"ベルガモット(J)",         area:"J", x:473.17, y:452.19 },
  { id:"txt_K_77", name:"ロウバイ",                area:"K", x:527.24, y:275.01 },
  { id:"txt_K_78", name:"オミエナシ",              area:"K", x:541.28, y:256.69 },
  { id:"txt_K_79", name:"シオン",                  area:"K", x:566.56, y:244.56 },
  { id:"txt_K_80", name:"ビワ",                    area:"K", x:588.22, y:236.96 },
  { id:"txt_K_81", name:"レオノチスセージ",        area:"K", x:589.35, y:245.62 },
  { id:"txt_K_82", name:"フジバカマ",              area:"K", x:587.10, y:256.01 },
  { id:"txt_K_83", name:"クリーピングタイム",      area:"K", x:557.57, y:295.06 },
  { id:"txt_K_84", name:"オリス",                  area:"K", x:656.52, y:250.87 },
  { id:"txt_K_85", name:"メリロット",              area:"K", x:626.74, y:262.94 },
  { id:"txt_K_86", name:"シャクヤク",              area:"K", x:614.07, y:287.92 },
  { id:"txt_K_87", name:"ヒバ",                    area:"K", x:647.60, y:295.26 },
  { id:"txt_K_88", name:"マートル",                area:"K", x:671.19, y:267.36 },
  { id:"txt_K_89", name:"タンジ",                  area:"K", x:653.21, y:283.37 },
  { id:"txt_K_90", name:"ツワブキ(K)",             area:"K", x:665.57, y:274.64 },
  { id:"txt_L_91", name:"ナンテン",                area:"L", x:585.48, y:268.11 },
  { id:"txt_L_92", name:"ホトトギス(L)",           area:"L", x:594.47, y:275.13 },
  { id:"txt_M_93", name:"サントリーナ",            area:"M", x:568.88, y:332.18 },
  { id:"txt_M_94", name:"アップルミント(M)",       area:"M", x:587.73, y:338.62 },
  { id:"txt_N_95", name:"シナノキ",                area:"N", x:535.17, y:357.44 },
  { id:"txt_N_96", name:"セントジョーンズワート",  area:"N", x:540.79, y:394.80 },
  { id:"txt_N_97", name:"レッズローズ",            area:"N", x:541.73, y:413.93 },
  { id:"txt_O_98",  name:"ルー",                   area:"O", x:587.55, y:422.06 },
  { id:"txt_O_99",  name:"ヤロー",                 area:"O", x:573.51, y:433.01 },
  { id:"txt_O_100", name:"ヤロー(2)",              area:"O", x:606.09, y:442.26 },
  { id:"txt_O_101", name:"メキシカンブッシュセージ",area:"O",x:558.02, y:450.38 },
  { id:"txt_P_102", name:"ハンカチノキ",           area:"P", x:637.30, y:370.75 },
  { id:"txt_P_103", name:"レッズローズ",           area:"P", x:630.56, y:400.25 },
  { id:"txt_Q_104", name:"ロシアンセージ",         area:"Q", x:711.21, y:304.87 },
  { id:"txt_Q_105", name:"ジャーマンカモミール",   area:"Q", x:721.89, y:311.89 },
  { id:"txt_Q_106", name:"ブットレア",             area:"Q", x:683.69, y:370.06 },
  { id:"txt_Q_107", name:"メキシカンブッシュセージ",area:"Q",x:684.07, y:418.45 },
  { id:"txt_Q_108", name:"ラベンダーグロッソ",     area:"Q", x:707.66, y:427.67 },
  { id:"txt_Q_109", name:"セイヨウニンジンボク",   area:"Q", x:676.20, y:443.69 },
  { id:"txt_Q_110", name:"ローズマリー",           area:"Q", x:725.64, y:435.52 },
  { id:"txt_Q_111", name:"パンパスグラス",         area:"Q", x:736.07, y:449.24 },
  { id:"txt_R_112", name:"フレンチラベンダー",     area:"R", x:684.63, y:327.45 },
  { id:"txt_S_113", name:"タイム",                 area:"S", x:727.33, y:363.12 },
  { id:"txt_S_114", name:"サフラン",               area:"S", x:724.52, y:375.74 },
  { id:"txt_S_115", name:"ラムズイヤー",           area:"S", x:755.17, y:376.56 },
  { id:"txt_S_116", name:"ラベンダーグロッソ",     area:"S", x:738.31, y:388.06 },
  { id:"txt_T_117", name:"ニホンハッカ",           area:"T", x:651.55, y:46.07  },
  { id:"txt_T_118", name:"クールミント",           area:"T", x:622.58, y:77.81  },
  { id:"txt_T_119", name:"レモンミント",           area:"T", x:653.80, y:95.51  },
  { id:"txt_T_120", name:"カーリーミント",         area:"T", x:711.42, y:78.33  },
  { id:"txt_T_121", name:"パイナップルミント",     area:"T", x:682.20, y:113.44 },
  { id:"txt_T_122", name:"ラベンダーミント",       area:"T", x:737.57, y:93.45  },
  { id:"txt_T_123", name:"ベルガモットミント",     area:"T", x:772.40, y:111.12 },
  { id:"txt_T_124", name:"オレンジミント",         area:"T", x:746.56, y:142.87 },
  { id:"txt_T_125", name:"クラシックミント",       area:"T", x:802.49, y:127.96 },
  { id:"txt_T_126", name:"イングリッシュミント",   area:"T", x:772.40, y:160.80 },
  { id:"txt_T_127", name:"ホワイトミント",         area:"T", x:834.09, y:141.12 },
  { id:"txt_T_128", name:"スペアミント",           area:"T", x:808.49, y:176.80 },
  { id:"txt_T_129", name:"ウォーターミント",       area:"T", x:867.24, y:160.74 },
  { id:"txt_T_130", name:"イエルバブナ",           area:"T", x:844.76, y:194.75 },
  { id:"txt_U_131", name:"ブルーベリー",           area:"U", x:797.26, y:368.81 },
  { id:"txt_U_132", name:"ダイヤーズカモミール",   area:"U", x:806.25, y:377.49 },
  { id:"txt_U_133", name:"バラ",                   area:"U", x:852.63, y:367.06 },
  { id:"txt_U_134", name:"コモンセージ",           area:"U", x:858.81, y:382.51 },
  { id:"txt_U_135", name:"パープルセージ",         area:"U", x:891.15, y:388.38 },
  { id:"txt_U_136", name:"コーンフラワー",         area:"U", x:896.20, y:362.75 },
  { id:"txt_V_137", name:"ラベンダーグロッソ",     area:"V", x:804.38, y:403.26 },
  { id:"txt_V_138", name:"ティーツリー",           area:"V", x:816.74, y:417.00 },
  { id:"txt_V_139", name:"クリスマスローズ",       area:"V", x:817.30, y:425.69 },
  { id:"txt_V_140", name:"チェリーセージ",         area:"V", x:862.00, y:416.96 },
  { id:"txt_V_141", name:"サントリーナ(シルバー)", area:"V", x:894.90, y:408.74 },
  { id:"txt_V_142", name:"ツリージャーマンダー",   area:"V", x:910.07, y:415.76 },
  { id:"txt_W_143", name:"カレックス",             area:"W", x:979.48, y:350.74 },
  { id:"txt_W_144", name:"バラ",                   area:"W", x:1007.89,y:355.49 },
  { id:"txt_W_145", name:"ホトトギス",             area:"W", x:1012.38,y:363.64 },
  { id:"txt_W_146", name:"コウテイダリア",         area:"W", x:1003.96,y:372.30 },
  { id:"txt_W_147", name:"ラベンダーグロッソ",     area:"W", x:1015.01,y:380.76 },
  { id:"txt_W_148", name:"サントリーナ",           area:"W", x:1034.11,y:388.87 },
  { id:"txt_W_149", name:"バラ(2)",                area:"W", x:1056.90,y:397.57 },
  { id:"txt_W_150", name:"ゲッケイジュ",           area:"W", x:1030.74,y:405.70 },
  { id:"txt_W_151", name:"メキシカンブッシュセージ",area:"W",x:998.16, y:423.93 },
  { id:"txt_W_152", name:"コモンマロー",           area:"W", x:967.51, y:435.45 },
  { id:"txt_W_153", name:"ラベンダーグロッソ(2)",  area:"W", x:918.31, y:443.55 },
  { id:"txt_W_154", name:"レモンバームエニシダ",   area:"W", x:879.80, y:450.57 },
] as const

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

// ─── コンポーネント ─────────────────────────────────────────────────────────────

export default function HerbGardenFloorMap() {
  const router = useRouter()
  const [plots, setPlots] = useState<MapPlot[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredZone, setHoveredZone] = useState<Zone | null>(null)
  const [hoveredPlot, setHoveredPlot] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from("map_plots")
      .select("*")
      .order("created_at")
      .then(({ data }) => {
        if (data) setPlots(data as MapPlot[])
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-gray-400">
        読み込み中...
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* マップSVG */}
      <div className="bg-white rounded-xl overflow-hidden border border-gray-100">
        <svg
          viewBox="0 0 1000 480"
          className="w-full h-auto block"
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

          {/* グリッド背景 */}
          <rect width="1000" height="480" fill="url(#floorgrid)" />

          {/* ミント園（別枠）枠線 */}
          <rect
            x={620} y={30} width={282} height={118}
            rx={4}
            fill="rgba(29,158,117,0.04)"
            stroke="rgba(29,158,117,0.3)"
            strokeWidth={0.8}
            strokeDasharray="4,3"
            className="pointer-events-none"
          />
          <text
            x={761} y={44}
            textAnchor="middle"
            fontSize={9}
            fill="#5f5e5a"
            fillOpacity={0.6}
            className="pointer-events-none select-none"
          >
            ミント園（別枠）
          </text>

          {/* 平面図背景画像 */}
          <image
            href="/ハーブ園図面加工後.png"
            x={10}
            y={145}
            width={980}
            height={224}
            preserveAspectRatio="none"
            opacity={0.9}
            className="pointer-events-none"
          />

          {/* ゾーン（面積降順で描画） */}
          {ZONES_BY_SIZE.map((zone) => {
            const a = ZONE_AREAS[zone]
            const isHovered = hoveredZone === zone
            return (
              <g key={zone}>
                {/* ハイライト背景 */}
                <rect
                  x={a.x} y={a.y} width={a.w} height={a.h}
                  rx={3}
                  fill="#1D9E75"
                  fillOpacity={isHovered ? 0.18 : 0}
                  className="pointer-events-none transition-colors duration-150"
                />
                {/* ゾーン枠（クリック受付） */}
                <rect
                  x={a.x} y={a.y} width={a.w} height={a.h}
                  rx={3}
                  fill="transparent"
                  stroke="#1D9E75"
                  strokeWidth={isHovered ? 1.5 : 0.8}
                  strokeDasharray="4,3"
                  strokeOpacity={isHovered ? 1 : 0.5}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHoveredZone(zone)}
                  onMouseLeave={() => setHoveredZone(null)}
                  onClick={() => router.push(`/areas/${zone}`)}
                />
                {/* ゾーンラベル */}
                <text
                  x={a.x + a.w / 2}
                  y={a.y + Math.min(13, a.h / 2 + 4)}
                  textAnchor="middle"
                  fontSize={Math.min(11, a.w * 0.5)}
                  fontWeight={500}
                  fill={isHovered ? "#0F6E56" : "#5f5e5a"}
                  fillOpacity={isHovered ? 1 : 0.65}
                  className="pointer-events-none select-none"
                >
                  {zone}
                </text>
              </g>
            )
          })}

          {/* Excel植物位置ドット */}
          {EXCEL_PLANTS.map((plant) => {
            const { x: bx, y: by } = excelToSvg(plant.x, plant.y)
            return (
              <g key={plant.id}>
                <title>{plant.name}（エリア {plant.area}）</title>
                <circle
                  cx={bx}
                  cy={by}
                  r={3.5}
                  fill="#F59E0B"
                  fillOpacity={0.8}
                  stroke="white"
                  strokeWidth={1}
                  className="pointer-events-none"
                />
              </g>
            )
          })}

          {/* プロットマーカー */}
          {plots.map((plot) => {
            const color = TYPE_COLORS[plot.type] ?? "#888780"
            const isHovered = hoveredPlot === plot.id
            const label =
              plot.name.length > 6 ? plot.name.slice(0, 5) + "…" : plot.name
            return (
              <g
                key={plot.id}
                style={{ cursor: "default" }}
                onMouseEnter={() => setHoveredPlot(plot.id)}
                onMouseLeave={() => setHoveredPlot(null)}
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
                <text
                  x={plot.x} y={plot.y + 16}
                  textAnchor="middle"
                  fontSize={9}
                  fill={isHovered ? color : "#5f5e5a"}
                  fontWeight={isHovered ? 600 : 400}
                  className="pointer-events-none select-none"
                >
                  {label}
                </text>
              </g>
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

      {plots.length === 0 && (
        <p className="text-xs text-center text-gray-400 py-2">
          プロットはまだ登録されていません
        </p>
      )}
    </div>
  )
}
