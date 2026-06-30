-- =====================================================================================
-- CURATION UPSERT SQL (GERADO POR build-curation-upsert-sql.mjs — ORDEM 036)
-- DO NOT RUN WITHOUT BACKUP + STAGING + ATENA APPROVAL
-- =====================================================================================
-- source:        docs/prescription/library-curation-v1-approved-manifest-p3.csv
-- mode:          noop
-- table:         public.exercise_metadata
-- total rows:    0
-- status:        NO_APPROVED_ROWS
-- generated_at:  2026-06-30T07:23:51.439Z
-- -------------------------------------------------------------------------------------
-- SCHEMA_GAP (campos do manifesto SEM coluna em exercise_metadata — NAO inventar coluna):
--   * equipment (vive em exercise_library.equipment, text unico; nao em exercise_metadata)
--   * muscle_group (sem coluna; insumo de curadoria)
--   * source_packages (sem coluna; bookkeeping)
--   * risk_regions (sem coluna; codificado em pain_limitation_tags)
--   * movement_patterns (sem coluna; insumo de curadoria)
--   * max_priority (sem coluna; bookkeeping)
--   * exercise_name (sem coluna; display/proveniencia -> vai em comentario)
--   * reviewer_name / reviewed_at (proveniencia -> dobrados em notes/comentario)
-- Colunas-alvo reais usadas: exercise_id, contraindications, pain_limitation_tags, regressions, progressions, equivalent_substitutes, notes
-- equivalent_substitutes e uuid[]: os NOMES sao resolvidos por subquery em exercise_library.
-- =====================================================================================

-- Nenhuma linha aprovada. Nada a aplicar. SEM INSERT/UPDATE/DELETE/ALTER/CREATE.

-- SELECT explicativo (read-only; nao altera dados):
SELECT
  'NO_APPROVED_ROWS' AS status,
  0 AS approved_rows_in_manifest,
  (SELECT count(*) FROM public.exercise_metadata) AS current_metadata_rows;
