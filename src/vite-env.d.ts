/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_META_BUSINESS_ID?: string;
  readonly VITE_WHATSAPP_WABA_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
