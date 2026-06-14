// Página: dashboard de evasão ("quem sumiu") — alunos em risco/renovação.
import { AtRiskStudents } from "@/components/admin/AtRiskStudents";

export default function Evasao() {
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <p className="text-eyebrow">Retenção</p>
        <h1 className="font-display text-2xl text-foreground leading-tight">Alunos em risco</h1>
        <p className="text-sm text-muted-foreground mt-1">Sinais unificados de evasão: sem treinar, pagamento atrasado, ciclo vencendo, sem treino ativo.</p>
      </div>
      <AtRiskStudents />
    </div>
  );
}
