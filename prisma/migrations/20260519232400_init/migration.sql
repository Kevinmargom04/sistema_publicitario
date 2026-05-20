-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "client" TEXT,
    "budgetTarget" DOUBLE PRECISION,
    "period" TEXT,
    "target" TEXT,
    "objectives" TEXT,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediumCatalog" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "defaultCPR" DOUBLE PRECISION NOT NULL,
    "defaultAM" DOUBLE PRECISION NOT NULL,
    "defaultV" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "MediumCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignMedium" (
    "id" SERIAL NOT NULL,
    "campaignId" INTEGER NOT NULL,
    "mediumCatalogId" INTEGER NOT NULL,
    "customName" TEXT,
    "cpr" DOUBLE PRECISION NOT NULL,
    "am" DOUBLE PRECISION NOT NULL,
    "v" DOUBLE PRECISION NOT NULL,
    "investment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CampaignMedium_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scenario" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "campaignId" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MediumCatalog_name_key" ON "MediumCatalog"("name");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMedium" ADD CONSTRAINT "CampaignMedium_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMedium" ADD CONSTRAINT "CampaignMedium_mediumCatalogId_fkey" FOREIGN KEY ("mediumCatalogId") REFERENCES "MediumCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
