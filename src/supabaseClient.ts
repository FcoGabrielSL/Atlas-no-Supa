import { createClient } from "@supabase/supabase-js";

const clientMeta = import.meta as any;
const SUPABASE_URL = clientMeta.env?.VITE_SUPABASE_URL || "https://ezebjlodizcjozsjbweq.supabase.co";
const SUPABASE_ANON_KEY = clientMeta.env?.VITE_SUPABASE_ANON_KEY || "sb_publishable_ThdEI0G6dw22Qvx2F-d-OQ_WABQQFWb";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
