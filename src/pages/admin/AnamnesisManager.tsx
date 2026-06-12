import FormFieldEditor from "@/components/FormFieldEditor";
import { BnitoContextButton } from "@/components/BnitoFloatingAssistant";

export default function AnamnesisManager() {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <BnitoContextButton
          label="editor de anamnese"
          context="Editor de perguntas da anamnese publica usada para coletar restricoes, objetivo, dor, historico e contexto de treino."
          question="Quais perguntas de anamnese sao essenciais para melhorar a prescricao e reduzir risco?"
          text="BNITO da anamnese"
        />
      </div>
      <FormFieldEditor
        formType="anamnesis"
        title="ANAMNESE"
        subtitle="Editor do formulário de anamnese — o link individual é gerado por aluno após o cadastro"
        publicPath="/anamnese"
      />
    </div>
  );
}
