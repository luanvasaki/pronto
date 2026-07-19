DROP INDEX "skill_categories_name_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "skill_categories_name_unique" ON "skill_categories" USING btree (lower("name"));