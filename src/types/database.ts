// /api/map-plots が返す形（MAP_PLOT_COLUMNS と同じ列）。テーブルには note・created_at もあるが返さない。
export interface MapPlot {
  id: string
  zone: string
  name: string
  type: 'herb' | 'flower' | 'vegetable' | 'tree' | 'other'
  x: number
  y: number
}

// /api/plants が返す形（PLANT_COLUMNS と同じ列）。テーブルには is_planted・created_at、
// 職員の編集記録（updated_at・updated_by）もあるが返さない。ここにも足さないこと。
// 型に無ければ、画面で使おうとした時点で型チェックが止まる。
export interface Plant {
  id: string
  name: string
  area: string
  plant_no: number | null
  category: string | null
  feature_flower: string | null
  feature_leaf: string | null
  scent: string | null
  herb_use: string | null
  caution: string | null
  care_point: string | null
}

// /api/plant-photos が返す形。テーブルには uploaded_by・uploaded_at もあるが返さない。
export interface PlantPhoto {
  // 実DBは uuid。以前 number と定義されていたのは誤り。
  id: string
  plant_name: string
  storage_path: string
  caption: string | null
}

export interface PlantPosition {
  /** /api/plant-positions は必ず返す。画面側では使っていないので optional のまま。 */
  id?: string
  area: string
  name: string
  x: number
  y: number
}

export interface ZoneOffset {
  zone: string
  dx: number
  dy: number
}

export interface VisitorNote {
  id: string
  user_id: string | null
  // 旧方式（端末ごとのlocalStorage ID）。互換のため保存は続けるが絞り込みには使わない
  session_id: string
  plant_id: string | null
  plant_name: string | null
  note_text: string
  /** 代表の写真のパス（visitor_note_photos の先頭と同じ。切り戻しのために書き続けている） */
  photo_path: string | null
  /** 写真の枚数（GET /api/visitor-notes が添える） */
  photo_count?: number
  /** 写真の id（並び順どおり。先頭が代表。移行前の1枚は null）。GET /api/visitor-notes が添える */
  photo_ids?: (string | null)[]
  visit_date: string
  created_at: string
  updated_at: string
}
