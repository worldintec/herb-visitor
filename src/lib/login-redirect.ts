// ログイン画面へ移すための共通関数。
//
// 元いたページを ?redirect= で引き継ぐ。これが無いと、QRコードから来た
// 来園者がログインしたあとホームに飛ばされ、読み取った植物のページに
// たどり着けない。
//
// 戻り先の検証は受け取る側（ログイン画面）で safeRedirect() が行う。

/**
 * @param next 戻り先。省略時は現在のページ（パス＋クエリ）。
 *             「この画面ではなく一覧に戻したい」場合だけ明示する。
 */
export function toLogin(next?: string) {
  if (typeof window === "undefined") return
  const target = next ?? window.location.pathname + window.location.search
  window.location.href = `/login?redirect=${encodeURIComponent(target)}`
}
