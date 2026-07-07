/// <reference types="expo/types" />

// EXPO_PUBLIC_ vars are inlined by the bundler at build time. Keep this
// list in sync with .env.example.
declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
    EXPO_PUBLIC_API_URL?: string;
  }
}
