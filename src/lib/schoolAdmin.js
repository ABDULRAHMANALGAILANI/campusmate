import { supabase } from "./supabase";


// =========================================================
// SCHOOL ADMIN SERVER CALLS
// Talks to the "school-admin" Edge Function, which holds the
// secret key needed to create accounts. Returns the data, or
// throws an Error with a message that can be shown on screen.
// =========================================================

export async function callSchoolAdmin(action, payload = {}) {
  const {
    data,
    error,
  } =
    await supabase.functions.invoke("school-admin", {
      body: { action, ...payload },
    });

  if (error) {
    let message =
      "Couldn't reach the CampusMate server. Check your internet connection and try again.";

    // The function sends back { error: "..." } with a reason.
    try {
      const body =
        await error.context?.json();

      if (body?.error) {
        message = body.error;
      }
    } catch {
      // keep the general message
    }

    if (error.context?.status === 404) {
      message =
        "The school-admin server function isn't set up yet. Deploy it in Supabase → Edge Functions.";
    }

    throw new Error(message);
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}
