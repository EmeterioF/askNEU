CREATE TABLE "faq_audio" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "faq_audio_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"faq_id" integer NOT NULL,
	"kind" varchar(30) DEFAULT 'answer' NOT NULL,
	"blob_url" text NOT NULL,
	"text_hash" varchar(128) NOT NULL,
	"voice" varchar(100) NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "faq_audio" ADD CONSTRAINT "faq_audio_faq_id_faq_entries_id_fk" FOREIGN KEY ("faq_id") REFERENCES "public"."faq_entries"("id") ON DELETE no action ON UPDATE no action;