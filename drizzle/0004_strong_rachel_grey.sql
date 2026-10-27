CREATE TYPE "public"."ask_outcome" AS ENUM('answer', 'hedged', 'route', 'busy');--> statement-breakpoint
CREATE TABLE "ask_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ask_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"outcome" "ask_outcome" NOT NULL,
	"faq_id" integer,
	"confidence" varchar(10),
	"modelId" varchar(100),
	"stt_ms" integer,
	"model_ms" integer,
	"total_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ask_events" ADD CONSTRAINT "ask_events_faq_id_faq_entries_id_fk" FOREIGN KEY ("faq_id") REFERENCES "public"."faq_entries"("id") ON DELETE no action ON UPDATE no action;