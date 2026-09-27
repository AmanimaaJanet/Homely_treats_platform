-- AlterTable
ALTER TABLE "DeliveryZone" ADD COLUMN     "etaNote" TEXT,
ADD COLUMN     "freeOver" DOUBLE PRECISION,
ADD COLUMN     "minOrder" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "pickupLocation" TEXT,
ADD COLUMN     "timeSlot" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "leadDays" INTEGER;

-- CreateTable
CREATE TABLE "PickupLocation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT,
    "hours" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PickupLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeSlot" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "capacity" INTEGER NOT NULL DEFAULT 6,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TimeSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlackoutDate" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "reason" TEXT,

    CONSTRAINT "BlackoutDate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PickupLocation_name_key" ON "PickupLocation"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TimeSlot_label_key" ON "TimeSlot"("label");

-- CreateIndex
CREATE UNIQUE INDEX "BlackoutDate_date_key" ON "BlackoutDate"("date");
