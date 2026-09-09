"use client"

import { Suspense, useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import {
  ArrowLeft,
  Camera,
  Save,
  X,
  Loader2,
  Leaf,
  Search,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { getSessionId } from "@/lib/session"
import type { Plant, VisitorNote } from "@/types/database"
import imageCompression from "browser-image-compression"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

function getNotePhotoUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/visitor-notes/${path}`
}

export default function NewNotePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-herb-primary" />
        </div>
      }
    >
      <NewNoteContent />
    </Suspense>
  )
}

function NewNoteContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const editId = searchParams.get("edit")
  const presetPlantId = searchParams.get("plant_id")
  const presetPlantName = searchParams.get("plant_name")

  const [plants, setPlants] = useState<Plant[]>([])
  const [selectedPlantId, setSelectedPlantId] = useState(presetPlantId || "")
  const [selectedPlantName, setSelectedPlantName] = useState(
    presetPlantName || ""
  )
  const [plantSearch, setPlantSearch] = useState("")
  const [showPlantDropdown, setShowPlantDropdown] = useState(false)
  const [noteText, setNoteText] = useState("")
  const [visitDate, setVisitDate] = useState(
    new Date().toISOString().split("T")[0]
  )
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [existingPhotoPath, setExistingPhotoPath] = useState<string | null>(
    null
  )
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      // Fetch all planted plants for the dropdown
      const { data: plantData } = await supabase
        .from("plants")
        .select("*")
        .eq("is_planted", true)
        .order("name")

      if (plantData) setPlants(plantData)

      // If editing, fetch existing note
      if (editId) {
        const { data: note } = await supabase
          .from("visitor_notes")
          .select("*")
          .eq("id", editId)
          .single()

        if (note) {
          setSelectedPlantId(note.plant_id?.toString() || "")
          setSelectedPlantName(note.plant_name || "")
          setNoteText(note.note_text)
          setVisitDate(note.visit_date)
          if (note.photo_path) {
            setExistingPhotoPath(note.photo_path)
            setPhotoPreview(getNotePhotoUrl(note.photo_path))
          }
        }
      }

      setLoading(false)
    }
    init()
  }, [editId])

  const filteredPlants = plantSearch
    ? plants.filter((p) =>
        p.name.toLowerCase().includes(plantSearch.toLowerCase())
      )
    : plants

  function handlePlantSelect(plant: Plant) {
    setSelectedPlantId(plant.id.toString())
    setSelectedPlantName(plant.name)
    setPlantSearch("")
    setShowPlantDropdown(false)
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1200,
        useWebWorker: true,
      })

      setPhotoFile(compressed)
      const reader = new FileReader()
      reader.onload = (ev) => setPhotoPreview(ev.target?.result as string)
      reader.readAsDataURL(compressed)
    } catch {
      setPhotoFile(file)
      const reader = new FileReader()
      reader.onload = (ev) => setPhotoPreview(ev.target?.result as string)
      reader.readAsDataURL(file)
    }
  }

  function removePhoto() {
    setPhotoFile(null)
    setPhotoPreview(null)
    setExistingPhotoPath(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function handleSave() {
    if (!noteText.trim()) {
      alert("メモを入力してください")
      return
    }

    setSaving(true)
    const sessionId = getSessionId()

    try {
      let photoPath: string | null = existingPhotoPath

      // Upload new photo
      if (photoFile) {
        // Remove old photo if exists
        if (existingPhotoPath) {
          await supabase.storage
            .from("visitor-notes")
            .remove([existingPhotoPath])
        }

        const ext = photoFile.name.split(".").pop() || "jpg"
        const fileName = `${sessionId}/${Date.now()}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from("visitor-notes")
          .upload(fileName, photoFile)

        if (!uploadError) {
          photoPath = fileName
        }
      }

      const noteData = {
        session_id: sessionId,
        plant_id: selectedPlantId || null,
        plant_name: selectedPlantName || null,
        note_text: noteText.trim(),
        photo_path: photoPath,
        visit_date: visitDate,
      }

      const result = editId
        ? await supabase
            .from("visitor_notes")
            .update({ ...noteData, updated_at: new Date().toISOString() })
            .eq("id", editId)
        : await supabase.from("visitor_notes").insert(noteData)

      if (result.error) {
        console.error("DB save error:", result.error)
        alert(`保存に失敗しました: ${result.error.message}`)
        setSaving(false)
        return
      }

      alert(editId ? "ノートを更新しました" : "ノートを保存しました")
      router.push("/my-notes")
    } catch (err) {
      console.error("Save error:", err)
      alert(`保存に失敗しました: ${err instanceof Error ? err.message : "不明なエラー"}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-herb-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-dvh">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-herb-bg/95 backdrop-blur-md border-b border-herb-border px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-herb-text-secondary text-sm"
        >
          <ArrowLeft size={18} />
          戻る
        </button>
        <h1 className="font-bold text-sm">
          {editId ? "ノートを編集" : "新しいノート"}
        </h1>
        <button
          onClick={handleSave}
          disabled={saving || !noteText.trim()}
          className="flex items-center gap-1 bg-herb-primary text-white rounded-lg px-3 h-8 text-sm font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          {saving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          保存
        </button>
      </div>

      <div className="px-4 py-4 space-y-5">
        {/* Plant selector */}
        <div>
          <label className="text-sm font-semibold mb-2 block">
            ハーブを選択
          </label>
          {selectedPlantName ? (
            <div className="flex items-center gap-2 bg-green-50 rounded-xl p-3">
              <Leaf size={16} className="text-herb-primary flex-shrink-0" />
              <span className="text-sm font-medium flex-1">
                {selectedPlantName}
              </span>
              <button
                onClick={() => {
                  setSelectedPlantId("")
                  setSelectedPlantName("")
                }}
                className="text-herb-text-secondary"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-herb-text-secondary"
              />
              <input
                type="text"
                placeholder="ハーブ名を検索..."
                value={plantSearch}
                onChange={(e) => {
                  setPlantSearch(e.target.value)
                  setShowPlantDropdown(true)
                }}
                onFocus={() => setShowPlantDropdown(true)}
                className="w-full h-11 pl-9 pr-4 rounded-xl bg-white text-sm border border-herb-border focus:outline-none focus:ring-2 focus:ring-herb-primary/30"
              />
              {showPlantDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-herb-border shadow-lg max-h-48 overflow-y-auto z-10">
                  {filteredPlants.length === 0 ? (
                    <p className="p-3 text-sm text-herb-text-secondary text-center">
                      見つかりません
                    </p>
                  ) : (
                    filteredPlants.slice(0, 20).map((plant) => (
                      <button
                        key={plant.id}
                        onClick={() => handlePlantSelect(plant)}
                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-green-50 transition-colors border-b border-herb-border/50 last:border-b-0 flex items-center gap-2"
                      >
                        <Leaf
                          size={14}
                          className="text-green-400 flex-shrink-0"
                        />
                        <span>{plant.name}</span>
                        <span className="text-xs text-herb-text-secondary ml-auto">
                          エリア{plant.area}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Visit date */}
        <div>
          <label className="text-sm font-semibold mb-2 block">訪問日</label>
          <input
            type="date"
            value={visitDate}
            onChange={(e) => setVisitDate(e.target.value)}
            className="w-full h-11 px-4 rounded-xl bg-white text-sm border border-herb-border focus:outline-none focus:ring-2 focus:ring-herb-primary/30"
          />
        </div>

        {/* Note text */}
        <div>
          <label className="text-sm font-semibold mb-2 block">メモ</label>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="気づいたことや感想を書きましょう..."
            rows={6}
            className="w-full px-4 py-3 rounded-xl bg-white text-sm border border-herb-border focus:outline-none focus:ring-2 focus:ring-herb-primary/30 resize-none leading-relaxed"
          />
        </div>

        {/* Photo upload */}
        <div>
          <label className="text-sm font-semibold mb-2 block">写真</label>
          {photoPreview ? (
            <div className="relative rounded-2xl overflow-hidden">
              <Image
                src={photoPreview}
                alt="プレビュー"
                width={400}
                height={300}
                className="w-full h-48 object-cover"
              />
              <button
                onClick={removePhoto}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-32 rounded-2xl border-2 border-dashed border-herb-border bg-white flex flex-col items-center justify-center gap-2 text-herb-text-secondary active:bg-green-50 transition-colors"
            >
              <Camera size={24} />
              <span className="text-sm">写真を追加</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoChange}
            className="hidden"
          />
        </div>
      </div>
    </div>
  )
}
