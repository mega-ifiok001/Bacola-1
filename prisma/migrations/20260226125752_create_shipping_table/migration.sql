/*
  Warnings:

  - You are about to drop the column `info` on the `Shipping` table. All the data in the column will be lost.
  - Made the column `shipping` on table `Shipping` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Shipping" DROP COLUMN "info",
ALTER COLUMN "shipping" SET NOT NULL,
ALTER COLUMN "shipping" SET DEFAULT 100;
