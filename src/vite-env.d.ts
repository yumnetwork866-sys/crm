/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_META_BUSINESS_ID?: string;
  readonly VITE_WHATSAPP_WABA_ID?: string;
  readonly VITE_META_APP_ID?: string;
  readonly VITE_META_EMBEDDED_SIGNUP_CONFIG_ID?: string;
  readonly VITE_META_GRAPH_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
