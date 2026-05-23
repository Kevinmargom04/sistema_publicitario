-- DropForeignKey
ALTER TABLE "CampaignMedium" DROP CONSTRAINT "CampaignMedium_mediumCatalogId_fkey";

-- AlterTable
ALTER TABLE "CampaignMedium" ALTER COLUMN "mediumCatalogId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "CampaignMedium" ADD CONSTRAINT "CampaignMedium_mediumCatalogId_fkey" FOREIGN KEY ("mediumCatalogId") REFERENCES "MediumCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
