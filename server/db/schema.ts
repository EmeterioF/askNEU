import {
  integer,
  pgEnum,
  boolean,
  pgTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

export const offices = pgTable('offices', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 255 }).notNull(),
  room: varchar({ length: 100 }).notNull(),
  building: varchar({ length: 100 }).notNull(),
  hours: varchar({ length: 255 }).notNull(),
  contact: varchar({ length: 255 }),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const faqEntries = pgTable('faq_entries', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  question: text().notNull(),
  answer: text().notNull(),
  category: varchar({ length: 100 }).notNull(),
  officeId: integer('office_id').references(() => offices.id),
  status: boolean().notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})