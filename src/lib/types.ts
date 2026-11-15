// Gemeinsame Typen & Konstanten (WP0, eingefroren – Änderungen nur hier)
export const MUSCLE_GROUPS = [
  'brust', 'ruecken', 'schultern', 'bizeps', 'trizeps', 'quadrizeps',
  'beinbeuger', 'gesaess', 'waden', 'bauch'
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  brust: 'Brust', ruecken: 'Rücken', schultern: 'Schultern', bizeps: 'Bizeps',
  trizeps: 'Trizeps', quadrizeps: 'Quadrizeps', beinbeuger: 'Beinbeuger',
  gesaess: 'Gesäß', waden: 'Waden', bauch: 'Bauch'
};

export type GoalMetric =
  | 'workouts_per_week' | 'protein_per_day' | 'kcal_per_day'
  | 'sets_per_week' | 'weight_target' | 'bodyfat_target';

export const GOAL_METRIC_LABELS: Record<GoalMetric, string> = {
  workouts_per_week: 'Trainings / Woche', protein_per_day: 'Eiweiß g / Tag',
  kcal_per_day: 'kcal / Tag', sets_per_week: 'Sätze / Woche',
  weight_target: 'Zielgewicht kg', bodyfat_target: 'Ziel-KFA %'
};

export type ProviderId = 'apple' | 'garmin' | 'yazio' | 'renpho';
export type IntegrationMode = 'off' | 'mock' | 'live';

export interface SuggestedSet { weightKg: number; reps: number; rpe: number | null; hint: string; basedOn: string | null }
export interface ProgressionPoint { date: string; topWeightKg: number; est1rm: number; volume: number }
export interface PR { exerciseId: string; exerciseName: string; kind: 'max_weight' | 'est_1rm' | 'max_volume'; value: number; achievedAt: number }
export interface WeeklyMuscleSets { weekStart: string; sets: Record<MuscleGroup, number> }
export interface DayNutrition { date: string; kcal: number; protein: number; carbs: number; fat: number }
export interface BodyPoint { date: string; weightKg: number | null; bodyFatPct: number | null }
export interface GoalProgress { id: string; label: string; metric: GoalMetric; period: 'week' | 'month' | 'target'; current: number; target: number; ratio: number; unit: string }

export const epley1rm = (w: number, r: number) => (r <= 1 ? w : w * (1 + r / 30));

// Normalisierte Integrationsdaten (UTC, SI-Einheiten)
export interface NormSet { exerciseName: string; muscle?: MuscleGroup; weightKg: number; reps: number; rpe?: number | null }
export interface NormWorkout { externalId: string; startedAt: number; endedAt?: number; title?: string; sets?: NormSet[] }
export interface NormNutrition { externalId: string; date: string; meal?: string; name: string; kcal: number; protein: number; carbs: number; fat: number }
export interface NormBody { externalId: string; measuredAt: number; weightKg?: number; bodyFatPct?: number }
export interface SyncResult { workouts: NormWorkout[]; nutrition: NormNutrition[]; body: NormBody[] }
