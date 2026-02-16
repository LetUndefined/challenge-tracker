/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_METACOPIER_API_URL: string
  readonly VITE_METACOPIER_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
