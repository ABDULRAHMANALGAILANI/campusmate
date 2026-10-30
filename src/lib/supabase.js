import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL;

const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Fail early with a clear message if the .env file is missing.
if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing Supabase settings. Copy .env.example to .env and fill in " +
      "VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY."
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      // Fingerprint / face sign-in (passkeys). Still an
      // experimental Supabase feature, so it must be switched on.
      experimental: {
        passkey: true,
      },
    },
  }
);