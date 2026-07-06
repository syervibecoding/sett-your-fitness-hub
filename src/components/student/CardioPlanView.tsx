// Visualização do plano de cardio para o aluno (corrida/natação/ciclismo/triathlon).
// Carrega o plano mais recente do aluno (RLS garante acesso só ao próprio).
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Footprints,
  Waves,
  Bike,
  HeartPulse,
  Activity,
  Clock,
  MapPin,
  Route,
  AlertTriangle,
  Apple,
  Dumbbell,
  Info,
  Moon,
} from "lucide-react";

interface FcZone {
  min: number;
  max: number;
}
interface FcZones {
  fcmax?: number;
  fcrep?: number;
  fc_reserva?: number;
  estimated?: boolean;
  z1?: FcZone;
  z2?: FcZone;
  z3?: FcZone;
  z4?: FcZone;
  z5?: FcZone;
}
interface Session {
  day?: string;
  type?: string;
  title?: string;
  sport?: string;
  warmup_min?: number;
  main_min?: number;
  cooldown_min?: number;
  total_min?: number;
  distance_km?: number;
  zone?: string;
  fc_target?: string;
  intervals?: string | null;
  tss_estimado?: number;
  notes?: string;
}
interface Week {
  week_number?: number;
  type?: string;
  volume_km?: number;
  volume_hours?: number;
  tss_total_estimado?: number;
  focus?: string;
  sessions?: Session[];
}
interface CardioPlanRow {
  id: string;
  plan_name: string | null;
  sport: string | null;
  goal: string | null;
  model: string | null;
  duration_weeks: number | null;
  weeks: Week[] | null;
  fc_zones: FcZones | null;
  general_tips: string | null;
  warnings: string[] | null;
  complementary_strength: string[] | null;
  nutrition_alert: string | null;
  created_at: string;
}

const DAY_ORDER: Record<string, number> = {
  Segunda: 1,
  "Terça": 2,
  Terca: 2,
  Quarta: 3,
  Quinta: 4,
  Sexta: 5,
  "Sábado": 6,
  Sabado: 6,
  Domingo: 7,
};

// JS getDay(): 0=Domingo ... 6=Sábado → mapa para nossa ordem (1=Segunda..7=Domingo)
const JS_DAY_TO_ORDER: Record<number, number> = { 0: 7, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 };

function sportIcon(sport?: string | null) {
  const s = (sport || "").toLowerCase();
  if (s.includes("nata")) return Waves;
  if (s.includes("cicl") || s.includes("bike")) return Bike;
  if (s.includes("tri")) return Activity;
  if (s.includes("descanso")) return Moon;
  return Footprints;
}

function sportLabel(sport?: string | null) {
  const s = (sport || "").toLowerCase();
  if (s.includes("nata")) return "Natação";
  if (s.includes("cicl") || s.includes("bike")) return "Ciclismo";
  if (s.includes("tri")) return "Triathlon";
  if (s.includes("caminh")) return "Caminhada";
  if (s.includes("descanso")) return "Descanso";
  if (s.includes("corr")) return "Corrida";
  return sport || "Cardio";
}

