# Reserva de preço Pix e conferência manual

A reserva dura exatamente 1.800.000 ms, usando o relógio do servidor. Gerar ou expirar não altera o status da inscrição. Pix estático continua utilizável no banco após o prazo; o sistema reserva o preço, sem confirmação bancária ou bloqueio do pagamento.

## Aplicação da migração

Migração: `prisma/migrations/20261008150000_reservas_pix/migration.sql`.

Em desenvolvimento, com `DATABASE_URL` apontando para o banco de desenvolvimento:

```sh
npx prisma migrate dev
npx prisma generate
```

Para aplicar migrações já revisadas em outro ambiente, quando autorizado:

```sh
npx prisma migrate deploy
npx prisma generate
```

A migração foi criada, sem aplicação em banco e sem deploy. Não preenche reservas, horários ou valores históricos de registros antigos.

`ReservaPix.inscricaoId` é um vínculo lógico permanente com o identificador original, seguindo os históricos independentes de reembolsos e exclusões. Não há FK ou cascade para uma tabela que pode ser MyISAM. Reservas permanecem após excluir a inscrição. `reservaPixId` registra a reserva selecionada na conferência; o valor reconhecido fica em `valorReferencia`. Em desconto fora do prazo, o valor reconhecido é o preço atual, embora a reserva selecionada permaneça registrada para auditoria.

Cancelamentos arquivam o pagamento em `pagamentos_cancelados`, incluindo referência, recebido, desconto, reserva, transferência, aprovação, responsável e observação. Invalidam reservas anteriores e limpam a referência da inscrição que volta a pendente. O histórico cancelado fica fora dos totais. Reembolsos e exclusões com pagamento mantido também preservam os novos campos. Exclusão completa continua removendo o pagamento dos totais, preservando as reservas e a referência da conferência no registro de exclusão.

## Concorrência

Geração, consulta, aprovação, cancelamento, reembolso e exclusão usam `financeiro:<eventoId>` com `GET_LOCK`/`RELEASE_LOCK`, na mesma instância MySQL. Todas as decisões são tomadas após releitura sob lock. Uma transação reserva a conexão que mantém o lock; as operações usam instruções em autocommit no pool e a liberação acontece em `finally`, após as instruções concluírem ou falharem. Assim, o histórico InnoDB não sofre rollback depois de uma exclusão parcial em MyISAM. Isso protege tanto MyISAM quanto InnoDB. O pool Prisma precisa de pelo menos **duas conexões**, dimensionado para a concorrência entre eventos. A fila local evita consumir conexões para várias esperas pelo mesmo evento; GET_LOCK garante a exclusão mútua entre processos. Conflitos retornam HTTP 409 para nova tentativa.

Transações não dão rollback às tabelas MyISAM. Os históricos de reembolso/exclusão são salvos antes de remover dados, com estados retomáveis. O snapshot de cancelamento possui identificador determinístico para não duplicar em uma nova tentativa.

## API do aluno

Usar a autenticação já existente do aluno. A inscrição precisa pertencer ao aluno autenticado. As respostas têm `Cache-Control: no-store`.

`POST /api/inscricoes/:inscricaoId/pix`, body obrigatório:

```json
{}
```

Preço, chave e horários não são aceitos no body. A primeira geração usa preço e chave do banco. Durante o prazo, repetir o POST retorna exatamente a mesma reserva. Após o vencimento, cria outra reserva pelo preço atual, mantendo o histórico.

Exemplo de resposta de geração e de consulta ativa (identificadores/chave ilustrativos):

```json
{
  "success": true,
  "data": {
    "quoteId": "cmreservaexemplo0000000001",
    "eventoId": "cmeventoexemplo00000000001",
    "inscricaoId": "cminscricaoexemplo00000001",
    "amount": "75.00",
    "code": "00020126440014br.gov.bcb.pix0122financeiro@example.com520400005303986540575.005802BR5905FAZAG6007VALENCA622805240123456789abcdef012345676304B89D",
    "txid": "0123456789abcdef01234567",
    "createdAt": 1793725200000,
    "expiresAt": 1793727000000
  }
}
```

`GET /api/inscricoes/:inscricaoId/pix` não recebe body e nunca cria ou renova. Sem reserva ativa:

```json
{ "success": true, "data": null }
```

Exemplo de divergência administrativa:

```json
{
  "success": false,
  "error": {
    "message": "O valor recebido diverge da referência. Confira o comprovante ou conceda desconto explicitamente.",
    "code": "VALOR_DIVERGENTE"
  }
}
```

## Aprovação

`POST /api/admin/inscricoes/:inscricaoId/aprovar`, com permissão FINANCEIRO:

```json
{
  "modalidade": "PAGO",
  "quoteId": "cmreservaexemplo0000000001",
  "valorPago": 75.00,
  "dataTransferencia": "2026-11-03T14:20:00-03:00",
  "observacao": "Comprovante conferido pelo financeiro"
}
```

