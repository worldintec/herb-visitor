import { Leaf } from "lucide-react"

// 園内の草木についてのお願い。利用規約の第9条を、規約を開かない人にも届ける。
//
// 文面はこのファイルだけが持つ。呼び出し側に文字列を書かないこと
// （植物ページのログイン前・ログイン後、ログイン画面の3箇所で同じ文にするため）。
//
// 植物ごとの caution（注意事項）は白いカード＋ローズ系で出している。
// こちらは個々の植物ではなく園全体のお願いなので、緑系の枠にして
// 意図的に見分けがつくようにしている。
//
// 閉じるボタンは付けない。常に出しておくもの。

const LINE_1 = "園内の草木はさいたま市の所有物です。"
const LINE_2 = "摘み取り・持ち帰り・傷つける行為はしないでください。"

export default function GardenRuleNotice({
  className = "",
}: {
  className?: string
}) {
  return (
    <div
      className={`flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2.5 ${className}`}
    >
      <Leaf size={16} className="text-green-600 shrink-0 mt-0.5" />
      <p className="text-xs text-green-800 leading-relaxed">
        {LINE_1}
        <br />
        {LINE_2}
      </p>
    </div>
  )
}