export function CardioPlanView({ studentId }: { studentId: string }) {
  const [plan, setPlan] = useState<CardioPlanRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("running_plans")
        .select(
          "id, plan_name, sport, goal, model, duration_weeks, weeks, fc_zones, general_tips, warnings, complementary_strength, nutrition_alert, created_at"
        )
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setPlan((data as unknown as CardioPlanRow) || null);
      setLoading(false);
    })();
  }, [studentId]);

  if (loading) return null;

  if (!plan) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          <HeartPulse className="h-6 w-6 mx-auto mb-2 opacity-50" />
          Nenhum plano de cardio disponível ainda.
        </CardContent>
      </Card>
    );
  }

  const weeks = Array.isArray(plan.weeks) ? plan.weeks : [];
  const totalWeeks = plan.duration_weeks || weeks.length || 1;

  // Semana atual a partir do created_at
  const daysElapsed = Math.floor(
    (Date.now() - new Date(plan.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  const currentWeekNum = Math.min(Math.max(Math.floor(daysElapsed / 7) + 1, 1), totalWeeks);
  const progressPct = totalWeeks > 0 ? Math.round((currentWeekNum / totalWeeks) * 100) : 0;

  const currentWeek =
    weeks.find((w) => (w.week_number || 0) === currentWeekNum) ||
    weeks[currentWeekNum - 1] ||
    weeks[0];

  const sessions = Array.isArray(currentWeek?.sessions) ? [...currentWeek!.sessions!] : [];
  sessions.sort((a, b) => (DAY_ORDER[a.day || ""] || 99) - (DAY_ORDER[b.day || ""] || 99));

  const todayOrder = JS_DAY_TO_ORDER[new Date().getDay()];
  // Próximo treino = primeira sessão (não descanso) com dia >= hoje; senão a primeira ativa
  const activeSessions = sessions.filter((s) => (s.type || "").toLowerCase() !== "descanso");
  const nextSession =
    activeSessions.find((s) => (DAY_ORDER[s.day || ""] || 0) >= todayOrder) || activeSessions[0];

  const SportIcon = sportIcon(plan.sport);
  const fc = plan.fc_zones;
  const zoneRows: { key: string; label: string; z?: FcZone }[] = [
    { key: "z1", label: "Z1 · Recuperação", z: fc?.z1 },
    { key: "z2", label: "Z2 · Aeróbico base", z: fc?.z2 },
    { key: "z3", label: "Z3 · Limiar baixo", z: fc?.z3 },
    { key: "z4", label: "Z4 · Limiar anaeróbio", z: fc?.z4 },
    { key: "z5", label: "Z5 · Potência máxima", z: fc?.z5 },
  ];

  return (
    <div className="space-y-4">
      {/* Cabeçalho do plano */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <SportIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg leading-tight">
                  {plan.plan_name || "Plano de Cardio"}
                </CardTitle>
                {plan.goal && (
                  <p className="text-xs text-muted-foreground mt-0.5">{plan.goal}</p>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="secondary">{sportLabel(plan.sport)}</Badge>
            {plan.model && (
              <Badge variant="outline" className="capitalize">
                {plan.model}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Semana {currentWeekNum} de {totalWeeks}
            </span>
            <span>{progressPct}%</span>
          </div>
          <Progress value={progressPct} className="h-1.5" />
          {currentWeek?.focus && (
            <p className="text-xs text-muted-foreground pt-1">
              <span className="font-medium text-foreground">Foco da semana: </span>
              {currentWeek.focus}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Próximos treinos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Route className="h-4 w-4 text-primary" />
            Treinos da semana
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sessions.length === 0 && (
            <p className="text-sm text-muted-foreground">Sem sessões definidas para esta semana.</p>
          )}
          {sessions.map((s, i) => {
            const isRest = (s.type || "").toLowerCase() === "descanso";
            const isNext = !isRest && nextSession && s === nextSession;
            const SIcon = sportIcon(s.sport || plan.sport);
            if (isRest) {
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg border border-dashed border-border px-3 py-2 text-muted-foreground"
                >
                  <Moon className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-medium w-16 shrink-0">{s.day}</span>
                  <span className="text-xs">Descanso</span>
                </div>
              );
            }
            return (
              <div
                key={i}
                className={`rounded-lg border px-3 py-2.5 ${
                  isNext ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <SIcon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-foreground">{s.day}</span>
                      {isNext && (
                        <Badge variant="default" className="text-[10px] px-1.5 py-0">
                          Próximo
                        </Badge>
                      )}
                      {s.zone && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {s.zone}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium text-foreground mt-0.5">
                      {s.title || sportLabel(s.sport)}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                      {!!s.total_min && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {s.total_min} min
                        </span>
                      )}
                      {!!s.distance_km && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {s.distance_km} km
                        </span>
                      )}
                      {s.fc_target && (
                        <span className="flex items-center gap-1">
                          <HeartPulse className="h-3 w-3" />
                          {s.fc_target.replace(/^FC:\s*/i, "")}
                        </span>
                      )}
                    </div>
                    {s.intervals && (
                      <p className="text-xs text-foreground mt-1.5">
                        <span className="font-medium">Séries: </span>
                        {s.intervals}
                      </p>
                    )}
                    {s.notes && (
                      <p className="text-xs text-muted-foreground mt-1">{s.notes}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Zonas de FC */}
      {fc && (fc.z1 || fc.z2 || fc.fcmax) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <HeartPulse className="h-4 w-4 text-primary" />
              Zonas de Frequência Cardíaca
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {(fc.fcmax || fc.fcrep) && (
              <div className="flex gap-4 text-xs text-muted-foreground pb-1">
                {!!fc.fcmax && (
                  <span>
                    FC máx: <span className="text-foreground font-medium">{fc.fcmax} bpm</span>
                  </span>
                )}
                {!!fc.fcrep && (
                  <span>
                    FC repouso:{" "}
                    <span className="text-foreground font-medium">{fc.fcrep} bpm</span>
                  </span>
                )}
              </div>
            )}
            {zoneRows.map(
              (r) =>
                r.z && (
                  <div
                    key={r.key}
                    className="flex items-center justify-between text-xs border-b border-border/50 last:border-0 py-1"
                  >
                    <span className="text-muted-foreground">{r.label}</span>
                    <span className="text-foreground font-medium">
                      {r.z.min}–{r.z.max} bpm
                    </span>
                  </div>
                )
            )}
            {fc.estimated && (
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground pt-2">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                Valores estimados. Recomenda-se teste de esforço para maior precisão.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Avisos de segurança */}
      {Array.isArray(plan.warnings) && plan.warnings.length > 0 && (
        <Card className="border-destructive/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Alertas de segurança
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {plan.warnings.map((w, i) => (
                <li key={i} className="text-xs text-foreground flex items-start gap-2">
                  <span className="text-destructive mt-0.5">•</span>
                  {w}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Força complementar */}
      {Array.isArray(plan.complementary_strength) && plan.complementary_strength.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Dumbbell className="h-4 w-4 text-primary" />
              Força complementar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {plan.complementary_strength.map((c, i) => (
                <li key={i} className="text-xs text-foreground flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  {c}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Alerta nutricional */}
      {plan.nutrition_alert && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Apple className="h-4 w-4 text-primary" />
              Orientação nutricional
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-foreground whitespace-pre-line">{plan.nutrition_alert}</p>
          </CardContent>
        </Card>
      )}

      {/* Dicas gerais */}
      {plan.general_tips && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              Orientações gerais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-foreground whitespace-pre-line">{plan.general_tips}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
