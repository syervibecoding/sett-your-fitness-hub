// Web Push (VAPID) — assinatura do navegador + persistência em push_subscriptions.
// A chave PÚBLICA é pública por design (a privada vive só nos secrets do Supabase).
import { supabase } from "@/integrations/supabase/client";

export const VAPID_PUBLIC_KEY = "BBziKkb2VoMAoy37QZn4kidieAM0mYWXCnpDoOSzgYF5BVMz5um4MxHOI2qcKpUlcFlZqmL8nAb8XdfNdz3gXgU";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function isPushEnabled(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    return !!(await reg.pushManager.getSubscription());
  } catch { return false; }
}

/** Pede permissão, assina e persiste. Retorna true se ficou ativo. */
export async function enablePush(userId: string, companyId: string | null): Promise<boolean> {
  if (!pushSupported()) return false;
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource }));
  const j = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!j.endpoint || !j.keys?.p256dh || !j.keys?.auth) return false;
  const { error } = await (supabase as any).from("push_subscriptions").upsert(
    { user_id: userId, company_id: companyId, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth },
    { onConflict: "endpoint" },
  );
  return !error;
}
