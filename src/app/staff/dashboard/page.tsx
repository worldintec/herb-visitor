"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Search, ShieldCheck, LogOut, KeyRound, Copy, Check, Megaphone } from "lucide-react"

interface StaffUser {
  id: string
  user_id: string
  created_at: string
  last_login_at: string | null
  password_reset_required: boolean
}

export default function StaffDashboardPage() {
  const [checking, setChecking] = useState(true)
  const [staffUsername, setStaffUsername] = useState("")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<StaffUser[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const [confirmTarget, setConfirmTarget] = useState<StaffUser | null>(null)
  const [issuing, setIssuing] = useState(false)
  const [issuedFor, setIssuedFor] = useState<{ userCode: string; tempPassword: string } | null>(null)
  const [issueError, setIssueError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

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

  const handleSearch = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!query.trim()) {
      setResults([])
      return
    }
    setSearching(true)
    setSearchError(null)
    try {
      const res = await fetch(`/api/staff/search-user?query=${encodeURIComponent(query.trim())}`)
      const json = await res.json()
      if (!res.ok) {
        setSearchError(json.error || "検索に失敗しました")
        setResults([])
        return
      }
      setResults(json.users || [])
    } catch {
      setSearchError("通信エラーが発生しました")
    } finally {
      setSearching(false)
    }
  }, [query])

  const handleLogout = async () => {
    await fetch("/api/staff/logout", { method: "POST" })
    window.location.href = "/staff/login"
  }

  const openConfirm = (user: StaffUser) => {
    setIssueError(null)
    setIssuedFor(null)
    setConfirmTarget(user)
  }

  const handleIssue = async () => {
    if (!confirmTarget) return
    setIssuing(true)
    setIssueError(null)
    try {
      const res = await fetch("/api/staff/issue-temp-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: confirmTarget.id }),
      })
      const json = await res.json()
      if (!res.ok) {
        setIssueError(json.error || "発行に失敗しました")
        return
      }
      setIssuedFor({ userCode: json.userCode, tempPassword: json.tempPassword })
      setResults((prev) =>
        prev.map((u) => (u.id === confirmTarget.id ? { ...u, password_reset_required: true } : u))
      )
    } catch {
      setIssueError("通信エラーが発生しました")
    } finally {
      setIssuing(false)
    }
  }

  const handleCopy = async () => {
    if (!issuedFor) return
    try {
      await navigator.clipboard.writeText(issuedFor.tempPassword)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // クリップボードが使えない環境では無視（職員が画面を見て書き写す）
    }
  }

  const closeDialog = () => {
    setConfirmTarget(null)
    setIssuedFor(null)
    setIssueError(null)
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
            <p className="font-bold text-sm">職員用管理画面</p>
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
          href="/staff/news"
          className="flex items-center gap-3 bg-white rounded-xl p-4 shadow-sm border-2 border-herb-primary text-slate-800 active:scale-[0.98] transition-transform"
        >
          <Megaphone size={22} className="text-herb-primary flex-shrink-0" />
          <span className="min-w-0">
            <span className="block font-semibold text-sm">お知らせ管理</span>
            <span className="block text-xs text-slate-500 mt-0.5">
              お知らせの登録・編集と、来園者へのプッシュ通知の配信
            </span>
          </span>
        </Link>

        <form onSubmit={handleSearch} className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 space-y-3">
          <label className="block text-xs font-medium text-slate-500">ユーザーID検索</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ユーザーIDの一部を入力"
                className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-slate-500"
              />
            </div>
            <button
              type="submit"
              disabled={searching || !query.trim()}
              className="h-10 px-4 rounded-lg bg-slate-800 text-white text-sm font-semibold disabled:opacity-50"
            >
              検索
            </button>
          </div>
          {searchError && <p className="text-red-500 text-sm">{searchError}</p>}
        </form>

        {results.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 divide-y divide-slate-100">
            {results.map((user) => (
              <div key={user.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-slate-800 truncate">{user.user_id}</p>
                  <p className="text-xs text-slate-500">
                    登録日: {new Date(user.created_at).toLocaleDateString("ja-JP")}
                    {user.password_reset_required && (
                      <span className="ml-2 text-amber-600 font-medium">要パスワード変更</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => openConfirm(user)}
                  className="flex-shrink-0 flex items-center gap-1 h-9 px-3 rounded-lg bg-herb-primary text-white text-xs font-semibold"
                >
                  <KeyRound size={14} />
                  仮パスワード発行
                </button>
              </div>
            ))}
          </div>
        )}

        {!searching && query.trim() && results.length === 0 && !searchError && (
          <p className="text-center text-slate-400 text-sm py-4">該当するユーザーが見つかりませんでした</p>
        )}

      </div>

      {confirmTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center px-5 z-50">
          <div className="bg-white rounded-xl p-5 max-w-sm w-full space-y-4">
            {!issuedFor ? (
              <>
                <p className="font-semibold text-slate-800">仮パスワードを発行しますか？</p>
                <p className="text-sm text-slate-600">
                  対象ユーザー: <strong>{confirmTarget.user_id}</strong>
                  <br />
                  現在のパスワードは無効になり、新しい仮パスワードに置き換わります。
                </p>
                {issueError && <p className="text-red-500 text-sm">{issueError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={closeDialog}
                    className="flex-1 h-10 rounded-lg border border-slate-300 text-slate-600 text-sm font-semibold"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleIssue}
                    disabled={issuing}
                    className="flex-1 h-10 rounded-lg bg-herb-primary text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {issuing ? "発行中..." : "発行する"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="font-semibold text-slate-800">仮パスワードを発行しました</p>
                <p className="text-sm text-slate-600">
                  対象ユーザー: <strong>{issuedFor.userCode}</strong>
                  <br />
                  この画面を見て、来所者に仮パスワードを書き写してお渡しください（この画面を閉じると再表示できません）。
                </p>
                <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-3">
                  <span className="flex-1 text-center text-2xl font-mono font-bold tracking-widest text-slate-800">
                    {issuedFor.tempPassword}
                  </span>
                  <button onClick={handleCopy} className="text-slate-500 hover:text-slate-800">
                    {copied ? <Check size={18} /> : <Copy size={18} />}
                  </button>
                </div>
                <button
                  onClick={closeDialog}
                  className="w-full h-10 rounded-lg bg-slate-800 text-white text-sm font-semibold"
                >
                  閉じる
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
