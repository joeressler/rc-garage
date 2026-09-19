/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RECAPTCHA_SITE_KEY: string;
}

declare module '*.md?raw' {
  const content: string;
  export default content;
}
