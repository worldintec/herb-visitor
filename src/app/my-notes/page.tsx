"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  Leaf,
  LogOut,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { getSessionId } from "@/lib/session"
import type { VisitorNote } from "@/types/database"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

function getNotePhotoUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/visitor-notes/${path}`
}

export default function MyNotesPage() {
  const router = useRouter()
  const [notes, setNotes] = useState<VisitorNote[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    if (!confirm("ログアウトしますか？")) return
    setLoggingOut(true)
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" })
      if (!res.ok) throw new Error("logout failed")
      // localStorage の自動ログアウトキーもクリア
      try { localStorage.removeItem("lastActivityAt") } catch {}
      router.replace("/login")
    } catch {
      alert("ログアウトに失敗しました。時間を置いてお試しください。")
      setLoggingOut(false)
    }
  }

  useEffect(() => {
    fetchNotes()
  }, [])

  async function fetchNotes() {
    const sessionId = getSessionId()
    if (!sessionId) {
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from("visitor_notes")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })

    if (data) setNotes(data)
    setLoading(false)
  }

  async function handleDelete(noteId: number) {
    if (!confirm("このノートを削除しますか？")) return
    setDeleting(noteId)

    const note = notes.find((n) => n.id === noteId)
    if (note?.photo_path) {
      await supabase.storage
        .from("visitor-notes")
        .remove([note.photo_path])
    }

    await supabase.from("visitor_notes").delete().eq("id", noteId)
    setNotes((prev) => prev.filter((n) => n.id !== noteId))
    setDeleting(null)
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`
  }

  return (
    <div className="min-h-dvh">
      {/* Header */}
      <div className="px-4 pt-8 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen size={20} className="text-herb-primary" />
            <h1 className="text-xl font-bold">マイノート</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/my-notes/new"
              className="flex items-center gap-1.5 bg-herb-primary text-white rounded-xl px-4 h-10 text-sm font-semibold shadow-md active:scale-[0.98] transition-transform"
            >
              <Plus size={16} />
              新規作成
            </Link>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex items-center gap-1 bg-white text-herb-text-secondary border border-herb-border rounded-xl px-3 h-10 text-xs font-medium hover:bg-rose-50 hover:text-rose-500 hover:border-rose-200 transition-colors disabled:opacity-50"
              aria-label="ログアウト"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">{loggingOut ? "..." : "ログアウト"}</span>
            </button>
          </div>
        </div>
        <p className="text-xs text-herb-text-secondary mt-2">
          訪問時のメモや観察記録を残せます
        </p>
      </div>

      {/* Notes List */}
      <div className="px-4 pb-6">
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-4 shadow-sm animate-pulse"
              >
                <div className="h-4 bg-green-100 rounded w-1/3 mb-2" />
                <div className="h-3 bg-green-50 rounded w-full mb-1" />
                <div className="h-3 bg-green-50 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <BookOpen size={32} className="text-green-300" />
            </div>
            <h2 className="font-semibold text-base mb-2">
              まだノートがありません
            </h2>
            <p className="text-sm text-herb-text-secondary mb-6">
              ハーブ園を散策しながら
              <br />
              気づいたことをメモしましょう
            </p>
            <Link
              href="/my-notes/new"
              className="inline-flex items-center gap-1.5 bg-herb-primary text-white rounded-xl px-6 h-12 text-sm font-semibold shadow-md"
            >
              <Plus size={16} />
              最初のノートを作成
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div
                key={note.id}
                className="bg-white rounded-2xl overflow-hidden shadow-sm"
              >
                {note.photo_path && (
                  <div className="aspect-[16/9] relative">
                    <Image
                      src={getNotePhotoUrl(note.photo_path)}
                      alt="ノートの写真"
                      fill
                      className="object-cover"
                      sizes="(max-width: 512px) 100vw, 480px"
                    />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      {note.plant_name && (
                        <span className="inline-flex items-center gap-1 bg-green-100 text-herb-primary rounded-full px-2 py-0.5 text-xs font-medium mb-1">
                          <Leaf size={10} />
                          {note.plant_name}
                        </span>
                      )}
                      <div className="flex items-center gap-1 text-xs text-herb-text-secondary">
                        <Calendar size={11} />
                        {formatDate(note.visit_date)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/my-notes/new?edit=${note.id}`}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-herb-text-secondary hover:bg-green-50 transition-colors"
                      >
                        <Pencil size={14} />
                      </Link>
                      <button
                        onClick={() => handleDelete(note.id)}
                        disabled={deleting === note.id}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-rose-400 hover:bg-rose-50 transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-herb-text leading-relaxed whitespace-pre-wrap">
                    {note.note_text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
