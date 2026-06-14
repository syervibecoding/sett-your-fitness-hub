// Painel de volume: volume-load por semana (barras) + volume por grupamento (pizza).
// Reutilizado no dashboard do aluno e na ficha do aluno no admin (mesmo shape do StatsCharts).
import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, PieChart as PieIcon } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  buildExerciseMeta, volumeLoadByWeek, volumeByMuscleGroup, type CycleLike,
} from "@/lib/volumeStats";

interface VolumeInsightsProps {
  allLogs: any[];
  cycles: CycleLike[];
  className?: string;
}

const PIE_COLORS = [
  "hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))", "#6366f1", "#14b8a6",
  "#f59e0b", "#ec4899", "#84cc16", "#06b6d4", "#a855f7", "#ef4444", "#22c55e",
];

export function VolumeInsights({ allLogs, cycles, className }: VolumeInsightsProps) {
  const meta = useMemo(() => buildExerciseMeta(cycles), [cycles]);
  const weekly = useMemo(() => volumeLoadByWeek(allLogs || []), [allLogs]);
  const byMuscle = useMemo(() => volumeByMuscleGroup(allLogs || [], meta), [allLogs, meta]);
  const totalVol = useMemo(() => byMuscle.reduce((s, m) => s + m.volume, 0), [byMuscle]);

  const hasData = weekly.length > 0 || byMuscle.length > 0;
  if (!hasData) {
    return (
      <Card className={`bg-card border-border border-dashed ${className ?? ""}`}>
        <CardContent className="p-8 text-center">
          <BarChart3 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground font-sans text-sm">Registre treinos para ver o volume.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${className ?? ""}`}>
      {/* Volume-load por semana */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-mono-data font-semibold text-muted-foreground uppercase tracking-wider">
              Volume-load por semana
            </h3>
          </div>
          <p className="text-[10px] text-muted-foreground font-sans mb-3">
            Soma de carga × repetições por semana (kg). Acompanha a progressão de volume.
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={48}
                  tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any, _n: any, p: any) => [
                    `${Number(v).toLocaleString("pt-BR")} kg · ${p?.payload?.sessions ?? 0} ${p?.payload?.sessions === 1 ? "dia" : "dias"}`,
                    "Volume-load",
                  ]}
                  labelFormatter={(l: any) => `Semana de ${l}`}
                />
                <Bar dataKey="volume" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Pizza por grupamento */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <PieIcon className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-mono-data font-semibold text-muted-foreground uppercase tracking-wider">
              Volume por grupamento
            </h3>
          </div>
          {byMuscle.length === 0 ? (
            <p className="text-xs text-muted-foreground font-sans">Sem dados de grupamento no período.</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byMuscle}
                    dataKey="volume"
                    nameKey="group"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={92}
                    paddingAngle={2}
                    stroke="hsl(var(--card))"
                  >
                    {byMuscle.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: any, n: any) => [
                      `${Number(v).toLocaleString("pt-BR")} kg (${totalVol > 0 ? Math.round((Number(v) / totalVol) * 100) : 0}%)`,
                      n,
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
