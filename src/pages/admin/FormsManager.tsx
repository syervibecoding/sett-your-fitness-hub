import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FormFieldEditor from "@/components/FormFieldEditor";

export default function FormsManager() {
  return (
    <Tabs defaultValue="registration" className="space-y-6">
      <TabsList>
        <TabsTrigger value="registration">Cadastro</TabsTrigger>
        <TabsTrigger value="anamnesis">Anamnese</TabsTrigger>
      </TabsList>

      <TabsContent value="registration">
        <FormFieldEditor
          formType="registration"
          title="CADASTRO"
          subtitle="Editor do formulário de cadastro — as alterações refletem no formulário público"
          publicPath="/cadastro"
        />
      </TabsContent>

      <TabsContent value="anamnesis">
        <FormFieldEditor
          formType="anamnesis"
          title="ANAMNESE"
          subtitle="Editor do formulário de anamnese — o link individual é gerado por aluno após o cadastro"
          publicPath="/anamnese"
        />
      </TabsContent>
    </Tabs>
  );
}
