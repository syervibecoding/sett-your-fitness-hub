import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, ClipboardList, AlertTriangle, TrendingUp, RefreshCw, Dumbbell, Clock, UserX } from "lucide-react";
import { format, addDays } from "date-fns";
import { AppLayout } from "@/components/AppLayout";
import { DashboardAlerts } from "@/components/DashboardAlerts";
import { useMaster } from "@/contexts/MasterContext";
import { useAuth } from "@/hooks/useAuth";
import { lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";

const LazyChart = lazy(() => import("recharts").then(mod => ({
  default: ({ data, colors }: { data: { name: string; count: number }[]; colors: string[] }) => (
    <mod.ResponsiveContainer width="100%" height={250}>
      <mod.BarChart data={data}>
        <mod.XAxis dataKey="name" tick={{ fill: "hsl(0,0%,45%)", fontSize: 12 }} />
        <mod.YAxis tick={{ fill: "hsl(0,0%,45%)", fontSize: 12 }} />
        <mod.Tooltip contentStyle={{ backgroundColor: "hsl(0,0%,100%)", border: "1px solid hsl(0,0%,88%)" }} labelStyle={{ color: "hsl(220,70%,25%)" }} />
        <mod.Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <mod.Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </mod.Bar>
      </mod.BarChart>
    </mod.ResponsiveContainer>
  )
})));

export default function AdminDashboard() {
  const { role, companyId } = useAuth();
  const { viewingCompany, isViewingCompany } = useMaster();
  const navigate = useNavigate();
  const routePrefix = role === "master" && isViewingCompany ? "admin" : role;
  const [stats, setStats] = useState({ totalStudents: 0, pendingStudents: 0, inactiveStudents: 0, trainers: 0 });
  const [planChart, setPlanChart] = useState<{ name: string; count: number }[]>([]);
  const [expiringContracts, setExpiringContracts] = useState<any[]>([]);
  const [missingWorkouts, setMissingWorkouts] = useState<any[]>([]);
  const [trainerMap, setTrainerMap] = useState<Record<string, string>>({});

  // For admin/coordinator/trainer: use their own companyId. For master impersonating: use viewingCompany.id. Master without impersonating: null (sees all via RLS).
  const effectiveCompanyId = role === "master" ? (isViewingCompany ? viewingCompany?.id : null) : companyId;

  useEffect(() => { loadData(); }, [effectiveCompanyId]);

  const loadData = async () => {
    const thirtyDaysFromNow = format(addDays(new Date(), 30), "yyyy-MM-dd");

    // Build queries with optional company filter
    let studentQuery = supabase.from("students").select("*", { count: "exact", head: true }).eq("status", "active");
    let pendingQuery = supabase.from("students").select("*", { count: "exact", head: true }).eq("status", "pending");
    let inactiveQuery = supabase.from("students").select("*", { count: "exact", head: true }).eq("status", "inactive");
    let enrollQuery = supabase.from("enrollments").select("plan_id, plans(name)");
    let expiringQuery = supabase.from("enrollments").select("*, trainer_id, students(full_name, status), plans(name)")
      .eq("status", "active").lte("end_date", thirtyDaysFromNow)
      .order("end_date", { ascending: true });

    if (effectiveCompanyId) {
      studentQuery = studentQuery.eq("company_id", effectiveCompanyId);
      pendingQuery = pendingQuery.eq("company_id", effectiveCompanyId);
      inactiveQuery = inactiveQuery.eq("company_id", effectiveCompanyId);
      enrollQuery = enrollQuery.eq("company_id", effectiveCompanyId);
      expiringQuery = expiringQuery.eq("company_id", effectiveCompanyId);
    }

    // Count trainers by cross-referencing company_members with user_roles
    let trainerCount = 0;
    if (effectiveCompanyId) {
      const { data: members } = await supabase.from("company_members").select("user_id").eq("company_id", effectiveCompanyId);
      if (members && members.length > 0) {
        const { count } = await supabase.from("user_roles").select("*", { count: "exact", head: true })
          .eq("role", "trainer").in("user_id", members.map(m => m.user_id));
        trainerCount = count || 0;
      }
    } else {
      const { count } = await supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "trainer");
      trainerCount = count || 0;
    }

    const [studentRes, pendingRes, inactiveRes, enrollRes, expiringRes] = await Promise.all([
      studentQuery,
      pendingQuery,
      inactiveQuery,
      enrollQuery,
      expiringQuery,
    ]);

    setStats({
      totalStudents: studentRes.count || 0,
      pendingStudents: pendingRes.count || 0,
      inactiveStudents: inactiveRes.count || 0,
      trainers: trainerCount,
    });

    if (enrollRes.data) {
      const planCounts: Record<string, { name: string; count: number }> = {};
      enrollRes.data.forEach((e: any) => {
        const name = e.plans?.name || "Sem plano";
        if (!planCounts[name]) planCounts[name] = { name, count: 0 };
        planCounts[name].count++;
      });
      setPlanChart(Object.values(planCounts).sort((a, b) => b.count - a.count));
    }

    setExpiringContracts(expiringRes.data || []);

    // Missing workouts: enrollments without training_start_date OR active cycles without workouts
    let cycleEnrollQuery = supabase.from("enrollments").select("id, training_start_date, trainer_id, students(full_name, assigned_trainer_id)").in("status", ["active", "awaiting_training"]) as any;
    if (effectiveCompanyId) cycleEnrollQuery = cycleEnrollQuery.eq("company_id", effectiveCompanyId);
    const { data: activeEnrolls } = await cycleEnrollQuery;
    const missing: any[] = [];
    if (activeEnrolls && activeEnrolls.length > 0) {
      activeEnrolls.forEach((e: any) => {
        const effectiveTrainer = e.students?.assigned_trainer_id || e.trainer_id;
        if (!e.training_start_date) {
          missing.push({ student_name: e.students?.full_name || "—", cycle_number: null, reason: "Sem data de treino", trainer_id: effectiveTrainer });
        }
      });
      const enrollsWithDate = activeEnrolls.filter((e: any) => e.training_start_date);
      if (enrollsWithDate.length > 0) {
        const enrollIds = enrollsWithDate.map((e: any) => e.id);
        const enrollInfoMap: Record<string, { name: string; trainer_id: string | null }> = {};
        enrollsWithDate.forEach((e: any) => { enrollInfoMap[e.id] = { name: e.students?.full_name || "—", trainer_id: e.students?.assigned_trainer_id || e.trainer_id }; });
        const { data: pendingCycles } = await supabase.from("training_cycles").select("*").in("enrollment_id", enrollIds).in("status", ["active", "upcoming"]);
        if (pendingCycles && pendingCycles.length > 0) {
          const cycleIds = pendingCycles.map((c: any) => c.id);
          const { data: workouts } = await supabase.from("workouts").select("cycle_id").in("cycle_id", cycleIds);
          const withWorkout = new Set((workouts || []).map((w: any) => w.cycle_id));
          pendingCycles.filter((c: any) => !withWorkout.has(c.id)).forEach((c: any) => {
            const info = enrollInfoMap[c.enrollment_id];
            missing.push({ student_name: info?.name || "—", cycle_number: c.cycle_number, reason: `Ciclo ${c.cycle_number} sem treino`, trainer_id: info?.trainer_id });
          });
        }
      }
    }
    const firstPerStudent = new Map<string, any>();
    missing.forEach(m => {
      const key = m.student_name;
      const existing = firstPerStudent.get(key);
      if (!existing || (m.cycle_number !== null && (existing.cycle_number === null || m.cycle_number < existing.cycle_number))) {
        firstPerStudent.set(key, m);
      }
    });
    setMissingWorkouts(Array.from(firstPerStudent.values()));

    // Fetch trainer names for both sections
    const allTrainerIds = new Set<string>();
    (expiringRes.data || []).forEach((e: any) => { if (e.trainer_id) allTrainerIds.add(e.trainer_id); });
    Array.from(firstPerStudent.values()).forEach((m: any) => { if (m.trainer_id) allTrainerIds.add(m.trainer_id); });
    if (allTrainerIds.size > 0) {
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", Array.from(allTrainerIds));
      const tMap: Record<string, string> = {};
      (profiles || []).forEach((p: any) => { tMap[p.user_id] = p.full_name || ""; });
      setTrainerMap(tMap);
    } else {
      setTrainerMap({});
    }
  };

  const chartColors = ["hsl(220, 70%, 25%)", "hsl(220, 60%, 35%)", "hsl(220, 50%, 45%)", "hsl(220, 40%, 55%)"];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl text-primary">DASHBOARD</h1>
          <p className="text-muted-foreground font-sans">
            {isViewingCompany ? `Visualizando: ${viewingCompany?.name}` : "Visão geral da consultoria"}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate(`/${routePrefix}/students?status=active`)}>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-3 rounded-lg bg-primary/10"><Users className="h-6 w-6 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground font-sans">{stats.totalStudents}</p>
                <p className="text-sm text-muted-foreground font-sans">Alunos Ativos</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border cursor-pointer hover:border-warning/50 transition-colors" onClick={() => navigate(`/${routePrefix}/students?status=pending`)}>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-3 rounded-lg bg-warning/10"><Clock className="h-6 w-6 text-warning" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground font-sans">{stats.pendingStudents}</p>
                <p className="text-sm text-muted-foreground font-sans">Alunos Pendentes</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border cursor-pointer hover:border-muted-foreground/50 transition-colors" onClick={() => navigate(`/${routePrefix}/students?status=inactive`)}>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-3 rounded-lg bg-muted"><UserX className="h-6 w-6 text-muted-foreground" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground font-sans">{stats.inactiveStudents}</p>
                <p className="text-sm text-muted-foreground font-sans">Alunos Inativos</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-3 rounded-lg bg-primary/10"><TrendingUp className="h-6 w-6 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground font-sans">{stats.trainers}</p>
                <p className="text-sm text-muted-foreground font-sans">Treinadores</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-primary text-xl">PLANOS MAIS VENDIDOS</CardTitle></CardHeader>
            <CardContent>
              {planChart.length > 0 ? (
                <Suspense fallback={<div className="h-[250px] flex items-center justify-center"><div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
                  <LazyChart data={planChart} colors={chartColors} />
                </Suspense>
              ) : (
                <p className="text-muted-foreground font-sans text-center py-8">Nenhuma matrícula registrada</p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-primary text-xl flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />RENOVAÇÃO
              </CardTitle>
            </CardHeader>
            <CardContent>
              {expiringContracts.length > 0 ? (
                <div className="space-y-3 max-h-[250px] overflow-auto">
                  {expiringContracts.map((contract: any) => {
                    const daysLeft = Math.ceil((new Date(contract.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={contract.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
                        <div>
                          <p className="text-foreground font-sans font-medium text-sm">{contract.students?.full_name}</p>
                          <p className="text-muted-foreground text-xs font-sans">{contract.plans?.name}</p>
                          {contract.trainer_id && trainerMap[contract.trainer_id] && (
                            <p className="text-muted-foreground/70 text-[11px] font-sans">Treinador: {trainerMap[contract.trainer_id]}</p>
                          )}
                        </div>
                        <span className={`text-xs font-sans font-medium px-2 py-1 rounded ${
                          daysLeft <= 7 ? "bg-destructive/20 text-destructive" :
                          daysLeft <= 15 ? "bg-warning/20 text-warning" : "bg-primary/20 text-primary"
                        }`}>
                          {daysLeft}d restantes
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground font-sans text-center py-8">Nenhuma renovação pendente</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sem treino no ciclo */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-destructive text-xl flex items-center gap-2">
              <Dumbbell className="h-5 w-5" />SEM TREINO NO CICLO
            </CardTitle>
          </CardHeader>
          <CardContent>
            {missingWorkouts.length > 0 ? (
              <div className="space-y-3 max-h-[250px] overflow-auto">
                {missingWorkouts.map((m: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                    <div>
                      <p className="text-foreground font-sans font-medium text-sm">{m.student_name}</p>
                      <p className="text-muted-foreground text-xs font-sans">{m.reason}</p>
                      {m.trainer_id && trainerMap[m.trainer_id] && (
                        <p className="text-muted-foreground/70 text-[11px] font-sans">Treinador: {trainerMap[m.trainer_id]}</p>
                      )}
                    </div>
                    <span className="text-xs font-sans font-medium px-2 py-1 rounded bg-destructive/20 text-destructive">Pendente</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground font-sans text-center py-8">Todos os ciclos ativos têm treino prescrito ✓</p>
            )}
          </CardContent>
        </Card>

        <DashboardAlerts />
      </div>
    </AppLayout>
  );
}
