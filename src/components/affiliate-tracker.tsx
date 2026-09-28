import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const KEY = "betfcom:ref";

/** Guarda ?ref=CODIGO, regista o clique uma vez e atribui o cadastro após entrar. */
export function AffiliateTracker() {
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref && /^[A-Za-z0-9]{4,16}$/.test(ref) && localStorage.getItem(KEY) !== ref) {
      localStorage.setItem(KEY, ref);
      void supabase.rpc("affiliate_track_click", { _code: ref });
    }
    const claim = async () => {
      const code = localStorage.getItem(KEY);
      if (!code) return;
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return;
      const { data, error } = await supabase.rpc("affiliate_claim", { _code: code });
      if (!error && data !== "unauthenticated") localStorage.removeItem(KEY);
    };
    void claim();
    const { data } = supabase.auth.onAuthStateChange((e) => {
      if (e === "SIGNED_IN") void claim();
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return null;
}
