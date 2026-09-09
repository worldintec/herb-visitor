"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { ShieldCheck, LogOut, ArrowLeft, Bell, Calendar, Pencil, Trash2 } from "lucide-react"
import type { NewsCategory, NewsRow } from "@/data/news"

const NEWS_CATEGORIES: NewsCategory[] = ["イベント", "お知らせ", "更新情報"]

const CATEGORY_COLOR: Record<string, string> = {
  "イベント": "bg-amber-100 text-amber-600",
  "お知らせ": "bg-sky-100 text-sky-500",
  "更新情報": "bg-green-100 text-herb-primary",
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function StaffNewsPage() {
  const [checking, setChecking] = useState(true)
  const [staffUsername, setStaffUsername] = useState("")

  const [items, setItems] = useState<NewsRow[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  const [category, setCategory] = useState<NewsCategory>("お知らせ")
  const [publishedAt, setPublishedAt] = useState(today())
  const [title, setTitle] = useState("")
  const [summary, setSummary] = useState("")
  const [body, setBody] = useState("")
  const [isPublished, setIsPublished] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [notifyResult, setNotifyResult] = useState<{ sent: number; removed: number } | null>(
    null
  )

  useEffect(() => {
    fetch("/api/staff/me")
      .then((r) => r.json())
      .then(({ staff }) => {
        if (!staff) {
          window.location.href = "/staff/login"
          return
        }
        setStaffUsername(staff.staffUsername)
        setChecking(false)
      })
      .catch(() => {
        window.location.href = "/staff/login"
      })
  }, [])

  const loadList = useCallback(async () => {
    setLoadingList(true)
    setListError(null)
    try {
      const res = await fetch("/api/staff/news")
      const json = await res.json()
      if (!res.ok) {
        setListError(json.error || "取得に失敗しました")
        return
      }
      setItems(json.news || [])
    } catch {
      setListError("通信エラーが発生しました")
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    if (!checking) loadList()
  }, [checking, loadList])

  const handleLogout = async () => {
    await fetch("/api/staff/logout", { method: "POST" })
    window.location.href = "/staff/login"
  }

  const resetForm = () => {
    setEditingId(null)
    setNotifyResult(null)
    setCategory("お知らせ")
    setTitle("")
    setSummary("")
    setBody("")
    setIsPublished(false)
    setPublishedAt(today())
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setSubmitting(true)
    setSubmitError(null)
    setNotifyResult(null)
    try {
      const res = await fetch(editingId ? `/api/staff/news/${editingId}` : "/api/staff/news", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          title: title.trim(),
          summary: summary.trim(),
          body: body.trim(),
          publishedAt,
          isPublished,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setSubmitError(json.error || (editingId ? "更新に失敗しました" : "登録に失敗しました"))
        return
      }
      const saved = json.news as NewsRow
      setItems((prev) =>
        (editingId ? prev.map((it) => (it.id === saved.id ? saved : it)) : [saved, ...prev]).sort(
          (a, b) => (a.published_at < b.published_at ? 1 : -1)
        )
      )
      resetForm()
      // resetForm が通知結果を消すため、その後に設定する
      setNotifyResult(json.notification ?? null)
    } catch {
      setSubmitError("通信エラーが発生しました")
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (item: NewsRow) => {
    setEditingId(item.id)
    setCategory(item.category)
    setPublishedAt(item.published_at)
    setTitle(item.title)
    setSummary(item.summary)
    setBody(item.body)
    setIsPublished(item.is_published)
    setSubmitError(null)
    setNotifyResult(null)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleDelete = async (id: string) => {
    if (!confirm("このお知らせを削除しますか？")) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/staff/news/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        alert(json.error || "削除に失敗しました")
        return
      }
      setItems((prev) => prev.filter((it) => it.id !== id))
      if (editingId === id) resetForm()
    } catch {
      alert("通信エラーが発生しました")
    } finally {
      setDeletingId(null)
    }
  }

  if (checking) {
    return <div className="min-h-dvh bg-slate-100" />
  }

  return (
    <div className="min-h-dvh bg-slate-100">
      <div className="bg-slate-800 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <ShieldCheck size={20} />
          <div>
            <p className="font-bold text-sm">お知らせ管理</p>
            <p className="text-xs text-slate-300">{staffUsername}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1 text-slate-300 hover:text-white text-sm"
        >
          <LogOut size={16} />
          ログアウト
        </button>
      </div>

      <div className="px-4 sm:px-8 py-6 space-y-4">
        <Link
          href="/staff/dashboard"
          className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm"
        >
          <ArrowLeft size={16} />
          ダッシュボードに戻る
        </Link>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 space-y-3">
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <Bell size={14} />
            {editingId ? "お知らせを編集" : "新規お知らせ"}
          </label>

          <div className="flex gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as NewsCategory)}
              className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-slate-500"
            >
              {NEWS_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={publishedAt}
              onChange={(e) => setPublishedAt(e.target.value)}
              className="flex-1 h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-slate-500"
            />
          </div>

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="タイトル（必須）"
            className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-slate-500"
          />

          <input
            type="text"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="概要（一覧に表示される短い説明・任意）"
            className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-slate-500"
          />

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="本文（任意）"
            rows={8}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-slate-500 resize-none"
          />

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="w-4 h-4"
            />
            公開する（来園者向け /news に表示）
          </label>

          <p className="text-xs text-slate-500 leading-relaxed">
            {editingId
              ? "編集ではプッシュ通知は送信されません。"
              : "「公開する」にチェックを入れて登録すると、プッシュ通知も同時に送信されます。"}
          </p>

          {submitError && <p className="text-red-500 text-sm">{submitError}</p>}

          {notifyResult && (
            <p className="text-green-700 text-sm">
              プッシュ通知を {notifyResult.sent}件に送信しました
              {notifyResult.removed > 0 && `（無効な購読 ${notifyResult.removed}件を削除）`}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className="flex-1 h-10 rounded-lg bg-slate-800 text-white text-sm font-semibold disabled:opacity-50"
            >
              {submitting ? "送信中..." : editingId ? "更新する" : "登録する"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="h-10 px-4 rounded-lg border border-slate-300 text-slate-600 text-sm font-semibold"
              >
                キャンセル
              </button>
            )}
          </div>
        </form>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <p className="px-4 pt-3 pb-2 text-xs font-medium text-slate-500">お知らせ一覧</p>
          {listError && <p className="px-4 pb-3 text-red-500 text-sm">{listError}</p>}
          {loadingList ? (
            <p className="px-4 pb-4 text-slate-400 text-sm">読み込み中...</p>
          ) : items.length === 0 ? (
            <p className="px-4 pb-4 text-slate-400 text-sm">お知らせはまだありません</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {items.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-sm ${
                          CATEGORY_COLOR[item.category] ?? "bg-green-100 text-herb-primary"
                        }`}
                      >
                        {item.category}
                      </span>
                      <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
                        <Calendar size={10} />
                        {item.published_at}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-sm ${
                          item.is_published
                            ? "bg-green-100 text-green-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {item.is_published ? "公開中" : "非公開"}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                    {item.summary && (
                      <p className="text-xs text-slate-500 mt-0.5">{item.summary}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(item)}
                      aria-label="編集"
                      className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      aria-label="削除"
                      className="p-2 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
