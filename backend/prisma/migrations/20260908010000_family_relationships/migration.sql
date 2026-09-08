CREATE TYPE "RelationshipType" AS ENUM ('PARENT', 'CHILD', 'SPOUSE', 'SIBLING');
CREATE TABLE "family_relationships" ("id" UUID NOT NULL DEFAULT gen_random_uuid(), "client_id" UUID NOT NULL, "related_client_id" UUID NOT NULL, "relationship_type" "RelationshipType" NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "family_relationships_pkey" PRIMARY KEY ("id"), CONSTRAINT "family_relationships_canonical_pair" CHECK ("client_id" < "related_client_id"));
CREATE UNIQUE INDEX "family_relationships_client_id_related_client_id_key" ON "family_relationships"("client_id", "related_client_id");
CREATE INDEX "family_relationships_related_client_id_idx" ON "family_relationships"("related_client_id");
ALTER TABLE "family_relationships" ADD CONSTRAINT "family_relationships_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "family_relationships" ADD CONSTRAINT "family_relationships_related_client_id_fkey" FOREIGN KEY ("related_client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
