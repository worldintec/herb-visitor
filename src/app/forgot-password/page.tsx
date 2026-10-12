import Link from "next/link"
import { ArrowLeft, KeyRound, MapPin, Clock, UserPlus, AlertTriangle } from "lucide-react"

// 窓口の分担に合わせた文言。
//   ・アプリの使い方、パスワードの再発行：見沼氷川公園の窓口（9:00〜17:00）
//   ・その他の手続き、個人情報に関わる問い合わせ：見沼自然公園　管理棟
//
// パスワードとIDで扱いが違うので、画面も見出しで分けている。
// パスワードは窓口で仮パスワードを発行できる（api/staff/issue-temp-password）。
// IDは職員の側からも調べる手段が無いので、あらためて登録してもらうしかない。
//
// 窓口では、来園者が告げたIDがその人のものかを確かめる手段が無い
// （本アプリは氏名も連絡先も記録していない）。それでも窓口発行とするのは
// 運用上の判断なので、ここの文言を変えるときは必ず確認すること。
//
// 同じ内容が src/data/guide.ts の account 節と src/app/login/page.tsx にもある。
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
          お忘れになったものによって、お手続きが異なります。
        </p>
      </div>

      <div className="px-4 py-6 space-y-4">
        {/* パスワードを忘れた場合 → 窓口で再発行 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
          <h2 className="flex items-center gap-2 text-base font-bold text-herb-text">
            <KeyRound size={18} className="text-herb-primary flex-shrink-0" />
            パスワードを忘れた場合
          </h2>
          <p className="text-sm text-herb-text leading-relaxed">
            <strong>見沼氷川公園の窓口</strong>で再発行できます。ご来園のうえ、職員に<strong>会員ID</strong>をお伝えください。
          </p>
          <p className="text-sm text-herb-text leading-relaxed">
            職員が仮パスワードを発行します。その仮パスワードでログインしたあと、新しいパスワードへの変更をお願いします（変更が完了するまで、ほかの画面はご利用いただけません）。
          </p>

          <div className="border-t border-herb-border pt-3 space-y-3">
            <div className="flex items-start gap-2">
              <MapPin size={18} className="text-herb-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-herb-text-secondary">窓口</p>
                <p className="text-sm text-herb-text">見沼氷川公園　管理棟（受付窓口）</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock size={18} className="text-herb-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-herb-text-secondary">受付時間</p>
                <p className="text-sm text-herb-text">9:00〜17:00</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-herb-text-secondary leading-relaxed">
            会員IDが分からない場合は、再発行ができません。下の「IDを忘れた場合」をご覧ください。
          </p>
        </div>

        {/* IDを忘れた場合 → あらためて会員登録 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
          <h2 className="flex items-center gap-2 text-base font-bold text-herb-text">
            <UserPlus size={18} className="text-herb-primary flex-shrink-0" />
            IDを忘れた場合
          </h2>
          <p className="text-sm text-herb-text leading-relaxed">
            IDは、職員の側からもお調べできません。大変お手数ですが、<strong>あらためて会員登録</strong>をお願いいたします。
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
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
        </div>

        <Link
          href="/login"
          className="block w-full h-11 rounded-full border border-herb-border text-herb-text-secondary font-medium text-sm text-center leading-[42px]"
        >
          ログイン画面に戻る
        </Link>
      </div>
    </div>
  )
}
