export interface MapPlot {
  id: string
  zone: string
  name: string
  type: 'herb' | 'flower' | 'vegetable' | 'tree' | 'other'
  note: string | null
  x: number
  y: number
  created_at: string
}

export interface Plant {
  id: number
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
  is_planted: boolean
  created_at: string
}

export interface PlantPhoto {
  id: number
  plant_name: string
  storage_path: string
  caption: string | null
  uploaded_by: string | null
  uploaded_at: string
}

export interface PlantPosition {
  area: string
  name: string
  x: number
  y: number
}

export interface VisitorNote {
  id: number
  session_id: string
  plant_id: number | null
  plant_name: string | null
  note_text: string
  photo_path: string | null
  visit_date: string
  created_at: string
  updated_at: string
}
