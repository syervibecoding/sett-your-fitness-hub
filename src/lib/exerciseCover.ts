// Helpers to derive video covers (thumbnails) and embeds for exercises.
// Free and dependency-free: YouTube exposes predictable thumbnail URLs by video id.

export function getYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    if (url.includes("youtube.com/watch")) {
      return new URL(url).searchParams.get("v");
    }
    if (url.includes("youtu.be/")) {
      return url.split("youtu.be/")[1]?.split(/[?&]/)[0] || null;
    }
    if (url.includes("youtube.com/embed/")) {
      return url.split("youtube.com/embed/")[1]?.split(/[?&]/)[0] || null;
    }
    if (url.includes("youtube.com/shorts/")) {
      return url.split("youtube.com/shorts/")[1]?.split(/[?&]/)[0] || null;
    }
  } catch {
    return null;
  }
  return null;
}

export function getVimeoId(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.includes("vimeo.com/")) {
    return url.split("vimeo.com/")[1]?.split(/[?&]/)[0] || null;
  }
  return null;
}

/**
 * Returns the best available cover image URL for an exercise.
 * Priority: explicit thumbnail_url > YouTube derived thumbnail > null.
 * (Vimeo has no key-free predictable thumbnail URL, so it falls back to null.)
 */
export function getExerciseCover(opts: {
  thumbnail_url?: string | null;
  video_url?: string | null;
}): string | null {
  if (opts.thumbnail_url && opts.thumbnail_url.trim() !== "") {
    return opts.thumbnail_url;
  }
  const ytId = getYouTubeId(opts.video_url);
  if (ytId) {
    return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
  }
  return null;
}

/** Normalizes a YouTube/Vimeo URL to an embeddable URL. */
export function getEmbedUrl(url: string): string {
  const ytId = getYouTubeId(url);
  if (ytId) return `https://www.youtube.com/embed/${ytId}`;
  const vimeoId = getVimeoId(url);
  if (vimeoId) return `https://player.vimeo.com/video/${vimeoId}`;
  return url;
}
