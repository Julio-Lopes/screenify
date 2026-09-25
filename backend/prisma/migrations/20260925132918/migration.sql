/*
  Warnings:

  - A unique constraint covering the columns `[session_token_hash]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "session_token_hash" CHAR(64);

-- CreateIndex
CREATE UNIQUE INDEX "users_session_token_hash_key" ON "users"("session_token_hash");
