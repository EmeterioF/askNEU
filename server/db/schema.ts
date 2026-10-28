import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'

// TABLE FOR OFFICE LOOK UP
export const offices = pgTable('offices', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 255 }).notNull(),
  room: varchar({ length: 100 }).notNull(),
  building: varchar({ length: 100 }).notNull(),
  hours: varchar({ length: 255 }).notNull(),
  contact: varchar({ length: 255 }),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

// TABLE FOR QUESTION AND ANSWERS
export const faqEntries = pgTable('faq_entries', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  question: text().notNull(),
  answer: text().notNull(),
  category: varchar({ length: 100 }).notNull(),
  officeId: integer('office_id').references(() => offices.id),
  status: boolean().notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (t) => [index('faq_entries_office_id_idx').on(t.officeId)])

// USED FOR STALE CHECK
export const appSettings = pgTable('app_settings', {
  key: varchar({ length: 100 }).primaryKey(),
  value: text().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})


// USED FOR APP PERFORMANCE 
export const askOutcome = pgEnum('ask_outcome', [
  'answer',
  'hedged',
  'route',
  'busy',
])

export const askEvents = pgTable('ask_events', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  outcome: askOutcome().notNull(),
  faqId: integer('faq_id').references(() => faqEntries.id),
  confidence: varchar({ length: 10 }),
  modelId: varchar('model_id', { length: 100 }),
  sttMs: integer('stt_ms'),
  modelMs: integer('model_ms'),
  totalMs: integer('total_ms'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (t) => [
  index('ask_events_created_at_idx').on(t.createdAt),
  index('ask_events_faq_id_idx').on(t.faqId),
])

// AUDIO METADATA FOR PUBLISHED FAQ ANSWERS
export const faqAudio = pgTable('faq_audio', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  faqId: integer('faq_id')
    .notNull()
    .references(() => faqEntries.id, { onDelete: 'cascade' }),
  kind: varchar({ length: 30 }).notNull().default('answer'),
  blobUrl: text('blob_url').notNull(),
  textHash: varchar('text_hash', { length: 128 }).notNull(),
  voice: varchar({ length: 100 }).notNull(),
  generatedAt: timestamp('generated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (t) => [uniqueIndex('faq_audio_faq_id_kind_idx').on(t.faqId, t.kind)])