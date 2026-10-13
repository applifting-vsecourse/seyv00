-- CreateTable
CREATE TABLE "poll_option" (
    "id" TEXT NOT NULL,
    "quackId" TEXT NOT NULL,
    "text" VARCHAR(50) NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "poll_option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_vote" (
    "quackId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poll_vote_pkey" PRIMARY KEY ("quackId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "poll_option_quackId_position_key" ON "poll_option"("quackId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "poll_option_id_quackId_key" ON "poll_option"("id", "quackId");

-- CreateIndex
CREATE INDEX "poll_vote_optionId_idx" ON "poll_vote"("optionId");

-- CreateIndex
CREATE INDEX "poll_vote_userId_idx" ON "poll_vote"("userId");

-- AddForeignKey
ALTER TABLE "poll_option" ADD CONSTRAINT "poll_option_quackId_fkey" FOREIGN KEY ("quackId") REFERENCES "quack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_vote" ADD CONSTRAINT "poll_vote_quackId_fkey" FOREIGN KEY ("quackId") REFERENCES "quack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_vote" ADD CONSTRAINT "poll_vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_vote" ADD CONSTRAINT "poll_vote_optionId_quackId_fkey" FOREIGN KEY ("optionId", "quackId") REFERENCES "poll_option"("id", "quackId") ON DELETE CASCADE ON UPDATE CASCADE;

