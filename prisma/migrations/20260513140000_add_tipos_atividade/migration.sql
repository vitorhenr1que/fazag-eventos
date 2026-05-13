CREATE TABLE `tipos_atividade` (
    `id` VARCHAR(25) NOT NULL,
    `nome` VARCHAR(190) NOT NULL,
    `descricao` TEXT NOT NULL,
    `cargaHorariaMaxima` INTEGER NOT NULL,
    `porcentagemAnual` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tipos_atividade_nome_key`(`nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `eventos` ADD COLUMN `tipoAtividadeId` VARCHAR(25) NULL;

CREATE INDEX `eventos_tipoAtividadeId_idx` ON `eventos`(`tipoAtividadeId`);

ALTER TABLE `eventos` ADD CONSTRAINT `eventos_tipoAtividadeId_fkey` FOREIGN KEY (`tipoAtividadeId`) REFERENCES `tipos_atividade`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
