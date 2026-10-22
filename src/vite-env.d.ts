/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GREENIE_URL?: string
  readonly VITE_BASE_URL?: string
  [key: string]: string | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
