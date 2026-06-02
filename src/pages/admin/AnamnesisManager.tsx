import FormFieldEditor from "@/components/FormFieldEditor";

export default function AnamnesisManager() {
  return (
    <>
      <FormFieldEditor
        formType="anamnesis"
        title="ANAMNESE"
        subtitle="Editor do formulário de anamnese — o link individual é gerado por aluno após o cadastro"
        publicPath="/anamnese"
      />
    </>
  );
}
