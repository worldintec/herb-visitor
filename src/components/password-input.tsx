"use client"

import { useId, useState, type InputHTMLAttributes } from "react"
import { Eye, EyeOff } from "lucide-react"

/**
 * パスワードの入力欄。欄の中の右端に「目のマーク」を置き、押すと中身が見える。
 *
 * ・既定は隠す。マークを押すと見え、もう一度押すと隠れる（共有の端末で使う方がいるため、既定を見せる側にしない）
 * ・見える状態は覚えない。画面を移ると部品ごと作り直され、隠れた状態に戻る
 * ・マークは指で押せるよう 44×44px。押しても入力欄から指（フォーカス）が離れないようにし、
 *   スマホのキーボードが閉じないようにする
 * ・読み上げの名前は状態で切り替わる（「パスワードを表示」／「パスワードを隠す」）
 *
 * type 以外の属性（value・onChange・autoComplete・maxLength・id・className など）はそのまま入力欄に渡す。
 */
export default function PasswordInput({
  className = "",
  id,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false)
  const autoId = useId()
  const inputId = id ?? autoId

  return (
    <div className="relative">
      <input
        {...props}
        id={inputId}
        type={visible ? "text" : "password"}
        // 目のマークの分だけ、文字が右端まで来ないようにする
        className={`${className} pr-12`}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        // 押しても入力欄のフォーカスを外さない（スマホのキーボードを閉じない）
        onMouseDown={(e) => e.preventDefault()}
        aria-label={visible ? "パスワードを隠す" : "パスワードを表示"}
        aria-pressed={visible}
        aria-controls={inputId}
        className="absolute right-0 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-herb-text-secondary active:text-herb-primary"
      >
        {visible ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
      </button>
    </div>
  )
}
