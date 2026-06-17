// Capa (thumbnail) do exercício + categorias do seletor estilo Mywellness.

const YT_RE = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([0-9A-Za-z_-]{11})/;

export function youtubeIdFromUrl(url?: string | null): string | null {
  if (!url) return null;
  const m = url.match(YT_RE);
  return m ? m[1] : null;
}

/** URL da "capa" (thumbnail do YouTube) a partir do youtube_video_id ou de uma video_url do YouTube. */
export function exerciseThumb(ex: {
  youtube_video_id?: string | null;
  video_url?: string | null;
}): string | null {
  const id = ex.youtube_video_id || youtubeIdFromUrl(ex.video_url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

export type ExerciseCategory = {
  id: string;
  label: string;
  /** dica curta exibida no chip ativo */
  hint?: string;
};

// Ordem dos chips (igual ao pedido + extras Fisio/Pliometria).
export const EXERCISE_CATEGORIES: ExerciseCategory[] = [
  { id: "mobilidade", label: "Mobilidade", hint: "mobilidade, estabilidade, foam roll" },
  { id: "controle_motor", label: "Controle Motor" },
  { id: "ativacao", label: "Ativação", hint: "mini band, tera band" },
  { id: "core", label: "Core" },
  { id: "performance", label: "Performance", hint: "reativos, wall drills, propulsão, med ball" },
  { id: "base", label: "Base", hint: "agachamento, terra…" },
  { id: "pesos_livres", label: "Pesos Livres" },
  { id: "peso_corporal", label: "Peso Corporal" },
  { id: "maquinas", label: "Máquinas" },
  { id: "fisioterapia", label: "Fisioterapia" },
  { id: "pliometria", label: "Pliometria" },
];
