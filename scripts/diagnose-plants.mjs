/**
 * 診断スクリプト: DBのplantsテーブルとEXCEL_PLANTSを照合
 * 使い方: SUPABASE_URL=xxx SUPABASE_KEY=xxx node scripts/diagnose-plants.mjs
 *
 * SupabaseのURLとANON KEYはVercelの環境変数から確認してください。
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("環境変数を設定してください:")
  console.error("  SUPABASE_URL=https://xxx.supabase.co SUPABASE_KEY=eyJ... node scripts/diagnose-plants.mjs")
  process.exit(1)
}

// EXCEL_PLANTS を直接定義（excel-plants.tsと同期）
const EXCEL_PLANTS = [
  { id:"txt_A_1",  name:"ユキノシタ",              area:"A" },
  { id:"txt_A_2",  name:"アナベル",                area:"A" },
  { id:"txt_A_3",  name:"ホトトギス",              area:"A" },
  { id:"txt_A_4",  name:"ドイツスズラン",          area:"A" },
  { id:"txt_A_4b", name:"スイートバイオレット",    area:"A" },
  { id:"txt_A_5",  name:"カシワバアジサイ",        area:"A" },
  { id:"txt_A_6",  name:"ユーカリ",                area:"A" },
  { id:"txt_A_7",  name:"ポポラス",                area:"A" },
  { id:"txt_A_8",  name:"ジューンベリー",          area:"A" },
  { id:"txt_A_9",  name:"ラベンダー(W)",           area:"A" },
  { id:"txt_A_10", name:"メキシカンブッシュセージ",area:"A" },
  { id:"txt_A_11", name:"レモングラス",            area:"A" },
  { id:"txt_A_12", name:"ミモザアカシア",          area:"A" },
  { id:"txt_B_13", name:"サラダバーネット",        area:"B" },
  { id:"txt_B_14", name:"ツワブキ",                area:"B" },
  { id:"txt_B_15", name:"チャイブ",                area:"B" },
  { id:"txt_B_16", name:"クラリーセージ",          area:"B" },
  { id:"txt_B_17", name:"ルッコラ",                area:"B" },
  { id:"txt_B_18", name:"ベルガモット",            area:"B" },
  { id:"txt_B_19", name:"サフラン",                area:"B" },
  { id:"txt_B_20", name:"マーレイン",              area:"B" },
  { id:"txt_B_21", name:"バーベイン",              area:"B" },
  { id:"txt_B_22", name:"エキナセア",              area:"B" },
  { id:"txt_B_23", name:"チコリ",                  area:"B" },
  { id:"txt_B_24", name:"ホースラディッシュ",      area:"B" },
  { id:"txt_B_25", name:"コモンマロー",            area:"B" },
  { id:"txt_B_26", name:"スペアミント",            area:"B" },
  { id:"txt_B_27", name:"イチゴ",                  area:"B" },
  { id:"txt_B_28", name:"カラミント",              area:"B" },
  { id:"txt_B_29", name:"オレガノ",                area:"B" },
  { id:"txt_B_30", name:"フェンネル",              area:"B" },
  { id:"txt_B_31", name:"ルッコラ(2)",             area:"B" },
  { id:"txt_B_32", name:"オリーブ",                area:"B" },
  { id:"txt_B_33", name:"クコ",                    area:"B" },
  { id:"txt_B_34", name:"キンカン",                area:"B" },
  { id:"txt_B_35", name:"クチナシ",                area:"B" },
  { id:"txt_B_36", name:"ポポー",                  area:"B" },
  { id:"txt_B_38", name:"キキョウ",                area:"B" },
  { id:"txt_B_39", name:"オオバギボウシ",          area:"B" },
  { id:"txt_B_40", name:"ワイルドストロベリー",    area:"B" },
  { id:"txt_B_41", name:"コモンマロー(2)",         area:"B" },
  { id:"txt_B_42", name:"コモンタイム",            area:"B" },
  { id:"txt_B_1",  name:"タイム",                  area:"B" },
  { id:"txt_B_45", name:"レモンバーム",            area:"B" },
  { id:"txt_C_43", name:"ローズマリー",            area:"C" },
  { id:"txt_C_44", name:"フェンネル(C)",           area:"C" },
  { id:"txt_C_3",  name:"タイム(C)",               area:"C" },
  { id:"txt_D_45", name:"サラダバーネット(D)",     area:"D" },
  { id:"txt_D_47", name:"チャイブ(D)",             area:"D" },
  { id:"txt_D_48", name:"サンショウ",              area:"D" },
  { id:"txt_D_50", name:"カレーミント",            area:"D" },
  { id:"txt_E_52", name:"タラゴン",                area:"E" },
  { id:"txt_E_53", name:"バラ",                    area:"E" },
  { id:"txt_F_51", name:"ラベンダーグロッソ",      area:"F" },
  { id:"txt_F_52", name:"コモンセージ",            area:"F" },
  { id:"txt_F_53", name:"スイートバジル",          area:"F" },
  { id:"txt_F_54", name:"パープルセージ",          area:"F" },
  { id:"txt_F_55", name:"ヤブカンジョウ",          area:"F" },
  { id:"txt_F_56", name:"パッションフルーツ",      area:"F" },
  { id:"txt_F_57", name:"ケツメイシ",              area:"F" },
  { id:"txt_F_58", name:"コリアンダー",            area:"F" },
  { id:"txt_F_59", name:"ローズマリー(F)",         area:"F" },
  { id:"txt_F_60", name:"ディル",                  area:"F" },
  { id:"txt_F_61", name:"アーティーチョーク",      area:"F" },
  { id:"txt_F_62", name:"カールドン",              area:"F" },
  { id:"txt_G_63", name:"ソープワート",            area:"G" },
  { id:"txt_G_64", name:"オレガノ(G)",             area:"G" },
  { id:"txt_H_65", name:"アップルミント",          area:"H" },
  { id:"txt_I_66", name:"カレンデュラ",            area:"I" },
  { id:"txt_J_67", name:"ドチアナセージ",          area:"J" },
  { id:"txt_J_68", name:"エキナセア(J)",           area:"J" },
  { id:"txt_J_69", name:"ラベンダーグロッソ(J)",   area:"J" },
  { id:"txt_J_70", name:"モッコウバラ",            area:"J" },
  { id:"txt_J_71", name:"モッコウバラ(2)",         area:"J" },
  { id:"txt_J_72", name:"コモンマロー(J)",         area:"J" },
  { id:"txt_J_73", name:"ラベンダーグロッソ(J2)",  area:"J" },
  { id:"txt_J_74", name:"スモークツリー",          area:"J" },
  { id:"txt_J_75", name:"メキシカンブッシュセージ(J)",area:"J" },
  { id:"txt_J_76", name:"ベルガモット(J)",         area:"J" },
  { id:"txt_K_77", name:"ロウバイ",                area:"K" },
  { id:"txt_K_78", name:"オミナエシ",              area:"K" },
  { id:"txt_K_79", name:"シオン",                  area:"K" },
  { id:"txt_K_80", name:"ビワ",                    area:"K" },
  { id:"txt_K_81", name:"レオノチスセージ",        area:"K" },
  { id:"txt_K_82", name:"フジバカマ",              area:"K" },
  { id:"txt_K_83", name:"クリーピングタイム",      area:"K" },
  { id:"txt_K_84", name:"オリス",                  area:"K" },
  { id:"txt_K_85", name:"メリロット",              area:"K" },
  { id:"txt_K_86", name:"シャクヤク",              area:"K" },
  { id:"txt_K_87", name:"ヒバ",                    area:"K" },
  { id:"txt_K_88", name:"マートル",                area:"K" },
  { id:"txt_K_89", name:"タンジ",                  area:"K" },
  { id:"txt_K_90", name:"ツワブキ(K)",             area:"K" },
  { id:"txt_L_91", name:"ナンテン",                area:"L" },
  { id:"txt_L_92", name:"ホトトギス(L)",           area:"L" },
  { id:"txt_M_93", name:"サントリーナ",            area:"M" },
  { id:"txt_M_94", name:"アップルミント(M)",       area:"M" },
  { id:"txt_N_95", name:"シナノキ",                area:"N" },
  { id:"txt_N_96", name:"セントジョーンズワート",  area:"N" },
  { id:"txt_N_97", name:"レッズローズ",            area:"N" },
  { id:"txt_O_98",  name:"ルー",                   area:"O" },
  { id:"txt_O_99",  name:"ヤロー",                 area:"O" },
  { id:"txt_O_100", name:"ヤロー(2)",              area:"O" },
  { id:"txt_O_101", name:"メキシカンブッシュセージ",area:"O" },
  { id:"txt_P_102", name:"ハンカチノキ",           area:"P" },
  { id:"txt_P_103", name:"レッズローズ",           area:"P" },
  { id:"txt_Q_104", name:"ロシアンセージ",         area:"Q" },
  { id:"txt_Q_105", name:"ジャーマンカモミール",   area:"Q" },
  { id:"txt_Q_106", name:"ブットレア",             area:"Q" },
  { id:"txt_Q_107", name:"メキシカンブッシュセージ",area:"Q" },
  { id:"txt_Q_108", name:"ラベンダーグロッソ",     area:"Q" },
  { id:"txt_Q_109", name:"セイヨウニンジンボク",   area:"Q" },
  { id:"txt_Q_110", name:"ローズマリー",           area:"Q" },
  { id:"txt_Q_111", name:"パンパスグラス",         area:"Q" },
  { id:"txt_R_112", name:"フレンチラベンダー",     area:"R" },
  { id:"txt_S_113", name:"タイム",                 area:"S" },
  { id:"txt_S_114", name:"サフラン",               area:"S" },
  { id:"txt_S_115", name:"ラムズイヤー",           area:"S" },
  { id:"txt_S_116", name:"ラベンダーグロッソ",     area:"S" },
  { id:"txt_T_117", name:"ニホンハッカ",           area:"T" },
  { id:"txt_T_118", name:"クールミント",           area:"T" },
  { id:"txt_T_119", name:"レモンミント",           area:"T" },
  { id:"txt_T_120", name:"カーリーミント",         area:"T" },
  { id:"txt_T_121", name:"パイナップルミント",     area:"T" },
  { id:"txt_T_122", name:"ラベンダーミント",       area:"T" },
  { id:"txt_T_123", name:"ベルガモットミント",     area:"T" },
  { id:"txt_T_124", name:"オレンジミント",         area:"T" },
  { id:"txt_T_125", name:"クラシックミント",       area:"T" },
  { id:"txt_T_126", name:"イングリッシュミント",   area:"T" },
  { id:"txt_T_127", name:"ホワイトミント",         area:"T" },
  { id:"txt_T_128", name:"スペアミント",           area:"T" },
  { id:"txt_T_129", name:"ウォーターミント",       area:"T" },
  { id:"txt_T_130", name:"イエルバブナ",           area:"T" },
  { id:"txt_U_131", name:"ブルーベリー",           area:"U" },
  { id:"txt_U_132", name:"ダイヤーズカモミール",   area:"U" },
  { id:"txt_U_133", name:"バラ",                   area:"U" },
  { id:"txt_U_134", name:"コモンセージ",           area:"U" },
  { id:"txt_U_135", name:"パープルセージ",         area:"U" },
  { id:"txt_U_136", name:"コーンフラワー",         area:"U" },
  { id:"txt_V_137", name:"ラベンダーグロッソ",     area:"V" },
  { id:"txt_V_138", name:"ティーツリー",           area:"V" },
  { id:"txt_V_139", name:"クリスマスローズ",       area:"V" },
  { id:"txt_V_140", name:"チェリーセージ",         area:"V" },
  { id:"txt_V_141", name:"サントリーナ(シルバー)", area:"V" },
  { id:"txt_V_142", name:"ツリージャーマンダー",   area:"V" },
  { id:"txt_W_143", name:"カレックス",             area:"W" },
  { id:"txt_W_144", name:"バラ",                   area:"W" },
  { id:"txt_W_145", name:"ホトトギス",             area:"W" },
  { id:"txt_W_146", name:"コウテイダリア",         area:"W" },
  { id:"txt_W_147", name:"ラベンダーグロッソ",     area:"W" },
  { id:"txt_W_148", name:"サントリーナ",           area:"W" },
  { id:"txt_W_149", name:"バラ(2)",                area:"W" },
  { id:"txt_W_150", name:"ゲッケイジュ",           area:"W" },
  { id:"txt_W_151", name:"メキシカンブッシュセージ",area:"W" },
  { id:"txt_W_152", name:"コモンマロー",           area:"W" },
  { id:"txt_W_153", name:"ラベンダーグロッソ(2)",  area:"W" },
  { id:"txt_W_154", name:"レモンバームエニシダ",   area:"W" },
]

// DBからplantsを全件取得
const res = await fetch(
  `${SUPABASE_URL}/rest/v1/plants?select=name,area,plant_no&order=area,plant_no`,
  { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
)
if (!res.ok) {
  console.error("Supabase fetch failed:", res.status, await res.text())
  process.exit(1)
}
const dbPlants = await res.json()

// エリアごとにグループ化
const byArea = {}
for (const p of dbPlants) {
  if (!byArea[p.area]) byArea[p.area] = []
  byArea[p.area].push(p)
}
const excelByArea = {}
for (const p of EXCEL_PLANTS) {
  if (!excelByArea[p.area]) excelByArea[p.area] = []
  excelByArea[p.area].push(p)
}

const allAreas = [...new Set([...Object.keys(byArea), ...Object.keys(excelByArea)])].sort()

let hasIssue = false
for (const area of allAreas) {
  const db = byArea[area] || []
  const excel = excelByArea[area] || []
  const dbNames = new Set(db.map(p => p.name))
  const excelNames = new Set(excel.map(p => p.name))

  // EXCEL名でDBにない（名前不一致候補）
  const unmatchedExcel = excel.filter(p => !dbNames.has(p.name))
  // DB名でEXCELにない（マーカー未登録）
  const unmatchedDb = db.filter(p => !excelNames.has(p.name))

  if (db.length !== excel.length || unmatchedExcel.length > 0) {
    hasIssue = true
    console.log(`\n=== エリア${area} ===`)
    console.log(`  DB: ${db.length}件  /  EXCEL: ${excel.length}件`)
    if (unmatchedExcel.length > 0) {
      console.log("  [EXCEL名→DBに存在しない（名前不一致候補）]")
      for (const p of unmatchedExcel) console.log(`    EXCEL: "${p.name}"`)
    }
    if (unmatchedDb.length > 0) {
      console.log("  [DBにあってEXCELにない（座標登録が必要）]")
      for (const p of unmatchedDb) console.log(`    DB No.${p.plant_no ?? "?"}: "${p.name}"`)
    }
  }
}
if (!hasIssue) console.log("\n✅ 全エリア問題なし")
