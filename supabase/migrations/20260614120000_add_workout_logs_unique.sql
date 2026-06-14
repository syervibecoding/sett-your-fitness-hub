-- QA fix (claude): impede duplicação de séries gravadas pelo autosave do StudentPortal.
-- Antes, saveCurrentLogs decidia insert-vs-update lendo `allLogs` (estado carregado no load,
-- nunca atualizado após insert) e a tabela não tinha UNIQUE → cada autosave re-inseria a série.
-- Com este índice + upsert(onConflict) no app, a gravação fica idempotente e à prova de corrida.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_workout_logs_entry
  ON public.workout_logs (student_id, workout_id, exercise_index, set_number, session_date);
