import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Loader2 } from "lucide-react";

// Questionários unificados: um seletor (dropdown) alterna entre Cadastro e Anamnese,
// em vez de duas abas separadas no menu.
const RegistrationManager = lazy(() => import("./RegistrationManager"));
const AnamnesisManager = lazy(() => import("./AnamnesisManager"));

export default function Questionarios() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "anamnese" ? "anamnese" : "cadastro";
  const setTab = (v: string) => {
    const p = new URLSearchParams(params);
    p.set("tab", v);
    setParams(p, { replace: true });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-2 font-mono-data text-sm font-semibold uppercase tracking-wide text-primary">
          <ClipboardList className="h-4 w-4" /> Questionário de
        </span>
        <Select value={tab} onValueChange={setTab}>
          <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="cadastro">Cadastro</SelectItem>
            <SelectItem value="anamnese">Anamnese</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
        {tab === "anamnese" ? <AnamnesisManager /> : <RegistrationManager />}
      </Suspense>
    </div>
  );
}
