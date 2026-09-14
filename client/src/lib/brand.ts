/**
 * Naming and disclosure constants for the public portfolio demo.
 *
 * The original app belonged to a real employer. The public demo uses a
 * neutral product name, never a company name, and marks anything that
 * cannot be shown with an explicit label instead of inventing a substitute.
 */
export const PROGRAM_NAME = 'Vehicle & Parking Info'
export const PROGRAM_SHORT = 'Fleet Info'

/** Sentinel stored in the dataset for record-level values that are withheld */
export const REDACTED = '[redacted]'
export const REDACTED_LABEL = 'Redacted for public demo'
export const NOT_AVAILABLE_LABEL = 'Not available in public demo'
export const SYNTHETIC_LABEL = 'Synthetic data'
/** Canonical case-study page; kept as the demo's provenance link (no in-app banner) */
export const CASE_STUDY_URL = 'https://zijun.cloud/en/projects/vehicle-parking'

export const isRedacted = (v: unknown): boolean => v === REDACTED
