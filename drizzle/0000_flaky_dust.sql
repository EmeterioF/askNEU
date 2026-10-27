CREATE TABLE IF NOT EXISTS "offices" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "offices_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"room" varchar(100) NOT NULL,
	"hours" varchar(255) NOT NULL,
	"contact" varchar(255),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
