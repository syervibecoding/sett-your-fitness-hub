// Motor determinístico de prescrição (Fase D1).
export * from "./types";
export * from "./muscles";
export * from "./presets";
export * from "./volumeRules";
export * from "./restrictionRules";
export * from "./progressionRules";
export * from "./validator";
export { generatePrescription } from "./engine";
export { generatePrescriptionPdf, downloadPrescriptionPdf } from "./pdf";
export type { PrescriptionPdfMeta } from "./pdf";
