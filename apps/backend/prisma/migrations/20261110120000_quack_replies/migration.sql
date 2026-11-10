-- AlterTable
ALTER TABLE "quack" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "parentId" TEXT,
ALTER COLUMN "text" DROP NOT NULL,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "quack_parentId_createdAt_idx" ON "quack"("parentId", "createdAt");

-- AddForeignKey
ALTER TABLE "quack" ADD CONSTRAINT "quack_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "quack"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- Added by hand (Prisma can't express CHECK constraints).
-- A quack is either live (text and author present) or a placeholder for a
-- deleted quack that still has replies: no text, mood or author, and never a
-- reply itself, because replies are always deleted for good.
-- Every existing row is live, so the constraint validates on existing data.
ALTER TABLE "quack" ADD CONSTRAINT "quack_placeholder_check" CHECK (
  ("deletedAt" IS NULL AND "text" IS NOT NULL AND "userId" IS NOT NULL)
  OR
  ("deletedAt" IS NOT NULL AND "text" IS NULL AND "userId" IS NULL
     AND "mood" IS NULL AND "parentId" IS NULL)
);
