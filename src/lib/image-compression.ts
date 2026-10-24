// 写真を送る前に縮めるときの設定。マイノートの写真（photo-upload.ts）と、
// お知らせの画像（staff-image-upload.ts）で同じ値を使う。
// herb-garden 版はここだけ { maxSizeMB: 2, maxWidthOrHeight: 1920 } になっている。
export const COMPRESSION_OPTIONS = { maxSizeMB: 1, maxWidthOrHeight: 1200, useWebWorker: true }
