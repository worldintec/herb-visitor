/**
 * モバイルブラウザのピンチズーム（visual viewport の拡大・パン）を強制的に解除する。
 *
 * Next.js のクライアント遷移はページをリロードしないため、ピンチズームした状態で
 * 別ページへ遷移すると遷移先もズームされたまま表示されてしまう。viewport meta の
 * content を一瞬書き換えて戻すことで、iOS Safari / Android Chrome にズームリセットを促す。
 *
 * ズームの解除はブラウザ側で非同期に適用されるため、リセット後の処理（ページ遷移など）を
 * 行いたい場合は onReset コールバックを渡すこと。
 */
export function resetPinchZoom(onReset?: () => void): void {
  if (typeof document === "undefined") {
    onReset?.()
    return
  }
  const meta = document.querySelector('meta[name="viewport"]')
  if (!meta) {
    onReset?.()
    return
  }

  const original = meta.getAttribute("content")
  if (!original) {
    onReset?.()
    return
  }

  meta.setAttribute("content", `${original}, maximum-scale=1, user-scalable=no`)
  requestAnimationFrame(() => {
    meta.setAttribute("content", original)
    requestAnimationFrame(() => onReset?.())
  })
}
