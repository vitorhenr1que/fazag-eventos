const { test } = require('node:test')
const assert = require('node:assert/strict')
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'Node' } })
const { calcularPagamento, aprovacaoFinanceiraSchema, valorDoReembolso, acaoFinanceiraSchema } = require('../src/lib/financeiro.ts')
const { resumirFinanceiro, situacaoDoRegistro, celulaCsv } = require('../src/lib/relatorio-financeiro.ts')

test('aprovação integral preserva R$ 30 mesmo após a virada para R$ 50', () => {
    const pagamento = calcularPagamento(30, { modalidade: 'PAGO', valorPago: 30 })
    const resumo = resumirFinanceiro([{ status: 'CONFIRMADA', valorReferencia: '30.00', ...pagamento }], 50)
    assert.equal(resumo.recebido, 30)
    assert.equal(resumo.pagos, 1)
    assert.equal(pagamento.valorDesconto, 0)
})

test('desconto registra valor recebido e diferença exata em centavos', () => {
    assert.deepEqual(calcularPagamento(30.3, { modalidade: 'DESCONTO', valorPago: 20.1 }), {
        situacaoFinanceira: 'DESCONTO', valorPago: 20.1, valorDesconto: 10.2,
    })
})

test('isenção confirma sem receita e mantém valor dispensado', () => {
    assert.deepEqual(calcularPagamento(30, { modalidade: 'ISENTO' }), {
        situacaoFinanceira: 'ISENTO', valorPago: 0, valorDesconto: 30,
    })
})

test('desconto exige valor positivo, abaixo da referência, com até dois decimais', () => {
    for (const valorPago of [undefined, NaN, -1, 0, 30, 31, 10.123]) {
        assert.throws(() => calcularPagamento(30, { modalidade: 'DESCONTO', valorPago }))
    }
})

test('API rejeita modalidades desconhecidas e valores malformados', () => {
    for (const input of [{ modalidade: 'OUTRO' }, { valorPago: '20' }, { valorPago: Infinity }, { observacao: 'a'.repeat(501) }]) {
        assert.equal(aprovacaoFinanceiraSchema.safeParse(input).success, false)
    }
    assert.equal(aprovacaoFinanceiraSchema.parse({}).modalidade, 'PAGO')
})

test('relatório separa pagos, descontos, isentos, gratuitos e histórico desconhecido', () => {
    const resumo = resumirFinanceiro([
        { status: 'CONFIRMADA', situacaoFinanceira: 'PAGO', valorPago: '30.00', valorReferencia: '30.00', valorDesconto: '0.00' },
        { status: 'CONFIRMADA', situacaoFinanceira: 'DESCONTO', valorPago: '20.00', valorReferencia: '30.00', valorDesconto: '10.00' },
        { status: 'CONFIRMADA', situacaoFinanceira: 'ISENTO', valorPago: '0.00', valorReferencia: '30.00', valorDesconto: '30.00' },
        { status: 'CONFIRMADA', situacaoFinanceira: 'GRATUITO', valorPago: '0.00' },
        { status: 'CONFIRMADA', situacaoFinanceira: null, valorPago: null },
        { status: 'PENDENTE', situacaoFinanceira: 'PENDENTE', valorReferencia: '30.00' },
        { status: 'PENDENTE', situacaoFinanceira: null, valorReferencia: null },
    ], 50)
    assert.deepEqual(resumo, { inscritos: 7, confirmados: 5, pagos: 2, comDesconto: 1, isentos: 1,
        gratuitos: 1, pendentes: 2, semRegistro: 1, recebido: 50, descontos: 10, isencoes: 30, aReceber: 100, pendentesSemValor: 1,
        reembolsado: 0, saldo: 50, qtdReembolsos: 0, reembolsosEmProcessamento: 0,
        valorMantido: 0, pagamentosMantidos: 0, mantidosSemValor: 0 })
})

test('somar valores decimais não acumula erros de ponto flutuante', () => {
    const registros = Array.from({ length: 100 }, () => ({ status: 'CONFIRMADA', situacaoFinanceira: 'PAGO', valorPago: '0.10' }))
    assert.equal(resumirFinanceiro(registros, 100).recebido, 10)
})

