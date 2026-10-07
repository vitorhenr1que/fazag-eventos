-- CreateTable
CREATE TABLE `exclusoes_inscricoes` (
    `id` VARCHAR(25) NOT NULL,
    `inscricaoOriginalId` VARCHAR(25) NOT NULL,
    `eventoId` VARCHAR(25) NOT NULL,
    `alunoId` VARCHAR(36) NOT NULL,
    `alunoNome` VARCHAR(120) NOT NULL,
    `alunoEmail` VARCHAR(190) NULL,
    `modalidade` VARCHAR(20) NOT NULL,
    `estado` VARCHAR(20) NOT NULL DEFAULT 'PROCESSANDO',
    `dataExclusao` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `excluidoPor` VARCHAR(25) NOT NULL,
    `motivo` VARCHAR(500) NULL,
    `valorReferencia` DECIMAL(10, 2) NULL,
    `valorPago` DECIMAL(10, 2) NULL,
    `valorDesconto` DECIMAL(10, 2) NULL,
    `situacaoFinanceira` VARCHAR(20) NULL,
    `dataInscricao` DATETIME(3) NOT NULL,
    `dataPagamento` DATETIME(3) NULL,
    `aprovadoPor` VARCHAR(25) NULL,
    `observacaoFinanceira` VARCHAR(500) NULL,

    UNIQUE INDEX `exclusoes_inscricoes_inscricaoOriginalId_key`(`inscricaoOriginalId`),
    INDEX `exclusoes_inscricoes_eventoId_estado_idx`(`eventoId`, `estado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

