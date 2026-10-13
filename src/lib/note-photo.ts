// マイノートの写真のURL。
//
// 公開バケットのURLを画面側で組み立てるのをやめ、アプリ自身のURLを返す。
// サーバー（/api/visitor-notes/[id]/photo）が毎回ノートの持ち主を確かめてから
// 中身を返すので、画面には Storage のパスも署名付きURLも渡らない。
//
// 一覧（my-notes/page.tsx）と新規・編集（my-notes/new/page.tsx）の2画面が使う。
// 以前は同じ名前の関数が両方の画面に別々に定義されていた。

export function getNotePhotoUrl(noteId: string): string {
  return `/api/visitor-notes/${noteId}/photo`
}
