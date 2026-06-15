// youtube-exercise-video — resolve um vídeo do YouTube para um exercício (fallback enquanto não há
// vídeo gravado próprio). Faz scrape da página de busca do YouTube, pega o 1º videoId e CACHEIA em
// exercise_library.youtube_video_id. Idempotente: se já há cache, devolve. Sem API key do YouTube.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
// Opcional: se houver chave da YouTube Data API, usa a API (robusta) antes do scrape.
const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function hasValidUser(req: Request): Promise<boolean> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data, error } = await supa.auth.getClaims(auth.replace("Bearer ", ""));
  return !error && !!data?.claims?.sub;
}

// Robusto: YouTube Data API (precisa de YOUTUBE_API_KEY como secret). Retorna null se sem chave/erro.
async function resolveViaApi(query: string): Promise<string | null> {
  if (!YOUTUBE_API_KEY) return null;
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=1&relevanceLanguage=pt&regionCode=BR&q=${encodeURIComponent(query)}&key=${YOUTUBE_API_KEY}`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    return data?.items?.[0]?.id?.videoId ?? null;
  } catch (_e) {
    return null;
  }
}

async function resolveYoutubeId(query: string): Promise<string | null> {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=pt&gl=BR`;
  const resp = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    },
  });
  if (!resp.ok) return null;
  const html = await resp.text();
  // Primeiro videoId que aparece no ytInitialData (resultado mais relevante).
  const m = html.match(/"videoId":"([0-9A-Za-z_-]{11})"/);
  return m?.[1] ?? null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!(await hasValidUser(req))) return json({ error: "Unauthorized" }, 401);

  try {
    const { exercise_id, name } = await req.json();
    const exerciseName = typeof name === "string" ? name.trim() : "";
    if (!exerciseName && !exercise_id) return json({ error: "name ou exercise_id obrigatório" }, 400);

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    let resolvedName = exerciseName;
    // Cache + nome canônico via exercise_id.
    if (exercise_id) {
      const { data: ex } = await db.from("exercise_library").select("name, youtube_video_id").eq("id", exercise_id).maybeSingle();
      if ((ex as any)?.youtube_video_id) return json({ video_id: (ex as any).youtube_video_id, cached: true });
      if (!resolvedName && (ex as any)?.name) resolvedName = (ex as any).name;
    }
    if (!resolvedName) return json({ error: "Exercício sem nome para buscar." }, 400);

    let videoId: string | null = null;
    try {
      const q1 = `${resolvedName} execução técnica musculação`;
      // 1) API oficial (se houver chave) → robusta. 2) scrape como fallback.
      videoId = (await resolveViaApi(q1))
        || (await resolveYoutubeId(q1))
        || (await resolveViaApi(`${resolvedName} como fazer`))
        || (await resolveYoutubeId(`${resolvedName} como fazer`));
    } catch (_e) {
      videoId = null;
    }

    if (videoId && exercise_id) {
      await db.from("exercise_library").update({ youtube_video_id: videoId }).eq("id", exercise_id);
    }

    return json({ video_id: videoId, cached: false });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro inesperado" }, 500);
  }
});
