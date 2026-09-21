// ログイン後の戻り先（?redirect=）の検証。
//
// 戻り先はURLのクエリから来るため、来園者が読み取るQRコードに
// 「ログインしたら外部サイトへ飛ばす」値を仕込むことができてしまう。
// 同じサイト内のパスだけを許可し、それ以外はホームに落とす。
//
// 判定はこの関数だけに置くこと。画面ごとに別の判定を書かない。
export function safeRedirect(value: string | null | undefined): string {
  if (!value) return "/"

  // "https://…" や "javascript:…" のような絶対URL・スキーム付きを弾く
  if (!value.startsWith("/")) return "/"

  // "//evil.example" はブラウザが別ホストとして解釈する。
  // "/\evil.example" も同じ扱いをするブラウザがあるため両方弾く。
  if (value.startsWith("//") || value.startsWith("/\\")) return "/"

  // ログイン画面自身へは戻さない（ログイン直後にまたログイン画面が出てしまう）
  if (value === "/login" || value.startsWith("/login?") || value.startsWith("/login#")) {
    return "/"
  }

  return value
}
