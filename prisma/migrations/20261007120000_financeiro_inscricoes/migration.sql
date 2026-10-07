-- Não estimar pagamentos antigos: valores históricos desconhecidos permanecem NULL.
ALTER TABLE `inscricoes`
    ADD COLUMN `valorReferencia` DECIMAL(10, 2) NULL,
    ADD COLUMN `valorPago` DECIMAL(10, 2) NULL,
    ADD COLUMN `valorDesconto` DECIMAL(10, 2) NULL,
    ADD COLUMN `situacaoFinanceira` VARCHAR(20) NULL,
    ADD COLUMN `dataPagamento` DATETIME(3) NULL,
    ADD COLUMN `aprovadoPor` VARCHAR(25) NULL,
    ADD COLUMN `observacaoFinanceira` VARCHAR(500) NULL;
