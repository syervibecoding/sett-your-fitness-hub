import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Upload, Download, Trash2 } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";

interface StudentDocument {
  id: string;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  size: number | null;
  created_at: string;
}

interface Props {
  studentId: string;
  companyId: string;
}

const BUCKET = "student-documents";

function fmtDate(value: string) {
  try {
    const d = parseISO(value);
    return isValid(d) ? format(d, "dd MMM yyyy", { locale: ptBR }) : "—";
  } catch {
    return "—";
  }
}

function fmtSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function StudentDocuments({ studentId, companyId }: Props) {
  const { session } = useAuth();
  const { toast } = useToast();
  const [docs, setDocs] = useState<StudentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (studentId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("student_documents")
      .select("id, file_path, file_name, mime_type, size, created_at")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Erro ao carregar documentos", description: error.message, variant: "destructive" });
    } else {
      setDocs((data || []) as StudentDocument[]);
    }
    setLoading(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${companyId}/${studentId}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("student_documents").insert({
        student_id: studentId,
        file_path: path,
        file_name: file.name,
        mime_type: file.type || null,
        size: file.size,
        uploaded_by: session?.user.id ?? null,
      });
      if (insErr) throw insErr;
      toast({ title: "Documento enviado" });
      await load();
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err?.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDownload = async (doc: StudentDocument) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.file_path, 120);
    if (error || !data?.signedUrl) {
      toast({ title: "Erro ao gerar link", description: error?.message, variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const handleDelete = async (doc: StudentDocument) => {
    if (!confirm(`Remover "${doc.file_name}"?`)) return;
    const { error: sErr } = await supabase.storage.from(BUCKET).remove([doc.file_path]);
    if (sErr) {
      toast({ title: "Erro ao remover arquivo", description: sErr.message, variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("student_documents").delete().eq("id", doc.id);
    if (error) {
      toast({ title: "Erro ao remover registro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Documento removido" });
    await load();
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-primary text-lg">PASTA DO ALUNO</CardTitle>
          <p className="text-xs text-muted-foreground font-sans">Laudos e PDFs de avaliação (visível somente para a equipe).</p>
        </div>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} accept=".pdf,image/*,.doc,.docx" />
        <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          <Upload className="h-4 w-4 mr-1" />{uploading ? "Enviando…" : "Enviar documento"}
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : docs.length === 0 ? (
          <p className="text-muted-foreground font-sans text-sm py-4">Nenhum documento enviado.</p>
        ) : (
          <ul className="space-y-2">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-5 w-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{d.file_name}</p>
                    <p className="text-xs font-sans text-muted-foreground">{fmtDate(d.created_at)}{d.size ? ` · ${fmtSize(d.size)}` : ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => handleDownload(d)}><Download className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(d)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
