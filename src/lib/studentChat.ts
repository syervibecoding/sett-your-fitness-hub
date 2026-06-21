// Primitivo compartilhado: "abrir o chat do aluno com uma mensagem pronta (rascunho)".
// Usado pelos botões de Aniversário, Renovação e Envio de anamnese. NÃO envia sozinho — só pré-preenche
// a caixa de texto do WhatsAppChat (que lê location.state.prefillMessage). Se o aluno não tiver conversa
// vinculada (whatsapp_chats), cai no fallback (copiar a mensagem pro clipboard).
import type { NavigateFunction } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// Mapa student_id -> chat_id (whatsapp_chats), escopo por empresa quando informado.
export async function buildStudentChatMap(companyId?: string | null): Promise<Record<string, string>> {
  let q = supabase.from("whatsapp_chats").select("id, student_id").not("student_id", "is", null);
  if (companyId) q = q.eq("company_id", companyId);
  const { data } = await q;
  const map: Record<string, string> = {};
  (data ?? []).forEach((c: any) => {
    if (c.student_id && !map[c.student_id]) map[c.student_id] = c.id;
  });
  return map;
}

function waDigits(phone?: string | null): string | null {
  if (!phone) return null;
  let d = String(phone).replace(/\D/g, "");
  if (!d) return null;
  if (d.length <= 11) d = "55" + d; // assume Brasil se vier sem DDI
  return d;
}

// Abre o chat do aluno com a mensagem pronta. Ordem do fallback:
// 1) conversa interna vinculada (chatId) → abre o WhatsAppChat com prefill;
// 2) sem conversa → abre o WhatsApp DIRETO pelo número (igual ao cadastro);
// 3) sem telefone → onNoChat (copia pro clipboard).
export async function openStudentChat(opts: {
  navigate: NavigateFunction;
  routePrefix: string;
  chatId?: string | null;
  studentId?: string | null;
  phone?: string | null;
  message: string;
  onNoChat?: (message: string) => void;
}): Promise<void> {
  const { navigate, routePrefix, chatId, studentId, phone, message, onNoChat } = opts;
  if (chatId) {
    navigate(`/${routePrefix}/whatsapp-chat`, { state: { chatId, prefillMessage: message } });
    return;
  }
  let digits = waDigits(phone);
  if (!digits && studentId) {
    const { data } = await supabase.from("students").select("whatsapp, phone").eq("id", studentId).maybeSingle();
    digits = waDigits((data as any)?.whatsapp || (data as any)?.phone);
  }
  if (digits) {
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
    return;
  }
  if (onNoChat) {
    onNoChat(message);
    return;
  }
  void navigator.clipboard?.writeText(message);
}

const firstName = (full?: string | null) => (full ?? "").trim().split(/\s+/)[0] || "";

// Link público de planos/checkout do aluno (PublicPayment já detecta renovação automaticamente).
export function plansLink(studentId: string): string {
  return `${window.location.origin}/pagamento/${studentId}`;
}

export function birthdayMessage(fullName?: string | null): string {
  const nome = firstName(fullName);
  return `Feliz aniversário, ${nome}! 🎉 Que esse novo ciclo venha cheio de saúde, energia e conquistas. Tamo junto pra você chegar nos seus objetivos. 💪`;
}

export function renewalMessage(opts: {
  fullName?: string | null;
  planName?: string | null;
  daysLeft?: number | null;
  studentId: string;
  overdue?: boolean;
}): string {
  const nome = firstName(opts.fullName);
  const plano = opts.planName ? ` ${opts.planName}` : "";
  const link = plansLink(opts.studentId);
  if (opts.overdue) {
    return `Oi, ${nome}! Seu plano${plano} venceu e seu acesso aos treinos pode ser interrompido. Pra regularizar e continuar evoluindo, é só renovar por aqui: ${link}`;
  }
  const prazo =
    typeof opts.daysLeft === "number"
      ? ` (faltam ${opts.daysLeft} ${opts.daysLeft === 1 ? "dia" : "dias"})`
      : "";
  return `Oi, ${nome}! Seu plano${plano} está chegando ao fim${prazo}. Pra continuar sem interromper seus treinos, renove por aqui: ${link}`;
}
