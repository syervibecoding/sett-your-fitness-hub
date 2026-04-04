import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const studentId = "3cb1cfae-4eec-4b2c-957b-b26eaa906dbe";
  const companyId = "c051e80e-c10c-4522-a88a-e5da26a74d82";
  const cycleId = "dcc39078-d85f-4aee-8b02-5ec38c0dec39";
  const trainerId = "fdd9cea8-5b5a-4236-a2b0-e096a50502df";

  // Insert workouts
  const { data: workouts, error: wErr } = await supabase.from("workouts").insert([
    {
      name: "Treino A - Peito/Tríceps", cycle_id: cycleId, company_id: companyId, created_by: trainerId, sort_order: 1,
      exercises: [
        { exercise_id: "af9f3a0e-3260-4842-a0ac-da874cdda030", exercise_name: "Supino Reto Barra", sets: 4, reps: "10", rest_seconds: 120, notes: "Controlar descida 3s", set_types: ["warmup","normal","normal","normal"] },
        { exercise_id: "15968ffd-1b58-4859-b181-a8b9485a853c", exercise_name: "Elevação Lateral Halteres", sets: 3, reps: "12", rest_seconds: 60, set_types: ["normal","normal","normal"] },
        { exercise_id: "e1000001-0000-0000-0000-000000000008", exercise_name: "Rosca Direta", sets: 3, reps: "12", rest_seconds: 60, set_types: ["normal","normal","drop"] },
      ],
    },
    {
      name: "Treino B - Costas/Bíceps", cycle_id: cycleId, company_id: companyId, created_by: trainerId, sort_order: 2,
      exercises: [
        { exercise_id: "e1000001-0000-0000-0000-000000000007", exercise_name: "Puxada Frontal", sets: 4, reps: "10", rest_seconds: 90, set_types: ["warmup","normal","normal","normal"] },
        { exercise_id: "2345fdf0-2bb7-49c0-839d-1d1bfd3024f8", exercise_name: "Levantamento Terra", sets: 4, reps: "8", rest_seconds: 180, set_types: ["warmup","normal","normal","failure"] },
      ],
    },
    {
      name: "Treino C - Pernas", cycle_id: cycleId, company_id: companyId, created_by: trainerId, sort_order: 3,
      exercises: [
        { exercise_id: "3e192862-ed2e-4063-b6f9-13b433844cf8", exercise_name: "Agachamento Livre", sets: 5, reps: "8", rest_seconds: 180, set_types: ["warmup","warmup","normal","normal","normal"] },
        { exercise_id: "afcab7c3-ba4f-4178-946f-eea2e6969e93", exercise_name: "Leg Press 45", sets: 4, reps: "12", rest_seconds: 120, set_types: ["normal","normal","normal","drop"] },
      ],
    },
  ]).select("id, name");

  if (wErr) return new Response(JSON.stringify({ error: "workouts", details: wErr }), { status: 500, headers: corsHeaders });

  const waId = workouts![0].id;
  const wcId = workouts![2].id;

  // Insert workout logs
  const logs = [
    // Treino A - 30/03
    { student_id: studentId, workout_id: waId, exercise_index: 0, set_number: 1, weight: 40, reps_done: 12, set_type: "warmup", rpe: 5, completed: true, session_date: "2026-03-30" },
    { student_id: studentId, workout_id: waId, exercise_index: 0, set_number: 2, weight: 60, reps_done: 10, set_type: "normal", rpe: 7, completed: true, session_date: "2026-03-30" },
    { student_id: studentId, workout_id: waId, exercise_index: 0, set_number: 3, weight: 60, reps_done: 10, set_type: "normal", rpe: 8, completed: true, session_date: "2026-03-30" },
    { student_id: studentId, workout_id: waId, exercise_index: 0, set_number: 4, weight: 60, reps_done: 8, set_type: "normal", rpe: 9, completed: true, session_date: "2026-03-30" },
    { student_id: studentId, workout_id: waId, exercise_index: 1, set_number: 1, weight: 8, reps_done: 12, set_type: "normal", rpe: 7, completed: true, session_date: "2026-03-30" },
    { student_id: studentId, workout_id: waId, exercise_index: 1, set_number: 2, weight: 8, reps_done: 12, set_type: "normal", rpe: 8, completed: true, session_date: "2026-03-30" },
    { student_id: studentId, workout_id: waId, exercise_index: 1, set_number: 3, weight: 8, reps_done: 10, set_type: "normal", rpe: 9, completed: true, session_date: "2026-03-30" },
    { student_id: studentId, workout_id: waId, exercise_index: 2, set_number: 1, weight: 20, reps_done: 12, set_type: "normal", rpe: 7, completed: true, session_date: "2026-03-30" },
    { student_id: studentId, workout_id: waId, exercise_index: 2, set_number: 2, weight: 20, reps_done: 10, set_type: "normal", rpe: 8, completed: true, session_date: "2026-03-30" },
    { student_id: studentId, workout_id: waId, exercise_index: 2, set_number: 3, weight: 14, reps_done: 15, set_type: "drop", rpe: 9, completed: true, session_date: "2026-03-30" },
    // Treino C - 01/04
    { student_id: studentId, workout_id: wcId, exercise_index: 0, set_number: 1, weight: 40, reps_done: 10, set_type: "warmup", rpe: 4, completed: true, session_date: "2026-04-01" },
    { student_id: studentId, workout_id: wcId, exercise_index: 0, set_number: 2, weight: 60, reps_done: 8, set_type: "warmup", rpe: 6, completed: true, session_date: "2026-04-01" },
    { student_id: studentId, workout_id: wcId, exercise_index: 0, set_number: 3, weight: 80, reps_done: 8, set_type: "normal", rpe: 7, completed: true, session_date: "2026-04-01" },
    { student_id: studentId, workout_id: wcId, exercise_index: 0, set_number: 4, weight: 80, reps_done: 8, set_type: "normal", rpe: 8, completed: true, session_date: "2026-04-01" },
    { student_id: studentId, workout_id: wcId, exercise_index: 0, set_number: 5, weight: 80, reps_done: 6, set_type: "normal", rpe: 9, completed: true, session_date: "2026-04-01" },
    { student_id: studentId, workout_id: wcId, exercise_index: 1, set_number: 1, weight: 120, reps_done: 12, set_type: "normal", rpe: 7, completed: true, session_date: "2026-04-01" },
    { student_id: studentId, workout_id: wcId, exercise_index: 1, set_number: 2, weight: 120, reps_done: 12, set_type: "normal", rpe: 8, completed: true, session_date: "2026-04-01" },
    { student_id: studentId, workout_id: wcId, exercise_index: 1, set_number: 3, weight: 120, reps_done: 10, set_type: "normal", rpe: 9, completed: true, session_date: "2026-04-01" },
    { student_id: studentId, workout_id: wcId, exercise_index: 1, set_number: 4, weight: 80, reps_done: 15, set_type: "drop", rpe: 9, completed: true, session_date: "2026-04-01" },
  ];

  const { error: logErr } = await supabase.from("workout_logs").insert(logs);
  if (logErr) return new Response(JSON.stringify({ error: "logs", details: logErr }), { status: 500, headers: corsHeaders });

  // Insert sessions
  const { error: sessErr } = await supabase.from("workout_sessions").insert([
    { student_id: studentId, workout_id: waId, company_id: companyId, session_date: "2026-03-30", status: "completed", started_at: "2026-03-30T14:00:00Z", completed_at: "2026-03-30T15:15:00Z", duration_seconds: 4500, total_sets_prescribed: 10, total_sets_completed: 10, total_volume: 1726 },
    { student_id: studentId, workout_id: wcId, company_id: companyId, session_date: "2026-04-01", status: "completed", started_at: "2026-04-01T16:00:00Z", completed_at: "2026-04-01T17:30:00Z", duration_seconds: 5400, total_sets_prescribed: 9, total_sets_completed: 9, total_volume: 6280 },
  ]);
  if (sessErr) return new Response(JSON.stringify({ error: "sessions", details: sessErr }), { status: 500, headers: corsHeaders });

  // Insert anamnesis
  const { error: anaErr } = await supabase.from("anamnesis").insert({
    student_id: studentId, company_id: companyId,
    goals: "Hipertrofia e ganho de força", experience_level: "Intermediário",
    training_days: "5x por semana", session_duration: "60-90 minutos",
    health_conditions: "Nenhuma", medications: "Nenhum",
    injuries: "Leve desconforto no ombro direito (antigo)",
    sleep_quality: "Boa", sleep_hours: "7-8 horas", stress_level: "Moderado",
    nutrition: "Dieta flexível, foco em proteínas", hydration: "2-3 litros/dia",
    physical_activity_level: "Ativo", previous_experience: "2 anos de musculação",
    restrictions: "Evitar exercícios com impacto no ombro direito",
    profession: "Estudante", emergency_contact: "Maria Rodrigues - (81) 99999-1234",
  });

  // Update student
  await supabase.from("students").update({
    status: "active", gender: "male", neighborhood: "Centro",
    cep: "54110000", address_number: "123",
  }).eq("id", studentId);

  return new Response(JSON.stringify({ 
    success: true, 
    workouts: workouts?.map(w => w.name),
    logs_count: logs.length,
    anamnesis: anaErr ? "error" : "ok"
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
