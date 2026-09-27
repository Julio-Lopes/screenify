interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** Opcional: por padrão, o mesmo endereço da API */
  readonly VITE_WS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}