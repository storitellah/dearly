/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly BASE_URL: string;
  readonly PROD: boolean;
  readonly DEV: boolean;
  readonly VITE_SITE_URL?: string;
  readonly VITE_BASE_PATH?: string;
  readonly VITE_DEPLOY_ENV?: string;
  readonly VITE_ENABLE_FEEDBACK?: string;
  readonly VITE_ENABLE_AI_ASSIST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
