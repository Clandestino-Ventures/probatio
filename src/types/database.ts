/**
 * PROBATIO — Supabase Database Types
 *
 * Auto-generated style types matching the Supabase public schema.
 * Provides Row, Insert, and Update variants for every table.
 */

// ────────────────────────────────────────────────────────────────────────────
// ENUMs
// ────────────────────────────────────────────────────────────────────────────

export type UserRole = "user" | "admin" | "expert";

export type PlanTier = "free" | "starter" | "professional" | "enterprise";

/** Pipeline status values. Includes both long-form (schema originals) and
 *  short-form (used by pipeline code) for backwards compatibility. */
export type AnalysisStatus =
  | "queued"
  | "pending"
  | "uploading"
  | "normalizing"
  | "fingerprinting"
  | "separating_stems"
  | "separating"
  | "extracting_features"
  | "extracting"
  | "generating_embeddings"
  | "extracting_lyrics"
  | "searching_matches"
  | "matching"
  | "enriching_rights"
  | "generating_report"
  | "classifying"
  | "completed"
  | "failed";

export type AnalysisMode = "screening" | "forensic" | "clearance";

export type RiskLevel = "low" | "medium" | "moderate" | "high" | "critical";

/** Forensic case status values. Includes both schema originals and
 *  UI-facing values for backwards compatibility. */
export type ForensicStatus =
  | "pending_payment"
  | "paid"
  | "processing"
  | "intake"
  | "in_review"
  | "expert_assigned"
  | "analysis_complete"
  | "report_generated"
  | "completed"
  | "failed"
  | "closed";

// ────────────────────────────────────────────────────────────────────────────
// Table helpers
// ────────────────────────────────────────────────────────────────────────────

/** Makes every key optional except `id`. */
type WithOptionalFields<T> = Partial<T>;

// ────────────────────────────────────────────────────────────────────────────
// profiles
// ────────────────────────────────────────────────────────────────────────────

