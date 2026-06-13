// Pasta automática do aluno: lista os arquivos (relatórios de avaliação, mídias do WhatsApp
// que o professor baixou) e permite abrir/baixar e subir novos. Reutilizável no detalhe do aluno.
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, FileText, Download, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { listStudentFiles, saveStudentFile, signStudentFile, type StudentFile } from "@/lib/studentFiles";

const KIND_LABEL: Record<string, string> = {
  assessment_report: "Avaliação",
  whatsapp_media: "WhatsApp",
  other: "Arquivo",
};

export function StudentFilesPanel({ studentId, companyId }: { studentId: string; companyId: string }) {
  const [files, setFiles] = useState<StudentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFiles(await listStudentFiles(studentId));
    setLoading(false);
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  const onOpen = async (f: StudentFile) => {
    const url = await signStudentFile(f.file_path);
    if (url) window.open(url, "_blank");
    else toast.error("Não foi possível abrir o arquivo");
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    const { error } = await saveStudentFile({
      studentId, companyId, data: file, fileName: file.name,
      kind: "other", source: "upload", contentType: file.type, stampMs: Date.now(),
    });
    setUploading(false);
    if (error) toast.error("Erro ao enviar", { description: error });
    else { toast.success("Arquivo salvo na pasta"); load(); }
  };

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-eyebrow flex items-center gap-1.5"><FolderOpen className="h-3.5 w-3.5" /> Pasta do aluno</p>
          <label className="cursor-pointer">
            <input type="file" className="hidden" onChange={onUpload} disabled={uploading} />
            <span className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Enviar
            </span>
          </label>
        </div>

        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : files.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhum arquivo ainda. Relatórios de avaliação e mídias baixadas aparecem aqui automaticamente.</p>
        ) : (
          <div className="divide-y divide-border">
            {files.map((f) => (
              <button key={f.id} onClick={() => onOpen(f)} className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-muted/40 transition-colors rounded px-1">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{f.file_name}</p>
                  <p className="font-mono-data text-[11px] text-muted-foreground">{f.created_at?.slice(0, 10)}</p>
                </div>
                <Badge variant="secondary" className="text-[10px]">{KIND_LABEL[f.kind] ?? "Arquivo"}</Badge>
                <Download className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
