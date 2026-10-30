import {
  useEffect,
  useState,
} from "react";

import { supabase } from "./supabase";


// Who is looking at the page (if anyone): { loading, user, role }
export function useAccount() {
  const [account, setAccount] = useState({ loading: true, user: null, role: "" });

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user || null;
      let role = "";

      if (user) {
        const { data: profile } =
          await supabase.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle();
        role = profile?.role || "student";
      }

      if (active) setAccount({ loading: false, user, role });
    });

    return () => {
      active = false;
    };
  }, []);

  return account;
}
