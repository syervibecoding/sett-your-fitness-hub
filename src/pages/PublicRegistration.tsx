import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle } from "lucide-react";
import bnLogo from "@/assets/bn-logo.png";
import { formatCPF, formatCEP, formatPhone } from "@/lib/masks";
import { applyTheme } from "@/contexts/ThemeContext";

interface Plan {
  id: string;
  name: string;
  description: string | null;
  duration_weeks: number;
}

interface CompanyBranding {
  logo_url: string | null;
  platform_title: string;
  primary_color: string;
  background_color: string;
  card_color: string;
  text_color: string;
}

export default function PublicRegistration() {
  const { slug } = useParams<{ slug?: string }>();
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [branding, setBranding] = useState<CompanyBranding | null>(null);

  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [cpf, setCpf] = useState("");
  const [cep, setCep] = useState("");
  const [address, setAddress] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");

  // Resolve company from slug and load branding + plans
  useEffect(() => {
    const init = async () => {
      let resolvedCompanyId: string | null = null;

      if (slug) {
        const { data: company } = await supabase
          .from("companies")
          .select("id")
          .eq("slug", slug)
          .eq("is_active", true)
          .single();
        if (company) {
          resolvedCompanyId = company.id;
          setCompanyId(company.id);
        }
      }

      // Fallback: if no slug or slug not found, use first active company
      if (!resolvedCompanyId) {
        const { data: fallbackCompany } = await supabase
          .from("companies")
          .select("id")
          .eq("is_active", true)
          .order("created_at", { ascending: true })
          .limit(1)
          .single();
        if (fallbackCompany) {
          resolvedCompanyId = fallbackCompany.id;
          setCompanyId(fallbackCompany.id);
        }
      }

      // Load company branding
      if (resolvedCompanyId) {
        const { data: settings } = await supabase
          .from("platform_settings")
          .select("logo_url, platform_title, primary_color, background_color, card_color, text_color")
          .eq("company_id", resolvedCompanyId)
          .single();
        if (settings) {
          setBranding(settings);
          applyTheme(settings);
        }
      }

      // Load plans filtered by company
      let plansQuery = supabase.from("plans").select("id, name, description, duration_weeks").eq("is_active", true).order("name");
      if (resolvedCompanyId) {
        plansQuery = plansQuery.eq("company_id", resolvedCompanyId);
      }
      const { data: plansData } = await plansQuery;
      setPlans(plansData || []);
    };
    init();
  }, [slug]);

  const logoSrc = branding?.logo_url || bnLogo;
  const titleText = branding?.platform_title || "BN PERFORMANCE";

  const handleSubmit = async () => {
    if (!fullName || !birthDate || !cpf || !cep || !address || !addressNumber || !neighborhood || !city || !state || !whatsapp || !email || !selectedPlanId) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    if (!companyId) {
      toast({ title: "Erro ao identificar a empresa", description: "Recarregue a página e tente novamente.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.from("students").insert({
      full_name: fullName,
      birth_date: birthDate,
      email,
      phone: whatsapp,
      cpf: cpf.replace(/\D/g, ""),
      cep: cep.replace(/\D/g, ""),
      address,
      address_number: addressNumber,
      neighborhood,
      city,
      state,
      whatsapp: whatsapp.replace(/\D/g, ""),
      selected_plan_id: selectedPlanId,
      status: "pending",
      company_id: companyId,
    }).select("id").single();

    if (error) {
      setSaving(false);
      toast({ title: "Erro ao salvar cadastro", description: error.message, variant: "destructive" });
      return;
    }

    // Create Asaas customer
    try {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asaas-integration`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({
          action: "create-customer",
          studentId: data.id,
          name: fullName,
          email: email || undefined,
          cpfCnpj: cpf.replace(/\D/g, ""),
          mobilePhone: whatsapp.replace(/\D/g, ""),
          postalCode: cep.replace(/\D/g, ""),
          address,
          addressNumber,
          province: neighborhood,
          cityName: city,
          state,
        }),
      });
    } catch (err) {
      console.error("Erro ao criar cliente Asaas:", err);
    }

    setSaving(false);
    setStudentId(data.id);
    setDone(true);
  };

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-card border-border text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <CheckCircle className="h-16 w-16 text-primary mx-auto" />
            <h2 className="text-3xl text-primary">CADASTRO COMPLETO!</h2>
            <p className="text-muted-foreground font-sans">
              Agora finalize sua inscrição realizando o pagamento:
            </p>
            <Button
              className="w-full"
              onClick={() => window.location.href = `${window.location.origin}/pagamento/${studentId}`}
            >
              Ir para Pagamento →
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center space-y-3">
          <img src={logoSrc} alt={titleText} className="h-16 mx-auto" />
          <h1 className="text-4xl text-primary">CADASTRO {titleText}</h1>
          <p className="text-sm text-muted-foreground font-sans">Dados Pessoais</p>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-primary text-xl">DADOS PESSOAIS</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="font-sans">Nome Completo *</Label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Seu nome completo" />
            </div>
            <div className="space-y-2">
              <Label className="font-sans">Data de Nascimento *</Label>
              <Input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="font-sans">CPF *</Label>
              <Input value={cpf} onChange={e => setCpf(formatCPF(e.target.value))} placeholder="000.000.000-00" />
            </div>
            <div className="space-y-2">
              <Label className="font-sans">CEP *</Label>
              <Input value={cep} onChange={e => setCep(formatCEP(e.target.value))} placeholder="00000-000" />
            </div>
            <div className="space-y-2">
              <Label className="font-sans">Rua *</Label>
              <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Nome da rua" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-sans">Número *</Label>
                <Input value={addressNumber} onChange={e => setAddressNumber(e.target.value)} placeholder="Nº" />
              </div>
              <div className="space-y-2">
                <Label className="font-sans">Bairro *</Label>
                <Input value={neighborhood} onChange={e => setNeighborhood(e.target.value)} placeholder="Bairro" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-sans">Cidade *</Label>
                <Input value={city} onChange={e => setCity(e.target.value)} placeholder="Cidade" />
              </div>
              <div className="space-y-2">
                <Label className="font-sans">Estado *</Label>
                <Input value={state} onChange={e => setState(e.target.value)} placeholder="UF" maxLength={2} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-sans">WhatsApp *</Label>
              <Input value={whatsapp} onChange={e => setWhatsapp(formatPhone(e.target.value))} placeholder="(00) 00000-0000" />
            </div>
            <div className="space-y-2">
              <Label className="font-sans">Email *</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" />
            </div>
            <div className="space-y-2">
              <Label className="font-sans">Plano *</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger><SelectValue placeholder="Selecione um plano" /></SelectTrigger>
                <SelectContent>
                  {plans.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.duration_weeks} semanas)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleSubmit} disabled={saving}>
              {saving ? "Salvando..." : "Finalizar Cadastro"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
