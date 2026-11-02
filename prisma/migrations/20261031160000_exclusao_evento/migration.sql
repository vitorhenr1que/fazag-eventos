CREATE TABLE `exclusoes_eventos` (
  `eventoId` VARCHAR(25) NOT NULL,
  `nomeEvento` VARCHAR(160) NOT NULL,
  `manterCertificados` BOOLEAN NOT NULL,
  `estado` VARCHAR(20) NOT NULL DEFAULT 'PROCESSANDO',
  `excluidoPor` VARCHAR(25) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`eventoId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