Pode ser aprovado depois das 14:30: o horário conferido no comprovante precisa estar entre geração (inclusive) e vencimento (exclusive), sem estar no futuro. `PAGO` exige igualdade em centavos entre recebido e referência reconhecida. `dataPagamento` continua sendo o horário da aprovação; `dataTransferencia` é separado.

Sem reserva, inclusive pagamento antigo, usar fluxo manual explícito. `valorReferencia` antigo de pendente não garante preço anterior:

```json
{
  "modalidade": "PAGO",
  "valorPago": 100.00,
  "dataTransferencia": "2026-11-03T14:35:00-03:00",
  "semReservaConferida": true,
  "observacao": "Pagamento sem reserva conferido; preço atual aplicado"
}
```

Transferência fora do prazo não pode usar a reserva para aprovação integral. A decisão explícita de conceder desconto usa a referência atual (ou ajuste financeiro previamente concedido), com valor maior que zero e menor que a referência:

```json
{
  "modalidade": "DESCONTO",
  "quoteId": "cmreservaexemplo0000000001",
  "valorPago": 75.00,
  "dataTransferencia": "2026-11-03T14:35:00-03:00",
  "observacao": "Autorizado desconto de R$ 25,00 após o vencimento da reserva"
}
```

Isenção não exige nem deve enviar dados de uma transferência:

```json
{ "modalidade": "ISENTO", "observacao": "Isenção autorizada pelo financeiro" }
```

A tela de Pendentes concentra seleção da reserva (inclusive vencida), recebido, horário do comprovante em Bahia/UTC−03:00 e observação. A tela de inscritos encaminha para essa conferência. A API antiga sem dados de pagamento será recusada. Valores já confirmados não são recalculados pelo preço atual. Relatórios e CSV mostram referência, recebido, reserva, transferência e aprovação/responsável; históricos desconhecidos continuam sem valores inferidos.

## Integração do aplicativo

1. Ao abrir/reabrir a tela de pagamento, consultar GET e substituir o estado local pela resposta do servidor. `data: null` significa que não há reserva ativa; a consulta não deve gerar outra automaticamente.
2. Ao aluno solicitar geração, enviar POST com `{}` e salvar/exibir o payload retornado. Acessos por outros aparelhos recebem a mesma reserva, pois ela está no banco.
3. Gerar QR Code e copiar usando **exatamente `code`**, sem recalcular BR Code, valor ou txid no aplicativo.
4. Exibir `amount`, `txid` e o prazo de `expiresAt`. O contador é apenas visual; o servidor decide a validade. Ao atingir o prazo, consultar novamente e oferecer uma nova geração.
5. Após receber a nova geração, substituir integralmente quoteId/code/amount/txid/createdAt/expiresAt locais. Nunca renovar o prazo localmente ou tratar a geração como confirmação da inscrição.
6. Orientar envio de nome completo e comprovante ao WhatsApp **+55 75 98218-1138**. Não há upload ou envio automático.

O projeto `fazag-app` não foi alterado.

## Verificação

```sh
node --test tests/*.test.cjs
npx tsc --noEmit --incremental false
npx prisma validate
npm run build
git diff --check
```

Testes de serviço/API usam banco e relógio simulados, incluindo fila de locks, fronteira exata de vencimento, virada de lote, outro aparelho, aprovação tardia, divergências, permissões, vagas, operações concorrentes, autocommit e históricos. Não foi executado teste contra MySQL real nem aplicada migração.

BR Code e CRC16 seguem o [Manual de Padrões para Iniciação do Pix do Banco Central](https://www.bcb.gov.br/content/estabilidadefinanceira/pix/Regulamento_Pix/II_ManualdePadroesparaIniciacaodoPix.pdf), com teste do vetor oficial `1D3D`.

## Arquivos criados e alterados

- `prisma/schema.prisma`
- `prisma/migrations/20261008150000_reservas_pix/migration.sql`
- `src/lib/pix.ts`
- `src/lib/financeiro-lock.ts`
- `src/lib/financeiro.ts`
- `src/lib/relatorio-financeiro.ts`
- `src/services/pix.service.ts`
- `src/services/inscricao.service.ts`
- `src/services/financeiro.service.ts`
- `src/services/exclusao-inscricao.service.ts`
- `src/app/api/inscricoes/[inscricaoId]/pix/route.ts`
- `src/app/api/admin/inscricoes/pendentes/route.ts`
- `src/app/api/admin/financeiro/route.ts`
- `src/app/api/admin/eventos/[id]/inscricoes/route.ts`
- `src/app/admin/inscricoes/pendentes/page.tsx`
- `src/app/admin/financeiro/page.tsx`
- `src/app/admin/eventos/[id]/inscricoes/page.tsx`
- `tests/reserva-pix.test.cjs`
- `tests/helpers/load-lock.cjs`
- `tests/financeiro.test.cjs`
- `tests/financeiro-actions.test.cjs`
- `tests/exclusao-inscricao.test.cjs`
- `docs/reservas-pix.md`
- `README.md`
