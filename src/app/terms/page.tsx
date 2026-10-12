import { FileText } from "lucide-react"
import { TERMS_TEXT } from "@/lib/terms"

// 未ログインでも開ける（proxy.ts の PUBLIC_PATHS に "/terms" がある）。
// 登録前の人が読めないと意味がないため。
//
// 本文は src/lib/terms.ts の 1 箇所だけが持つ。ここに文言を書かないこと。
//
// 「戻る」は置いていない。この画面への入口は2つで、
//   ・会員登録画面から別タブで開く（履歴が無いので router.back() は効かない）
//   ・マイページから遷移する（ログイン済みなので下部タブで戻れる）
// どちらも戻り先を決め打ちする必要がない。
export const metadata = {
  title: "利用規約",
}

export default function TermsPage() {
  return (
    <div className="min-h-dvh">
      <div className="hero-gradient px-5 pt-10 pb-6 rounded-b-3xl">
        <div className="flex items-center gap-2 mb-2">
          <FileText size={20} className="text-white" />
          <h1 className="text-xl font-bold text-white">利用規約</h1>
        </div>
        <p className="text-white/80 text-sm">
          見沼氷川公園ハーブ園 来園者向けアプリ
        </p>
      </div>

      <div className="px-4 py-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="text-sm text-herb-text leading-relaxed whitespace-pre-wrap">
            {TERMS_TEXT}
          </div>
        </div>
      </div>
    </div>
  )
}
