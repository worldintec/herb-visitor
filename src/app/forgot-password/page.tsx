import Link from "next/link"
import { ArrowLeft, KeyRound, UserPlus, AlertTriangle, FileText } from "lucide-react"

// 文言は利用規約の第3条5項・6項と第8条4項に合わせている（src/lib/terms.ts）。
// 規約を直したらこの画面と src/data/guide.ts の account 節も直すこと。
//
// 「管理棟の窓口で仮パスワードをお渡しします」とは書かない。
// このアプリは氏名も連絡先も記録していないので、窓口に来た人が本当に
// その会員かを確かめる手段が無い。できない確認を約束しないための判断。
export default function ForgotPasswordPage() {
  return (
    <div className="min-h-dvh">
      <div className="hero-gradient px-5 pt-10 pb-6 rounded-b-3xl">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-white/80 text-sm mb-3"
        >
          <ArrowLeft size={18} />
          ログインに戻る
        </Link>
        <div className="flex items-center gap-2 mb-2">
          <KeyRound size={20} className="text-white" />
          <h1 className="text-xl font-bold text-white">IDまたはパスワードをお忘れの方</h1>
        </div>
        <p className="text-white/80 text-sm">
          ご本人を確かめる手がかりをお預かりしていないため、お調べしてお伝えすることができません。
        </p>
      </div>

      <div className="px-4 py-6 space-y-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
          <p className="text-sm text-herb-text leading-relaxed">
            本アプリは、IDとパスワードのほかに、ご本人を確かめる手がかりを一切お預かりしていません。氏名・メールアドレス・電話番号のいずれも登録時にいただいていないため、<strong>IDやパスワードをお調べしてお伝えすることはできません</strong>。
          </p>
          <p className="text-sm text-herb-text leading-relaxed">
            お手数ですが、あらためて会員登録をしてください。IDは同じものを使い直すことも、新しく決めることもできます。
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-2">
          <AlertTriangle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-herb-text leading-relaxed">
            あらためて登録した場合、それまでに保存したマイノートの記録と写真は引き継がれません。新しいIDとパスワードは、登録のときに必ずお控えください。
          </p>
        </div>

        <Link
          href="/register"
          className="flex items-center justify-center gap-2 w-full h-11 rounded-full bg-herb-primary text-white font-semibold text-sm"
        >
          <UserPlus size={18} />
          あらためて会員登録する
        </Link>

        <Link
          href="/login"
          className="block w-full h-11 rounded-full border border-herb-border text-herb-text-secondary font-medium text-sm text-center leading-[42px]"
        >
          ログイン画面に戻る
        </Link>

        <p className="text-center">
          <Link
            href="/terms"
            className="inline-flex items-center gap-1 text-xs text-herb-text-secondary underline underline-offset-2"
          >
            <FileText size={14} />
            利用規約（第3条）を読む
          </Link>
        </p>
      </div>
    </div>
  )
}
