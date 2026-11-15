import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

const id = () => text('id').primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = () => integer('created_at').notNull().$defaultFn(() => Date.now());

export const users = sqliteTable('users', {
  id: id(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  heightCm: real('height_cm'),
  proteinGPerKg: real('protein_g_per_kg').notNull().default(2.0),
  createdAt: createdAt()
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(), // sha256(token)
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at').notNull(),
  ip: text('ip'),
  userAgent: text('user_agent'),
  createdAt: createdAt()
});

export const exercises = sqliteTable('exercises', {
  id: id(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  primaryMuscle: text('primary_muscle').notNull(), // MuscleGroup
  secondaryMuscles: text('secondary_muscles', { mode: 'json' }).$type<string[]>().notNull().default([]),
  createdAt: createdAt()
}, (t) => ({ byUser: uniqueIndex('exercises_user_name').on(t.userId, t.name) }));

export const workouts = sqliteTable('workouts', {
  id: id(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  startedAt: integer('started_at').notNull(), // ms UTC
  endedAt: integer('ended_at'),
  title: text('title'),
  note: text('note'),
  source: text('source').notNull().default('manual'),
  externalId: text('external_id'),
  createdAt: createdAt()
}, (t) => ({
  byUserTime: index('workouts_user_time').on(t.userId, t.startedAt),
  ext: uniqueIndex('workouts_ext').on(t.userId, t.source, t.externalId)
}));

export const sets = sqliteTable('sets', {
  id: id(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  workoutId: text('workout_id').notNull().references(() => workouts.id, { onDelete: 'cascade' }),
  exerciseId: text('exercise_id').notNull().references(() => exercises.id, { onDelete: 'cascade' }),
  idx: integer('idx').notNull().default(0),
  weightKg: real('weight_kg').notNull(),
  reps: integer('reps').notNull(),
  rpe: real('rpe'),
  isWarmup: integer('is_warmup', { mode: 'boolean' }).notNull().default(false),
  performedAt: integer('performed_at').notNull(), // ms UTC
  createdAt: createdAt()
}, (t) => ({
  byEx: index('sets_user_ex_time').on(t.userId, t.exerciseId, t.performedAt),
  byWorkout: index('sets_workout').on(t.workoutId)
}));

export const personalRecords = sqliteTable('personal_records', {
  id: id(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  exerciseId: text('exercise_id').notNull().references(() => exercises.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(), // 'max_weight' | 'est_1rm' | 'max_volume'
  value: real('value').notNull(),
  setId: text('set_id'),
  achievedAt: integer('achieved_at').notNull()
}, (t) => ({ uq: uniqueIndex('pr_uq').on(t.userId, t.exerciseId, t.kind) }));

export const nutritionEntries = sqliteTable('nutrition_entries', {
  id: id(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(), // YYYY-MM-DD
  meal: text('meal'), // breakfast|lunch|dinner|snack
  name: text('name').notNull(),
  kcal: real('kcal').notNull().default(0),
  protein: real('protein').notNull().default(0),
  carbs: real('carbs').notNull().default(0),
  fat: real('fat').notNull().default(0),
  source: text('source').notNull().default('manual'),
  externalId: text('external_id'),
  createdAt: createdAt()
}, (t) => ({
  byDate: index('nutrition_user_date').on(t.userId, t.date),
  ext: uniqueIndex('nutrition_ext').on(t.userId, t.source, t.externalId)
}));

export const bodyMetrics = sqliteTable('body_metrics', {
  id: id(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(), // YYYY-MM-DD
  measuredAt: integer('measured_at').notNull(),
  weightKg: real('weight_kg'),
  bodyFatPct: real('body_fat_pct'),
  source: text('source').notNull().default('manual'),
  externalId: text('external_id'),
  createdAt: createdAt()
}, (t) => ({
  byDate: index('body_user_date').on(t.userId, t.date),
  ext: uniqueIndex('body_ext').on(t.userId, t.source, t.externalId)
}));

export const goals = sqliteTable('goals', {
  id: id(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  period: text('period').notNull(), // 'week' | 'month' | 'target'
  metric: text('metric').notNull(), // GoalMetric
  target: real('target').notNull(),
  label: text('label'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: createdAt()
}, (t) => ({ byUser: index('goals_user').on(t.userId) }));

export const integrationRuns = sqliteTable('integration_runs', {
  id: id(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  mode: text('mode').notNull(), // mock | live
  startedAt: integer('started_at').notNull(),
  status: text('status').notNull(), // ok | error
  items: integer('items').notNull().default(0),
  error: text('error')
}, (t) => ({ byUser: index('runs_user_provider').on(t.userId, t.provider, t.startedAt) }));
