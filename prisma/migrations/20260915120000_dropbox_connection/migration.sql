-- CreateTable
CREATE TABLE "dropbox_connections" (
    "id" TEXT NOT NULL,
    "accountEmail" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "basePath" TEXT NOT NULL DEFAULT '',
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dropbox_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dropbox_connections_accountEmail_key" ON "dropbox_connections"("accountEmail");
