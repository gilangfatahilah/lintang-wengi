/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** CARTO Basemaps key. Public by nature — it ships in every tile URL — so it is
   *  protected by a domain restriction in the CARTO dashboard, not by secrecy. */
  readonly VITE_CARTO_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
