-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "imageAlt" TEXT,
ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[];