export interface ProfileRow {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  plan_tier: PlanTier;
  organization: string | null;
  organization_id: string | null;
  license_number: string | null;
  preferred_lang: string;
  library_opt_in: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProfileInsert {
  id: string;
  email: string;
  display_name?: string | null;
  avatar_url?: string | null;
  role?: UserRole;
  plan_tier?: PlanTier;
  organization?: string | null;
  organization_id?: string | null;
  license_number?: string | null;
  preferred_lang?: string;
  library_opt_in?: boolean;
  created_at?: string;
  updated_at?: string;
}

export type ProfileUpdate = WithOptionalFields<ProfileInsert>;

// ────────────────────────────────────────────────────────────────────────────
// credits
// ────────────────────────────────────────────────────────────────────────────

export interface CreditRow {
  id: string;
  user_id: string;
  balance: number;
  lifetime_purchased: number;
  lifetime_used: number;
  last_replenished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreditInsert {
  id?: string;
  user_id: string;
  balance?: number;
  lifetime_purchased?: number;
  lifetime_used?: number;
  last_replenished_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type CreditUpdate = WithOptionalFields<CreditInsert>;

// ────────────────────────────────────────────────────────────────────────────
// subscriptions
// ────────────────────────────────────────────────────────────────────────────

export interface SubscriptionRow {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  plan_tier: PlanTier;
  status: "active" | "past_due" | "canceled" | "trialing" | "incomplete";
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionInsert {
  id?: string;
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  plan_tier: PlanTier;
  status?: "active" | "past_due" | "canceled" | "trialing" | "incomplete";
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end?: boolean;
  created_at?: string;
  updated_at?: string;
}

export type SubscriptionUpdate = WithOptionalFields<SubscriptionInsert>;

// ────────────────────────────────────────────────────────────────────────────
// analyses
// ────────────────────────────────────────────────────────────────────────────

export interface AnalysisRow {
  id: string;
  user_id: string;
  mode: AnalysisMode;
  status: AnalysisStatus;
  file_name: string;
  file_hash: string;
  file_size_bytes: number;
  audio_url: string | null;
  duration_seconds: number | null;
  pipeline_version: string | null;
  current_step: string | null;
  processing_time_ms: number | null;
  stems_urls: Record<string, string> | null;
  features: Record<string, unknown> | null;
  embeddings: Record<string, unknown> | null;
  results: Record<string, unknown> | null;
  report: Record<string, unknown> | null;
  overall_risk: RiskLevel | null;
  overall_score: number | null;
  match_count: number;
  output_hash: string | null;
  error_message: string | null;
  error_step: string | null;
  normalization_params: Record<string, unknown> | null;
  progress_pct: number;
  identified_track: Record<string, unknown> | null;
  normalized_audio_url: string | null;
  normalized_hash: string | null;
  normalization_metrics: Record<string, unknown> | null;
  lyrics_text: string | null;
  lyrics_language: string | null;
  detected_genre: string | null;
  genre_confidence: number | null;
  batch_id: string | null;
  catalog_ids: string[] | null;
  monitoring_enabled: boolean;
  last_monitored_at: string | null;
  monitoring_catalog_ids: string[] | null;
  clearance_status: string | null;
  audio_expires_at: string | null;
  audio_deleted_at: string | null;
  deletion_notified: boolean;
  deletion_notification_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnalysisInsert {
  id?: string;
  user_id: string;
  file_name: string;
  mode?: AnalysisMode;
  status?: AnalysisStatus;
  audio_url?: string | null;
  file_hash: string;
  file_size_bytes: number;
  duration_seconds?: number | null;
  pipeline_version?: string | null;
  current_step?: string | null;
  stems_urls?: Record<string, string> | null;
  features?: Record<string, unknown> | null;
  embeddings?: Record<string, unknown> | null;
  results?: Record<string, unknown> | null;
  report?: Record<string, unknown> | null;
  overall_risk?: RiskLevel | null;
  overall_score?: number | null;
  match_count?: number;
  output_hash?: string | null;
  error_message?: string | null;
  error_step?: string | null;
  normalization_params?: Record<string, unknown> | null;
  progress_pct?: number;
  identified_track?: Record<string, unknown> | null;
  normalized_audio_url?: string | null;
  normalized_hash?: string | null;
  normalization_metrics?: Record<string, unknown> | null;
  lyrics_text?: string | null;
  lyrics_language?: string | null;
  detected_genre?: string | null;
  genre_confidence?: number | null;
  batch_id?: string | null;
  catalog_ids?: string[] | null;
  monitoring_enabled?: boolean;
  last_monitored_at?: string | null;
  monitoring_catalog_ids?: string[] | null;
  clearance_status?: string | null;
  audio_expires_at?: string | null;
  audio_deleted_at?: string | null;
  deletion_notified?: boolean;
  created_at?: string;
  updated_at?: string;
}

export type AnalysisUpdate = WithOptionalFields<AnalysisInsert>;

// ────────────────────────────────────────────────────────────────────────────
// analysis_matches
// ────────────────────────────────────────────────────────────────────────────

export interface AnalysisMatchRow {
  id: string;
  analysis_id: string;
  reference_track_id: string;
  compared_analysis_id: string | null;
  similarity_score: Record<string, unknown>;
  overall_similarity: number;
  score_melody: number | null;
  score_harmony: number | null;
  score_rhythm: number | null;
  score_timbre: number | null;
  score_lyrics: number | null;
  score_overall: number | null;
  score_melody_adjusted: number | null;
  score_harmony_adjusted: number | null;
  score_rhythm_adjusted: number | null;
  score_timbre_adjusted: number | null;
  score_lyrics_adjusted: number | null;
  score_overall_adjusted: number | null;
  detected_genre: string | null;
  genre_confidence: number | null;
  risk_level: RiskLevel;
  timestamps_similarity: Record<string, unknown>[] | Record<string, unknown> | null;
  rights_info: Record<string, unknown> | null;
  action_recommended: string | null;
  match_source: "fingerprint" | "embedding" | "both" | "cross_analysis";
  created_at: string;
}

export interface AnalysisMatchInsert {
  id?: string;
  analysis_id: string;
  reference_track_id: string;
  compared_analysis_id?: string | null;
  similarity_score: Record<string, unknown>;
  overall_similarity: number;
  score_melody?: number | null;
  score_harmony?: number | null;
  score_rhythm?: number | null;
  score_timbre?: number | null;
  score_lyrics?: number | null;
  score_overall?: number | null;
  score_melody_adjusted?: number | null;
  score_harmony_adjusted?: number | null;
  score_rhythm_adjusted?: number | null;
  score_timbre_adjusted?: number | null;
  score_lyrics_adjusted?: number | null;
  score_overall_adjusted?: number | null;
  detected_genre?: string | null;
  genre_confidence?: number | null;
  risk_level: RiskLevel;
  timestamps_similarity?: Record<string, unknown> | null;
  rights_info?: Record<string, unknown> | null;
  action_recommended?: string | null;
  match_source?: "fingerprint" | "embedding" | "both" | "cross_analysis";
  created_at?: string;
}

export type AnalysisMatchUpdate = WithOptionalFields<AnalysisMatchInsert>;

// ────────────────────────────────────────────────────────────────────────────
// match_evidence
// ────────────────────────────────────────────────────────────────────────────

export interface MatchEvidenceRow {
  id: string;
  match_id: string;
  source_start_sec: number;
  source_end_sec: number;
  target_start_sec: number;
  target_end_sec: number;
  dimension: string;
  similarity_score: number;
  detail: Record<string, unknown>;
  description: string | null;
  resolution: "bar" | "phrase" | "song";
  created_at: string;
}

export interface MatchEvidenceInsert {
  id?: string;
  match_id: string;
  source_start_sec: number;
  source_end_sec: number;
  target_start_sec: number;
  target_end_sec: number;
  dimension: string;
  similarity_score: number;
  detail?: Record<string, unknown>;
  description?: string | null;
  resolution?: "bar" | "phrase" | "song";
  created_at?: string;
}

export type MatchEvidenceUpdate = WithOptionalFields<MatchEvidenceInsert>;

// ────────────────────────────────────────────────────────────────────────────
// reference_tracks
// ────────────────────────────────────────────────────────────────────────────

export interface ReferenceTrackRow {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  isrc: string | null;
  release_year: number | null;
  genre: string | null;
  fingerprint: string | null;
  duration_seconds: number | null;
  source: string;
  visibility: "public" | "enterprise" | "private";
  organization_id: string | null;
  contributed_by: string | null;
  catalog_id: string | null;
  embedding: number[] | null;
  embedding_vocals: number[] | null;
  lyrics_embedding: number[] | null;
  acoustid: string | null;
  musicbrainz_id: string | null;
  publisher: string | null;
  composer: string | null;
  pro_registration: string | null;
  fingerprinted: boolean;
  status: "pending" | "processing" | "completed" | "failed";
  features_json: Record<string, unknown> | null;
  lyrics_text: string | null;
  lyrics_language: string | null;
  audio_url: string | null;
  error_message: string | null;
  created_at: string;
}

export interface ReferenceTrackInsert {
  id?: string;
  title: string;
  artist: string;
  album?: string | null;
  isrc?: string | null;
  release_year?: number | null;
  genre?: string | null;
  fingerprint?: string | null;
  duration_seconds?: number | null;
  source: string;
  visibility?: "public" | "enterprise" | "private";
  organization_id?: string | null;
  contributed_by?: string | null;
  catalog_id?: string | null;
  embedding?: number[] | null;
  embedding_vocals?: number[] | null;
  lyrics_embedding?: number[] | null;
  acoustid?: string | null;
  musicbrainz_id?: string | null;
  publisher?: string | null;
  composer?: string | null;
  pro_registration?: string | null;
  fingerprinted?: boolean;
  status?: "pending" | "processing" | "completed" | "failed";
  features_json?: Record<string, unknown> | null;
  lyrics_text?: string | null;
  lyrics_language?: string | null;
  audio_url?: string | null;
  error_message?: string | null;
  created_at?: string;
}

export type ReferenceTrackUpdate = WithOptionalFields<ReferenceTrackInsert>;

// ────────────────────────────────────────────────────────────────────────────
// forensic_cases
// ────────────────────────────────────────────────────────────────────────────

export interface ForensicCaseRow {
  id: string;
  user_id: string;
  case_name: string;
  case_description: string | null;
  parties_involved: string | null;
  track_a_analysis_id: string | null;
  track_b_analysis_id: string | null;
  forensic_comparison: Record<string, unknown> | null;
  forensic_similarity: Record<string, unknown> | null;
  status: ForensicStatus;
  stripe_payment_intent_id: string | null;
  evidence_package_url: string | null;
  chain_of_custody: Record<string, unknown>[] | null;
  pipeline_version: string | null;
  archived_at: string | null;
  archived_by: string | null;
  audio_deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ForensicCaseInsert {
  id?: string;
  user_id: string;
  case_name: string;
  case_description?: string | null;
  parties_involved?: string | null;
  track_a_analysis_id?: string | null;
  track_b_analysis_id?: string | null;
  forensic_comparison?: Record<string, unknown> | null;
  forensic_similarity?: Record<string, unknown> | null;
  status?: ForensicStatus;
  stripe_payment_intent_id?: string | null;
  evidence_package_url?: string | null;
  chain_of_custody?: Record<string, unknown>[] | null;
  pipeline_version?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type ForensicCaseUpdate = WithOptionalFields<ForensicCaseInsert>;

// ────────────────────────────────────────────────────────────────────────────
// expert_annotations
// ────────────────────────────────────────────────────────────────────────────

export interface ExpertAnnotationRow {
  id: string;
  forensic_case_id: string;
  analysis_id: string | null;
  annotator_id: string;
  annotation_text: string;
  timestamp_ref: string | null;
  layer: MatchDimension | "general";
  created_at: string;
  updated_at: string;
}

export interface ExpertAnnotationInsert {
  id?: string;
  forensic_case_id: string;
  analysis_id?: string | null;
  annotator_id: string;
  annotation_text: string;
  timestamp_ref?: string | null;
  layer?: MatchDimension | "general";
  created_at?: string;
  updated_at?: string;
}

export type ExpertAnnotationUpdate = WithOptionalFields<ExpertAnnotationInsert>;

// ────────────────────────────────────────────────────────────────────────────
// credit_usage
// ────────────────────────────────────────────────────────────────────────────

export interface CreditUsageRow {
  id: string;
  user_id: string;
  analysis_id: string | null;
  action: string;
  amount: number;
  balance_after: number;
  description: string | null;
  created_at: string;
}

export interface CreditUsageInsert {
  id?: string;
  user_id: string;
  analysis_id?: string | null;
  action: string;
  amount: number;
  balance_after: number;
  description?: string | null;
  created_at?: string;
}

export type CreditUsageUpdate = WithOptionalFields<CreditUsageInsert>;

// ────────────────────────────────────────────────────────────────────────────
// audit_log
// ────────────────────────────────────────────────────────────────────────────

export interface AuditLogRow {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_id: string | null;
  user_id: string | null;
  metadata: Record<string, unknown> | null;
  hash_before: string | null;
  hash_after: string | null;
  previous_log_hash: string | null;
  entry_hash: string;
  created_at: string;
}

export interface AuditLogInsert {
  id?: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_id?: string | null;
  user_id?: string | null;
  metadata?: Record<string, unknown> | null;
  hash_before?: string | null;
  hash_after?: string | null;
  created_at?: string;
}

export type AuditLogUpdate = WithOptionalFields<AuditLogInsert>;

// ────────────────────────────────────────────────────────────────────────────
// auth_events
// ────────────────────────────────────────────────────────────────────────────

export type AuthEventType =
  | "signup_email"
  | "signup_oauth"
  | "login_email"
  | "login_oauth"
  | "logout"
  | "password_reset_requested"
  | "password_reset_completed"
  | "password_changed"
  | "email_verified"
  | "session_refreshed"
  | "failed_login";

export interface AuthEventRow {
  id: string;
  user_id: string | null;
  event: AuthEventType;
  ip_hash: string | null;
  user_agent: string | null;
  detail: Record<string, unknown>;
  created_at: string;
}

export interface AuthEventInsert {
  id?: string;
  user_id?: string | null;
  event: AuthEventType;
  ip_hash?: string | null;
  user_agent?: string | null;
  detail?: Record<string, unknown>;
  created_at?: string;
}

export type AuthEventUpdate = WithOptionalFields<AuthEventInsert>;

// ────────────────────────────────────────────────────────────────────────────
// match_dimension + stem_type enums
// ────────────────────────────────────────────────────────────────────────────

export type MatchDimension = "melody" | "harmony" | "rhythm" | "timbre" | "lyrics" | "structure";

export type StemType = "vocals" | "bass" | "drums" | "other";

export type AnalysisResolution = "bar" | "phrase" | "song";

// ────────────────────────────────────────────────────────────────────────────
// spectral_signatures
// ────────────────────────────────────────────────────────────────────────────

export interface ProbatiolSignatureRow {
  id: string;
  analysis_id: string;
  dimension: MatchDimension;
  stem_type: StemType | null;
  embedding: number[];  // vector(512) — pgvector returns as number[]
  model_used: string;
  confidence: number | null;
  created_at: string;
}

export interface ProbatiolSignatureInsert {
  id?: string;
  analysis_id: string;
  dimension: MatchDimension;
  stem_type?: StemType | null;
  embedding: number[] | string;  // Accept array or pgvector string format
  model_used: string;
  confidence?: number | null;
  created_at?: string;
}

export type ProbatiolSignatureUpdate = WithOptionalFields<ProbatiolSignatureInsert>;

// ────────────────────────────────────────────────────────────────────────────
// analysis_segments
// ────────────────────────────────────────────────────────────────────────────

export interface AnalysisSegmentRow {
  id: string;
  analysis_id: string;
  start_sec: number;
  end_sec: number;
  segment_index: number;
  label: string | null;
  pitch_contour: Record<string, unknown> | null;
  chroma_vector: Record<string, unknown> | null;
  onset_density: number | null;
  rms_energy: number | null;
  embedding: number[] | null;  // vector(512) — null until Step 5 populates it
  stem_type: StemType | null;
  resolution: "bar" | "phrase" | "song";
  created_at: string;
}

export interface AnalysisSegmentInsert {
  id?: string;
  analysis_id: string;
  start_sec: number;
  end_sec: number;
  segment_index: number;
  label?: string | null;
  pitch_contour?: Record<string, unknown> | null;
  chroma_vector?: Record<string, unknown> | null;
  onset_density?: number | null;
  rms_energy?: number | null;
  embedding?: number[] | string | null;
  stem_type?: StemType | null;
  resolution?: "bar" | "phrase" | "song";
  created_at?: string;
}

export type AnalysisSegmentUpdate = WithOptionalFields<AnalysisSegmentInsert>;

// ────────────────────────────────────────────────────────────────────────────
// reproduction_results
// ────────────────────────────────────────────────────────────────────────────

export type ReproductionStatus = "pending" | "running" | "match" | "mismatch" | "failed";

export interface ReproductionStepComparison {
  step: string;
  original_hash: string;
  reproduced_hash: string;
  match: boolean;
  approximate?: boolean;
  tolerance?: string;
}

export interface ReproductionResultRow {
  id: string;
  original_analysis_id: string;
  reproduced_analysis_id: string | null;
  status: ReproductionStatus;
  comparisons: ReproductionStepComparison[];
  total_steps: number | null;
  matching_steps: number | null;
  mismatched_steps: number | null;
  mismatch_details: Record<string, unknown> | null;
  requested_by: string;
  requested_at: string;
  completed_at: string | null;
  pipeline_version: string | null;
}

export interface ReproductionResultInsert {
  id?: string;
  original_analysis_id: string;
  reproduced_analysis_id?: string | null;
  status?: ReproductionStatus;
  comparisons?: ReproductionStepComparison[];
  total_steps?: number | null;
  matching_steps?: number | null;
  mismatched_steps?: number | null;
  mismatch_details?: Record<string, unknown> | null;
  requested_by: string;
  requested_at?: string;
  completed_at?: string | null;
  pipeline_version?: string | null;
}

export type ReproductionResultUpdate = WithOptionalFields<ReproductionResultInsert>;

// ────────────────────────────────────────────────────────────────────────────
// api_keys
// ────────────────────────────────────────────────────────────────────────────

export type ApiKeyPermission = "analyze" | "catalogs" | "reports" | "forensic" | "verify" | "admin";

export interface ApiKeyRow {
  id: string;
  organization_id: string;
  key_prefix: string;
  key_hash: string;
  name: string;
  description: string | null;
  permissions: ApiKeyPermission[];
  rate_limit_per_minute: number;
  rate_limit_per_day: number;
  is_active: boolean;
  last_used_at: string | null;
  total_requests: number;
  created_by: string;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
}

export interface ApiKeyInsert {
  id?: string;
  organization_id: string;
  key_prefix: string;
  key_hash: string;
  name: string;
  description?: string | null;
  permissions?: ApiKeyPermission[];
  rate_limit_per_minute?: number;
  rate_limit_per_day?: number;
  is_active?: boolean;
  last_used_at?: string | null;
  total_requests?: number;
  created_by: string;
  expires_at?: string | null;
  revoked_at?: string | null;
  revoked_by?: string | null;
}

export type ApiKeyUpdate = WithOptionalFields<ApiKeyInsert>;

// ────────────────────────────────────────────────────────────────────────────
// clearance_alerts
// ────────────────────────────────────────────────────────────────────────────

export type AlertType = "new_match" | "score_increase" | "status_change";
export type AlertSeverity = "info" | "warning" | "critical";

export interface ClearanceAlertRow {
  id: string;
  analysis_id: string;
  user_id: string;
  match_id: string | null;
  reference_track_id: string | null;
  alert_type: AlertType;
  severity: AlertSeverity;
  message: string;
  details: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

export interface ClearanceAlertInsert {
  id?: string;
  analysis_id: string;
  user_id: string;
  match_id?: string | null;
  reference_track_id?: string | null;
  alert_type: AlertType;
  severity: AlertSeverity;
  message: string;
  details?: Record<string, unknown>;
  read?: boolean;
  created_at?: string;
}

export type ClearanceAlertUpdate = WithOptionalFields<ClearanceAlertInsert>;

// ────────────────────────────────────────────────────────────────────────────
// clearance_batches
// ────────────────────────────────────────────────────────────────────────────

export type ClearanceBatchStatus = "pending" | "processing" | "completed" | "partial" | "failed";
export type ClearanceVerdict = "cleared" | "conditional" | "blocked";

export interface ClearanceBatchRow {
  id: string;
  user_id: string;
  name: string;
  catalog_ids: string[];
  status: ClearanceBatchStatus;
  track_count: number;
  tracks_completed: number;
  tracks_cleared: number;
  tracks_conditional: number;
  tracks_blocked: number;
  overall_verdict: ClearanceVerdict | null;
  credits_used: number;
  created_at: string;
  updated_at: string;
}

export interface ClearanceBatchInsert {
  id?: string;
  user_id: string;
  name: string;
  catalog_ids: string[];
  status?: ClearanceBatchStatus;
  track_count?: number;
  tracks_completed?: number;
  tracks_cleared?: number;
  tracks_conditional?: number;
  tracks_blocked?: number;
  overall_verdict?: ClearanceVerdict | null;
  credits_used?: number;
  created_at?: string;
  updated_at?: string;
}

export type ClearanceBatchUpdate = WithOptionalFields<ClearanceBatchInsert>;

// ────────────────────────────────────────────────────────────────────────────
// enterprise_catalogs
// ────────────────────────────────────────────────────────────────────────────

export interface EnterpriseCatalogRow {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  track_count: number;
  tracks_with_embeddings: number;
  status: "pending" | "ingesting" | "completed" | "failed";
  ingestion_progress: Record<string, unknown>;
  estimated_cost_cents: number | null;
  actual_cost_cents: number | null;
  created_at: string;
  updated_at: string;
}

export interface EnterpriseCatalogInsert {
  id?: string;
  organization_id: string;
  name: string;
  description?: string | null;
  track_count?: number;
  tracks_with_embeddings?: number;
  status?: "pending" | "ingesting" | "completed" | "failed";
  ingestion_progress?: Record<string, unknown>;
  estimated_cost_cents?: number | null;
  actual_cost_cents?: number | null;
  created_at?: string;
  updated_at?: string;
}

export type EnterpriseCatalogUpdate = WithOptionalFields<EnterpriseCatalogInsert>;

// ────────────────────────────────────────────────────────────────────────────
// organizations
// ────────────────────────────────────────────────────────────────────────────

export type OrgRole = "member" | "admin" | "owner";

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  plan_tier: PlanTier;
  stripe_customer_id: string | null;
  default_visibility: "public" | "enterprise";
  retention_days: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationInsert {
  id?: string;
  name: string;
  slug: string;
  plan_tier?: PlanTier;
  stripe_customer_id?: string | null;
  default_visibility?: "public" | "enterprise";
  created_by: string;
}

export type OrganizationUpdate = WithOptionalFields<OrganizationInsert>;

export interface OrganizationMemberRow {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  invited_by: string | null;
  joined_at: string;
}

export interface OrganizationMemberInsert {
  id?: string;
  organization_id: string;
  user_id: string;
  role?: OrgRole;
  invited_by?: string | null;
}

export type OrganizationMemberUpdate = WithOptionalFields<OrganizationMemberInsert>;

// ────────────────────────────────────────────────────────────────────────────
// Database (Supabase-compatible root type)
// ────────────────────────────────────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
        Relationships: [];
      };
      credits: {
        Row: CreditRow;
        Insert: CreditInsert;
        Update: CreditUpdate;
        Relationships: [];
      };
      subscriptions: {
        Row: SubscriptionRow;
        Insert: SubscriptionInsert;
        Update: SubscriptionUpdate;
        Relationships: [];
      };
      analyses: {
        Row: AnalysisRow;
        Insert: AnalysisInsert;
        Update: AnalysisUpdate;
        Relationships: [];
      };
      analysis_matches: {
        Row: AnalysisMatchRow;
        Insert: AnalysisMatchInsert;
        Update: AnalysisMatchUpdate;
        Relationships: [];
      };
      match_evidence: {
        Row: MatchEvidenceRow;
        Insert: MatchEvidenceInsert;
        Update: MatchEvidenceUpdate;
        Relationships: [];
      };
      reference_tracks: {
        Row: ReferenceTrackRow;
        Insert: ReferenceTrackInsert;
        Update: ReferenceTrackUpdate;
        Relationships: [];
      };
      forensic_cases: {
        Row: ForensicCaseRow;
        Insert: ForensicCaseInsert;
        Update: ForensicCaseUpdate;
        Relationships: [];
      };
      expert_annotations: {
        Row: ExpertAnnotationRow;
        Insert: ExpertAnnotationInsert;
        Update: ExpertAnnotationUpdate;
        Relationships: [];
      };
      credit_usage: {
        Row: CreditUsageRow;
        Insert: CreditUsageInsert;
        Update: CreditUsageUpdate;
        Relationships: [];
      };
      audit_log: {
        Row: AuditLogRow;
        Insert: AuditLogInsert;
        Update: AuditLogUpdate;
        Relationships: [];
      };
      auth_events: {
        Row: AuthEventRow;
        Insert: AuthEventInsert;
        Update: AuthEventUpdate;
        Relationships: [];
      };
      spectral_signatures: {
        Row: ProbatiolSignatureRow;
        Insert: ProbatiolSignatureInsert;
        Update: ProbatiolSignatureUpdate;
        Relationships: [];
      };
      analysis_segments: {
        Row: AnalysisSegmentRow;
        Insert: AnalysisSegmentInsert;
        Update: AnalysisSegmentUpdate;
        Relationships: [];
      };
      clearance_alerts: {
        Row: ClearanceAlertRow;
        Insert: ClearanceAlertInsert;
        Update: ClearanceAlertUpdate;
        Relationships: [];
      };
      clearance_batches: {
        Row: ClearanceBatchRow;
        Insert: ClearanceBatchInsert;
        Update: ClearanceBatchUpdate;
        Relationships: [];
      };
      enterprise_catalogs: {
        Row: EnterpriseCatalogRow;
        Insert: EnterpriseCatalogInsert;
        Update: EnterpriseCatalogUpdate;
        Relationships: [];
      };
      organizations: {
        Row: OrganizationRow;
        Insert: OrganizationInsert;
        Update: OrganizationUpdate;
        Relationships: [];
      };
      organization_members: {
        Row: OrganizationMemberRow;
        Insert: OrganizationMemberInsert;
        Update: OrganizationMemberUpdate;
        Relationships: [];
      };
      api_keys: {
        Row: ApiKeyRow;
        Insert: ApiKeyInsert;
        Update: ApiKeyUpdate;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      user_role: UserRole;
      plan_tier: PlanTier;
      analysis_status: AnalysisStatus;
      analysis_mode: AnalysisMode;
      risk_level: RiskLevel;
      forensic_status: ForensicStatus;
    };
  };
}
