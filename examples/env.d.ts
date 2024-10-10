/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BASE_URL: string
  // その他の環境変数をここに追加
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
