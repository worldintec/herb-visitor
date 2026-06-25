/**
 * モバイルブラウザのピンチズーム（visual viewport の拡大・パン）を強制的に解除する。
 *
 * position: fixed の要素はレイアウトビューポート基準で配置されるため、
 * ピンチズーム中に開くモーダルやポップアップは実際に見えている範囲（visual viewport）と
 * ズレて見切れることがある。viewport meta の content を一瞬書き換えて戻すことで、
 * iOS Safari / Android Chrome にズームリセットを促す。
 *
 * ズームの解除はブラウザ側で非同期に適用されるため、リセット後の座標を使いたい場合は
 * onReset コールバックを渡し、その中で getBoundingClientRect 等を行うこと。
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
