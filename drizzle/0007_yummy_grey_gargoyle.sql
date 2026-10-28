ALTER TABLE "faq_audio" DROP CONSTRAINT "faq_audio_faq_id_faq_entries_id_fk";
--> statement-breakpoint
ALTER TABLE "faq_audio" ADD CONSTRAINT "faq_audio_faq_id_faq_entries_id_fk" FOREIGN KEY ("faq_id") REFERENCES "public"."faq_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ask_events_created_at_idx" ON "ask_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ask_events_faq_id_idx" ON "ask_events" USING btree ("faq_id");--> statement-breakpoint
CREATE UNIQUE INDEX "faq_audio_faq_id_kind_idx" ON "faq_audio" USING btree ("faq_id","kind");--> statement-breakpoint
CREATE INDEX "faq_entries_office_id_idx" ON "faq_entries" USING btree ("office_id");