import { useCallback, useEffect, useMemo, useState } from "react";
import { Camera, ImageIcon, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ProgressPhoto = {
  id: string;
  student_id: string;
  photo_path: string;
  taken_at: string;
  notes: string | null;
  created_at: string;
  signedUrl?: string;
};

type ProgressPhotosPanelProps = {
  studentId: string;
  title?: string;
  compact?: boolean;
};

const BUCKET = "progress-photos";

export function ProgressPhotosPanel({
  studentId,
  title = "Fotos de progresso",
  compact = false,
}: ProgressPhotosPanelProps) {
  const { role } = useAuth();
  const { toast } = useToast();
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [takenAt, setTakenAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const canUpload = role === "student";

  const loadPhotos = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("progress_photos" as any)
      .select("*")
      .eq("student_id", studentId)
      .order("taken_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      setLoading(false);
      toast({
        title: "Erro ao carregar fotos",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    const rows = ((data || []) as ProgressPhoto[]);
    const signed = await Promise.all(
      rows.map(async (photo) => {
        const { data: signedData } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(photo.photo_path, 60 * 30);
        return { ...photo, signedUrl: signedData?.signedUrl };
      })
    );

    setPhotos(signed);
    setLoading(false);
  }, [studentId, toast]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  const emptyText = useMemo(() => {
    if (canUpload) return "Envie fotos frontais, laterais e posteriores para acompanhar evolução real.";
    return "Nenhuma foto de progresso enviada pelo aluno.";
  }, [canUpload]);

  const handleUpload = async (file: File | null) => {
    if (!file || !studentId) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Arquivo inválido", description: "Envie uma imagem.", variant: "destructive" });
      return;
    }

    setUploading(true);
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${studentId}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

    if (uploadError) {
      setUploading(false);
      toast({ title: "Erro ao enviar foto", description: uploadError.message, variant: "destructive" });
      return;
    }

    const { error: insertError } = await supabase.from("progress_photos" as any).insert({
      student_id: studentId,
      photo_path: path,
      taken_at: takenAt,
      notes: notes.trim() || null,
      metadata: { original_name: file.name, size: file.size, content_type: file.type },
    });

    if (insertError) {
      await supabase.storage.from(BUCKET).remove([path]);
      setUploading(false);
      toast({ title: "Erro ao registrar foto", description: insertError.message, variant: "destructive" });
      return;
    }

    setNotes("");
    setUploading(false);
    toast({ title: "Foto enviada" });
    loadPhotos();
  };

  const handleDelete = async (photo: ProgressPhoto) => {
    const { error } = await supabase.from("progress_photos" as any).delete().eq("id", photo.id);
    if (error) {
      toast({ title: "Erro ao remover foto", description: error.message, variant: "destructive" });
      return;
    }
    await supabase.storage.from(BUCKET).remove([photo.photo_path]);
    setPhotos((current) => current.filter((item) => item.id !== photo.id));
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className={compact ? "pb-3" : undefined}>
        <CardTitle className="font-display flex items-center gap-2 text-primary text-lg">
          <Camera className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canUpload && (
          <div className="rounded-xl border border-dashed border-border p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-3">
              <div className="space-y-2">
                <Label className="font-mono-data text-xs">Data</Label>
                <Input type="date" value={takenAt} onChange={(event) => setTakenAt(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="font-mono-data text-xs">Observação</Label>
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Ex: frente, perfil, costas, 6 semanas..."
                  className="min-h-10"
                />
              </div>
            </div>
            <Label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
              <Upload className="h-4 w-4" />
              {uploading ? "Enviando..." : "Enviar foto"}
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={uploading}
                onChange={(event) => handleUpload(event.target.files?.[0] || null)}
              />
            </Label>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="aspect-[3/4] rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : photos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center">
            <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground font-sans">{emptyText}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map((photo) => (
              <div key={photo.id} className="group overflow-hidden rounded-xl border border-border bg-muted">
                <div className="relative aspect-[3/4]">
                  {photo.signedUrl ? (
                    <img src={photo.signedUrl} alt="Foto de progresso" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <ImageIcon className="h-7 w-7 text-muted-foreground/50" />
                    </div>
                  )}
                  {canUpload && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute right-2 top-2 h-8 w-8 opacity-0 transition group-hover:opacity-100"
                      onClick={() => handleDelete(photo)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="space-y-1 p-2">
                  <p className="font-mono-data text-[11px] text-muted-foreground">
                    {new Date(`${photo.taken_at}T00:00:00`).toLocaleDateString("pt-BR")}
                  </p>
                  {photo.notes && <p className="line-clamp-2 text-xs text-foreground font-sans">{photo.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
