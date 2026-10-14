import { z } from 'zod'

/** Single source of truth for session data, shared by the UI, the main process and storage. */

export const RoutineSchema = z.object({
  focusMinutes: z.number().int().min(1).max(240),
  exerciseId: z.string().min(1).max(40),
  reps: z.number().int().min(1).max(200),
  gameId: z.string().max(64).nullable()
})
export type Routine = z.infer<typeof RoutineSchema>

export const DEFAULT_ROUTINE: Routine = { focusMinutes: 25, exerciseId: 'push_up', reps: 10, gameId: null }

export const PauseSchema = z.object({
  at: z.number(),
  resumedAt: z.number().nullable(),
  reason: z.enum(['user', 'sleep', 'quit', 'crash'])
})

export const FocusTimerSchema = z.object({
  targetMs: z.number().min(0),
  /** Measured time from finished running stretches. */
  accumulatedMs: z.number().min(0),
  /** Epoch ms when the current running stretch began, or null while paused/finished. */
  runningSince: z.number().nullable(),
  startedAt: z.number(),
  endedAt: z.number().nullable(),
  endedEarly: z.boolean(),
  pauses: z.array(PauseSchema).max(500)
})
export type FocusTimerState = z.infer<typeof FocusTimerSchema>

export const CorrectionSchema = z.object({ t: z.number(), delta: z.union([z.literal(1), z.literal(-1)]), cameraCountAtTime: z.number().int() })

export const OverrideSchema = z.object({
  at: z.number(),
  reason: z.enum(['injury', 'accessibility', 'camera', 'other']),
  choice: z.enum(['self_report', 'skip']),
  /** Reps the person reports doing without camera counting (never added to camera counts). */
  selfReported: z.number().int().min(0).max(1000).nullable(),
  note: z.string().max(200).optional()
})
export type MoveOverride = z.infer<typeof OverrideSchema>

export const MoveSchema = z.object({
  exerciseId: z.string().max(40),
  target: z.number().int().min(1),
  cameraCounted: z.number().int().min(0),
  corrections: z.array(CorrectionSchema).max(1000),
  override: OverrideSchema.nullable(),
  completedAt: z.number().nullable()
})
export type MoveRecord = z.infer<typeof MoveSchema>

export const TaskResultSchema = z.enum(['done', 'partly', 'not_yet']).nullable()
export type TaskResult = z.infer<typeof TaskResultSchema>

export const ActiveSessionSchema = z.object({
  version: z.literal(1),
  id: z.string().max(64),
  createdAt: z.number(),
  savedAt: z.number(),
  routine: RoutineSchema,
  task: z.string().max(200),
  phase: z.enum(['focus', 'review', 'move', 'ready']),
  focus: FocusTimerSchema,
  taskResult: TaskResultSchema,
  move: MoveSchema,
  readyAt: z.number().nullable()
})
export type ActiveSession = z.infer<typeof ActiveSessionSchema>

export const LaunchSchema = z.object({ at: z.number(), gameId: z.string().max(64), gameName: z.string().max(120), ok: z.boolean() })
export const MatchSchema = z.object({ at: z.number(), result: z.enum(['win', 'loss', 'draw']).nullable(), note: z.string().max(200).optional() })

export const SessionRecordSchema = z.object({
  id: z.string().max(64),
  startedAt: z.number(),
  completedAt: z.number(),
  status: z.enum(['ready', 'ended_early']),
  routine: RoutineSchema,
  task: z.string().max(200),
  focus: z.object({ measuredMs: z.number().min(0), targetMs: z.number().min(0), pauseCount: z.number().int().min(0), endedEarly: z.boolean() }),
  taskResult: TaskResultSchema,
  move: MoveSchema,
  /** Each launch of the game from Ready Up: one game session (not a match). */
  launches: z.array(LaunchSchema).max(100),
  /** Matches the person logged by hand. Ready Up can't see matches. */
  matches: z.array(MatchSchema).max(200)
})
export type SessionRecord = z.infer<typeof SessionRecordSchema>

export const HistorySchema = z.object({ version: z.literal(1), sessions: z.array(SessionRecordSchema) })
export type History = z.infer<typeof HistorySchema>
