-- AlterTable
ALTER TABLE `inscricoes` ADD COLUMN `dataTransferencia` DATETIME(3) NULL,
    ADD COLUMN `reservaPixId` VARCHAR(25) NULL;

-- AlterTable
ALTER TABLE `reembolsos` ADD COLUMN `dataTransferencia` DATETIME(3) NULL,
    ADD COLUMN `reservaPixId` VARCHAR(25) NULL;

-- AlterTable
ALTER TABLE `exclusoes_inscricoes` ADD COLUMN `dataTransferencia` DATETIME(3) NULL,
    ADD COLUMN `reservaPixId` VARCHAR(25) NULL;

-- CreateTable
CREATE TABLE `reservas_pix` (
    `id` VARCHAR(25) NOT NULL,
    `inscricaoId` VARCHAR(25) NOT NULL,
    `eventoId` VARCHAR(25) NOT NULL,
    `valor` DECIMAL(10, 2) NOT NULL,
    `chavePix` VARCHAR(77) NOT NULL,
    `codigo` TEXT NOT NULL,
    `txid` VARCHAR(25) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `invalidadaAt` DATETIME(3) NULL,

    UNIQUE INDEX `reservas_pix_txid_key`(`txid`),
    INDEX `reservas_pix_inscricaoId_expiresAt_idx`(`inscricaoId`, `expiresAt`),
    INDEX `reservas_pix_eventoId_idx`(`eventoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pagamentos_cancelados` (
    `id` VARCHAR(25) NOT NULL,
    `inscricaoOriginalId` VARCHAR(25) NOT NULL,
    `eventoId` VARCHAR(25) NOT NULL,
    `alunoId` VARCHAR(36) NOT NULL,
    `alunoNome` VARCHAR(120) NOT NULL,
    `valorReferencia` DECIMAL(10, 2) NULL,
    `valorPago` DECIMAL(10, 2) NULL,
    `valorDesconto` DECIMAL(10, 2) NULL,
    `situacaoFinanceira` VARCHAR(20) NULL,
    `dataPagamento` DATETIME(3) NULL,
    `dataTransferencia` DATETIME(3) NULL,
    `reservaPixId` VARCHAR(25) NULL,
    `aprovadoPor` VARCHAR(25) NULL,
    `observacaoFinanceira` VARCHAR(500) NULL,
    `canceladoPor` VARCHAR(25) NOT NULL,
    `motivo` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `pagamentos_cancelados_eventoId_idx`(`eventoId`),
    UNIQUE INDEX `pagamentos_cancelados_inscricaoOriginalId_dataPagamento_key`(`inscricaoOriginalId`, `dataPagamento`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