test('histórico sem valores não é inferido a partir do preço atual', () => {
    assert.equal(situacaoDoRegistro({ status: 'CONFIRMADA', situacaoFinanceira: null }), 'SEM_REGISTRO')
    const resumo = resumirFinanceiro([{ status: 'CONFIRMADA', situacaoFinanceira: null, valorPago: null }], 500)
    assert.equal(resumo.recebido, 0)
    assert.equal(resumo.semRegistro, 1)
})

test('CSV escapa aspas e neutraliza fórmulas em nomes e observações', () => {
    assert.equal(celulaCsv('Maria "Silva"'), '"Maria ""Silva"""')
    assert.equal(celulaCsv('=1+1'), '"\'=1+1"')
    assert.equal(celulaCsv('  @SUM(A1)'), '"\'  @SUM(A1)"')
})

test('reembolso mantém receita histórica e desconta devoluções do saldo sem contar aluno excluído', () => {
    const resumo = resumirFinanceiro([{ status: 'CONFIRMADA', situacaoFinanceira: 'PAGO', valorPago: '50.00' }], 90,
        [{ estado: 'CONCLUIDO', valorPago: '30.00' }])
    assert.equal(resumo.inscritos, 1)
    assert.equal(resumo.pagos, 1)
    assert.equal(resumo.recebido, 80)
    assert.equal(resumo.reembolsado, 30)
    assert.equal(resumo.saldo, 50)
    assert.equal(resumo.qtdReembolsos, 1)
})

test('cancelamento deixa pendência e exclui pagamento sem criar devolução', () => {
    const resumo = resumirFinanceiro([{ status: 'PENDENTE', situacaoFinanceira: 'PENDENTE', valorPago: null, valorReferencia: '30.00' }], 50)
    assert.equal(resumo.pagos, 0)
    assert.equal(resumo.recebido, 0)
    assert.equal(resumo.reembolsado, 0)
    assert.equal(resumo.qtdReembolsos, 0)
    assert.equal(resumo.pendentes, 1)
    assert.equal(resumo.aReceber, 50)
})

test('reembolso usa valor original mesmo com desconto, novo lote ou valor enviado diferente', () => {
    assert.equal(valorDoReembolso(20, 50), 20)
    assert.equal(valorDoReembolso(null, 30), 30)
    for (const valor of [undefined, -1, 0, 10.123, Infinity]) assert.throws(() => valorDoReembolso(null, valor))
    assert.throws(() => valorDoReembolso(0, 30))
})

test('reembolso parcial em processamento não duplica receita nem contabiliza devolução concluída', () => {
    const resumo = resumirFinanceiro([{ status: 'CONFIRMADA', situacaoFinanceira: 'PAGO', valorPago: '30.00' }], 50,
        [{ estado: 'PROCESSANDO', valorPago: '30.00' }])
    assert.equal(resumo.recebido, 30)
    assert.equal(resumo.reembolsado, 0)
    assert.equal(resumo.qtdReembolsos, 0)
    assert.equal(resumo.reembolsosEmProcessamento, 1)
})

test('ações financeiras rejeitam operações desconhecidas', () => {
    assert.equal(acaoFinanceiraSchema.safeParse({ acao: 'EXCLUIR' }).success, false)
    assert.equal(acaoFinanceiraSchema.safeParse({ acao: 'REEMBOLSO', valorHistorico: -30 }).success, false)
})

test('recebimento mantido soma valor original sem contar inscrição ou gerar reembolso', () => {
    const resumo = resumirFinanceiro([], 90, [], [
        { valorPago: '20.10', valorReferencia: '30.00', situacaoFinanceira: 'DESCONTO' },
        { valorPago: null, situacaoFinanceira: null },
    ])
    assert.equal(resumo.inscritos, 0)
    assert.equal(resumo.pagos, 0)
    assert.equal(resumo.recebido, 20.1)
    assert.equal(resumo.saldo, 20.1)
    assert.equal(resumo.reembolsado, 0)
    assert.equal(resumo.valorMantido, 20.1)
    assert.equal(resumo.pagamentosMantidos, 2)
    assert.equal(resumo.mantidosSemValor, 1)
})
