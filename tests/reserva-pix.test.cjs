const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')

function ambiente() {
    const inicio = Date.parse('2026-11-03T14:00:00-03:00')
    const state = { now: inicio, aluno: 'a1', admin: true, reservas: [], releases: 0, locks: [], ocupado: false,
        inscricao: { id: 'i1', eventoId: 'e1', alunoId: 'a1', status: 'PENDENTE', situacaoFinanceira: 'PENDENTE', valorReferencia: 50,
            aluno: { nome: 'Aluno', email: 'aluno@example.com' }, dataInscricao: new Date(inicio),
            evento: { id: 'e1', tipo: 'PAGO', preco: 75, chavePix: 'financeiro@example.com', totalVagas: 1 } }, count: 0 }
    const RealDate = Date
    class Clock extends RealDate { constructor(...args) { super(...(args.length ? args : [state.now])) } static now() { return state.now } }
    let busy = false
    const waiting = []
    const db = {
        inscricao: {
            findUnique: async () => state.inscricao ? { ...state.inscricao, evento: { ...state.inscricao.evento } } : null,
            count: async () => state.count,
            update: async ({ data }) => state.inscricao = { ...state.inscricao, ...data },
            deleteMany: async () => { state.inscricao = null; return { count: 1 } },
            updateMany: async ({ where, data }) => {
                if (!state.inscricao || state.inscricao.status !== where.status) return { count: 0 }
                state.inscricao = { ...state.inscricao, ...data }; state.count++; return { count: 1 }
            },
        },
        reembolso: { findUnique: async () => state.reembolso ?? null,
            create: async ({ data }) => state.reembolso = { id: 'r1', estado: 'PROCESSANDO', ...data },
            update: async ({ data }) => state.reembolso = { ...state.reembolso, ...data } },
        exclusaoInscricao: { findUnique: async () => state.exclusao ?? null,
            create: async ({ data }) => state.exclusao = { id: 'x1', estado: 'PROCESSANDO', ...data },
            update: async ({ data }) => state.exclusao = { ...state.exclusao, ...data } },
        pagamentoCancelado: { upsert: async ({ create }) => state.cancelado = state.cancelado ?? create },
        inscricaoSubevento: { findMany: async () => [], deleteMany: async () => ({ count: 0 }) },
        checkIn: { deleteMany: async () => ({ count: 0 }) }, certificado: { deleteMany: async () => ({ count: 0 }) },
        reservaPix: {
            updateMany: async ({ data }) => { for (const r of state.reservas) if (!r.invalidadaAt) Object.assign(r, data); return { count: state.reservas.length } },
            findFirst: async ({ where }) => state.reservas.find(r => r.inscricaoId === where.inscricaoId && !r.invalidadaAt && r.expiresAt > where.expiresAt.gt) ?? null,
            findUnique: async ({ where }) => state.reservas.find(r => r.id === where.id) ?? null,
            create: async ({ data }) => { const r = { id: `q${state.reservas.length + 1}`, invalidadaAt: null, ...data }; state.reservas.push(r); return r },
        },
        $queryRaw: async (strings, name) => {
            if (strings.join('').includes('GET_LOCK')) {
                state.locks.push(name)
                if (state.lockNegado) return [{ adquirido: 0 }]
                if (busy) await new Promise(resolve => waiting.push(resolve))
                busy = true
                if (state.afterLock) { const hook = state.afterLock; state.afterLock = null; hook() }
                return [{ adquirido: 1 }]
            }
            state.releases++; const next = waiting.shift(); if (next) next(); else busy = false
            return [{ liberado: 1 }]
        },
        $transaction: async fn => fn(db),
    }
    const cache = new Map()
    function load(relative) {
        const file = path.resolve(__dirname, '../src', relative)
        if (cache.has(file)) return cache.get(file).exports
        const loaded = new Module(file, module); loaded.filename = file; loaded.paths = module.paths; cache.set(file, loaded)
        const original = loaded.require.bind(loaded)
        loaded.require = id => {
            if (id === '@test/clock') return Clock
            if (id === '@/lib/db') return { __esModule: true, default: db }
            if (id === '@/lib/auth-aluno') return { getAlunoFromHeader: async () => {
                if (!state.aluno) throw new (load('lib/app-error.ts').AppError)('Não autorizado', 401)
                return { id: state.aluno }
            } }
            if (id === '@/lib/auth-admin') return { getAdminFromHeader: async (_, permission) => {
                assert.equal(permission, 'FINANCEIRO')
                if (!state.admin) throw new (load('lib/app-error.ts').AppError)('Acesso negado', 403)
                return { id: 'admin1' }
            } }
            if (id.startsWith('@/')) return load(id.slice(2) + '.ts')
            if (id.startsWith('.')) return load(path.relative(path.resolve(__dirname, '../src'), path.resolve(path.dirname(file), id + '.ts')))
            return original(id)
        }
        const source = "const Date = require('@test/clock');\n" + fs.readFileSync(file, 'utf8')
        loaded._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2020 } }).outputText, file)
        return loaded.exports
    }
    return { state, inicio, db, pix: new (load('services/pix.service.ts').PixService)(),
        aprovar: new (load('services/inscricao.service.ts').InscricaoService)(),
        api: load('app/api/inscricoes/[inscricaoId]/pix/route.ts'),
        adminApi: load('app/api/admin/inscricoes/[inscricaoId]/aprovar/route.ts'), load }
}
const context = { params: Promise.resolve({ inscricaoId: 'i1' }) }
const request = body => new Request('http://localhost/api', { method: 'POST', body: JSON.stringify(body) })
const pago = (quoteId, dataTransferencia = '2026-11-03T14:20:00-03:00', valorPago = 75) => ({ modalidade: 'PAGO', quoteId, dataTransferencia, valorPago })

test('API exige autenticação/propriedade e recusa campos controlados pelo aluno', async () => {
    const { state, api } = ambiente()
    state.aluno = null
    assert.equal((await api.GET(request({}), context)).status, 401)
    state.aluno = 'outro'
    for (const method of ['GET', 'POST']) assert.equal((await api[method](request({}), context)).status, 403)
    state.aluno = 'a1'
    for (const body of [{ amount: 1 }, { chavePix: 'outra' }, { expiresAt: 1 }, [], null]) {
        const res = await api.POST(request(body), context); assert.equal(res.status, 400); assert.equal((await res.json()).success, false)
    }
    state.inscricao = null
    assert.equal((await api.POST(request({}), context)).status, 404)
    assert.equal(state.reservas.length, 0)
})

test('consulta não cria; geração usa banco; outro aparelho e novo lote reutilizam exatamente o payload', async () => {
    const { pix, state, inicio, api } = ambiente()
    assert.deepEqual(await (await api.GET(request({}), context)).json(), { success: true, data: null })
    const a = await pix.obter('i1', 'a1', true)
    assert.equal(a.amount, '75.00'); assert.equal(a.createdAt, inicio); assert.equal(a.expiresAt, inicio + 1800000)
    assert.match(a.txid, /^[a-zA-Z0-9]{1,25}$/); assert.ok(a.code.includes('financeiro@example.com'))
    state.now += 600000; state.inscricao.evento.preco = 100; state.inscricao.evento.chavePix = 'outra@example.com'
    assert.deepEqual(await pix.obter('i1', 'a1', true), a)
    assert.deepEqual((await (await api.POST(request({}), context)).json()).data, a)
    state.now = a.expiresAt - 1; assert.deepEqual(await pix.obter('i1', 'a1'), a)
    state.now++; assert.equal(await pix.obter('i1', 'a1'), null); assert.equal(state.reservas.length, 1)
    const b = await pix.obter('i1', 'a1', true)
    assert.equal(b.amount, '100.00'); assert.notEqual(b.txid, a.txid); assert.notEqual(b.quoteId, a.quoteId)
    assert.equal(b.expiresAt - b.createdAt, 1800000); assert.equal(state.reservas.length, 2)
})

test('requisições simultâneas geram uma única reserva, usando o lock do financeiro', async () => {
    const { pix, state } = ambiente()
    const result = await Promise.all(Array.from({ length: 12 }, () => pix.obter('i1', 'a1', true)))
    assert.equal(state.reservas.length, 1)
    for (const r of result) assert.deepEqual(r, result[0])
    assert.deepEqual(state.locks, Array(12).fill('financeiro:e1')); assert.equal(state.releases, 12)
})

test('relê status após o lock; falhas liberam o lock e timeout não gera reserva', async () => {
    const { pix, state } = ambiente()
    state.afterLock = () => { state.inscricao.status = 'CONFIRMADA' }
    await assert.rejects(pix.obter('i1', 'a1', true)); assert.equal(state.reservas.length, 0); assert.equal(state.releases, 1)
    state.lockNegado = true; await assert.rejects(pix.obter('i1', 'a1', true)); assert.equal(state.releases, 1)
})

test('recusa inscrição confirmada, evento gratuito, preço e chave inválidos e exclusão/reembolso', async () => {
    for (const mutation of [s => s.inscricao.status = 'CONFIRMADA', s => s.inscricao.evento.tipo = 'GRATUITO',
        ...[null, -1, 0, 10.123, 100000000].map(v => s => s.inscricao.evento.preco = v),
        ...[null, 'invalida', 'foo@@example.com', 'foo@example..com', '1'.repeat(11), 'a'.repeat(78) + '@example.com'].map(v => s => s.inscricao.evento.chavePix = v),
        s => s.exclusao = {}, s => s.reembolso = {}]) {
        const { pix, state } = ambiente(); mutation(state)
        await assert.rejects(pix.obter('i1', 'a1', true)); assert.equal(state.reservas.length, 0); assert.equal(state.releases, 1)
    }
})

test('aprovação posterior reconhece transferência dentro do prazo, preserva data de aprovação separada', async () => {
    const { pix, state, aprovar, inicio } = ambiente()
    const q = await pix.obter('i1', 'a1', true)
    state.now += 3600000; state.inscricao.evento.preco = 100
    const r = await aprovar.aprovarInscricao('i1', pago(q.quoteId), 'admin1')
    assert.equal(r.valorReferencia, 75); assert.equal(r.valorPago, 75); assert.equal(r.reservaPixId, q.quoteId)
    assert.equal(r.dataTransferencia.getTime(), inicio + 1200000); assert.equal(r.dataPagamento.getTime(), state.now)
    assert.equal(r.aprovadoPor, 'admin1'); assert.equal(r.status, 'CONFIRMADA')
    assert.equal(await pix.obter('i1', 'a1'), null)
})

test('recusa transferência antes da geração, exatamente no vencimento e valor divergente', async () => {
    for (const dados of [pago('q1', '2026-11-03T13:59:59-03:00'), pago('q1', '2026-11-03T14:30:00-03:00'), pago('q1', undefined, 70)]) {
        const { pix, state, aprovar } = ambiente(); await pix.obter('i1', 'a1', true); state.now += 3600000
        await assert.rejects(aprovar.aprovarInscricao('i1', dados, 'admin1')); assert.equal(state.inscricao.status, 'PENDENTE')
        assert.equal(state.releases, 2)
    }
})

test('reserva precisa pertencer à inscrição; futuro, sem fuso e antigo endpoint sem body são recusados', async () => {
    const { pix, state, adminApi } = ambiente(); await pix.obter('i1', 'a1', true)
    state.now += 3600000
    for (const body of [{}, pago('inexistente'), pago('q1', '2026-11-03T18:20:00-03:00'), pago('q1', '2026-11-03T14:20:00')]) {
        assert.equal((await adminApi.POST(request(body), context)).status, 400)
    }
    state.reservas[0].inscricaoId = 'outra'
    assert.equal((await adminApi.POST(request(pago('q1')), context)).status, 400)
    state.admin = false
    assert.equal((await adminApi.POST(request(pago('q1')), context)).status, 403)
})

test('sem reserva ignora valorReferencia antigo e exige conferência manual explícita', async () => {
    const { aprovar, state } = ambiente(); state.now += 3600000; state.inscricao.evento.preco = 100
    const manual = { modalidade: 'PAGO', valorPago: 100, dataTransferencia: '2026-11-03T14:20:00-03:00' }
    await assert.rejects(aprovar.aprovarInscricao('i1', manual, 'admin1'))
    await assert.rejects(aprovar.aprovarInscricao('i1', { ...manual, valorPago: 50, semReservaConferida: true, observacao: 'conferido' }, 'admin1'))
    const r = await aprovar.aprovarInscricao('i1', { ...manual, semReservaConferida: true, observacao: 'Comprovante antigo conferido' }, 'admin1')
    assert.equal(r.valorReferencia, 100); assert.equal(r.reservaPixId, null)
})

test('desconto fora do prazo é explícito sobre preço atual; isenção dispensa transferência', async () => {
    const { pix, state, aprovar } = ambiente(); const q = await pix.obter('i1', 'a1', true)
    state.now += 3600000; state.inscricao.evento.preco = 100
    const r = await aprovar.aprovarInscricao('i1', { ...pago(q.quoteId, '2026-11-03T14:35:00-03:00'), modalidade: 'DESCONTO', observacao: 'Autorizei diferença após prazo' }, 'admin1')
    assert.equal(r.valorReferencia, 100); assert.equal(r.valorDesconto, 25); assert.equal(r.valorPago, 75)
    const b = ambiente(); b.state.inscricao.valorReferencia = null
    const isento = await b.aprovar.aprovarInscricao('i1', { modalidade: 'ISENTO' }, 'admin1')
    assert.equal(isento.valorPago, 0); assert.equal(isento.dataTransferencia, null); assert.equal(isento.valorDesconto, 75)
})

test('ajustes explicitamente concedidos e valores já confirmados são preservados', async () => {
    const a = ambiente(); a.state.inscricao.situacaoFinanceira = 'DESCONTO'; a.state.now += 3600000
    const r = await a.aprovar.aprovarInscricao('i1', { modalidade: 'DESCONTO', valorPago: 40, semReservaConferida: true, observacao: 'Ajuste autorizado', dataTransferencia: '2026-11-03T14:20:00-03:00' }, 'admin1')
    assert.equal(r.valorReferencia, 50); assert.equal(r.valorDesconto, 10)
    a.state.inscricao.evento.preco = 200
    await assert.rejects(a.aprovar.aprovarInscricao('i1', { modalidade: 'ISENTO' }, 'admin2'))
    assert.equal(a.state.inscricao.valorReferencia, 50); assert.equal(a.state.inscricao.aprovadoPor, 'admin1')
})

test('aprovações simultâneas não duplicam; limite de vagas é conferido após lock', async () => {
    const a = ambiente()
    const result = await Promise.allSettled([a.aprovar.aprovarInscricao('i1', { modalidade: 'ISENTO' }, 'admin1'), a.aprovar.aprovarInscricao('i1', { modalidade: 'ISENTO' }, 'admin2')])
    assert.equal(result.filter(r => r.status === 'fulfilled').length, 1); assert.equal(a.state.count, 1)
    const b = ambiente(); b.state.afterLock = () => b.state.count = 1
    await assert.rejects(b.aprovar.aprovarInscricao('i1', { modalidade: 'ISENTO' }, 'admin1'), /Vagas esgotadas/)
    assert.equal(b.state.inscricao.status, 'PENDENTE')
})

test('BR Code respeita TLV, chave, valor, txid, campos obrigatórios e vetor CRC oficial', () => {
    const { load } = ambiente(); const { gerarCodigoPix, crcPix, validarChavePix } = load('lib/pix.ts')
    const official = '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304'
    assert.equal(crcPix(official), '1D3D')
    const code = gerarCodigoPix('financeiro@example.com', '75.00', 'Ref123')
    function parse(text) { const fields = {}; let i = 0; while (i < text.length) { const id = text.slice(i, i + 2); const len = Number(text.slice(i + 2, i + 4)); fields[id] = text.slice(i + 4, i + 4 + len); i += 4 + len } assert.equal(i, text.length); return fields }
    const f = parse(code)
    assert.equal(f['00'], '01'); assert.equal(f['52'], '0000'); assert.equal(f['53'], '986'); assert.equal(f['54'], '75.00'); assert.equal(f['58'], 'BR')
    assert.ok(f['59'].length <= 25); assert.ok(f['60'].length <= 15)
    assert.equal(parse(f['26'])['00'], 'br.gov.bcb.pix'); assert.equal(parse(f['26'])['01'], 'financeiro@example.com'); assert.equal(parse(f['62'])['05'], 'Ref123')
    assert.equal(f['63'], crcPix(code.slice(0, -4)))
    for (const chave of ['52998224725', '11222333000181', '+5575982181138', '123e4567-e12b-12d1-a456-426655440000']) assert.equal(validarChavePix(chave), chave)
})

test('lock só é liberado após instruções em autocommit; falhas também liberam', async () => {
    for (const falha of [false, true]) {
        const { db, state, load } = ambiente()
        const transaction = db.$transaction
        let conexoesLock = 0, instrucoesTerminadas = false
        db.$transaction = async fn => { conexoesLock++; return transaction(fn) }
        const query = db.$queryRaw
        db.$queryRaw = async (strings, name) => {
            if (strings.join('').includes('RELEASE_LOCK')) assert.equal(instrucoesTerminadas, true)
            return query(strings, name)
        }
        const action = load('lib/financeiro-lock.ts').comLockFinanceiro('e1', async client => {
            assert.equal(client, db, 'usa o pool em autocommit, sem incluir o histórico em uma transação com MyISAM')
            await client.inscricao.findUnique({ where: { id: 'i1' } })
            instrucoesTerminadas = true
            if (falha) throw new Error('falha após instrução')
            return 'gravado'
        })
        if (falha) await assert.rejects(action, /falha após instrução/)
        else assert.equal(await action, 'gravado')
        assert.equal(state.releases, 1); assert.equal(conexoesLock, 1)
    }
})

test('geração simultânea à aprovação relê o status e não cria uma reserva após confirmar', async () => {
    const { pix, aprovar, state } = ambiente()
    const resultado = await Promise.allSettled([
        aprovar.aprovarInscricao('i1', { modalidade: 'ISENTO' }, 'admin1'), pix.obter('i1', 'a1', true),
    ])
    assert.equal(resultado[0].status, 'fulfilled'); assert.equal(resultado[1].status, 'rejected')
    assert.equal(state.reservas.length, 0); assert.equal(state.inscricao.status, 'CONFIRMADA')
})

test('cancelamento simultâneo à geração invalida reservas antigas e preserva conferência original', async () => {
    const { pix, aprovar, state, load } = ambiente()
    const q = await pix.obter('i1', 'a1', true); state.now += 1200000
    await aprovar.aprovarInscricao('i1', pago(q.quoteId), 'admin1')
    state.inscricao.evento.preco = 100
    const financeiro = new (load('services/financeiro.service.ts').FinanceiroService)()
    let geracao
    state.afterLock = () => { geracao = pix.obter('i1', 'a1', true) }
    await financeiro.realizarAcao('i1', { acao: 'CANCELAMENTO' }, 'admin2')
    const nova = await geracao
    assert.equal(nova.amount, '100.00'); assert.notEqual(nova.quoteId, q.quoteId)
    assert.equal(state.cancelado.reservaPixId, q.quoteId); assert.equal(state.cancelado.valorReferencia, 75)
    assert.equal(state.cancelado.valorPago, 75); assert.equal(state.cancelado.aprovadoPor, 'admin1')
    assert.equal(state.cancelado.dataTransferencia.toISOString(), '2026-11-03T17:20:00.000Z')
    assert.equal(state.reservas.length, 2); assert.ok(state.reservas[0].invalidadaAt)
})

test('exclusão simultânea bloqueia geração e preserva histórico das reservas', async () => {
    const { pix, state, load } = ambiente(); await pix.obter('i1', 'a1', true)
    const excluir = new (load('services/exclusao-inscricao.service.ts').ExclusaoInscricaoService)()
    let geracao
    state.afterLock = () => { geracao = pix.obter('i1', 'a1', true); geracao.catch(() => {}) }
    await excluir.excluir('i1', { modalidade: 'EXCLUIR_TUDO' }, 'admin1')
    await assert.rejects(geracao)
    assert.equal(state.inscricao, null); assert.equal(state.reservas.length, 1); assert.equal(state.exclusao.estado, 'CONCLUIDO')
})

test('reembolso e exclusão com pagamento mantido arquivam reserva, transferência e aprovação', async () => {
    for (const modalidade of ['REEMBOLSO', 'MANTER_PAGAMENTO', 'EXCLUIR_TUDO']) {
        const { pix, aprovar, state, load } = ambiente()
        const q = await pix.obter('i1', 'a1', true); state.now += 1200000
        await aprovar.aprovarInscricao('i1', { ...pago(q.quoteId), observacao: 'Comprovante conferido' }, 'admin1')
        const excluir = new (load('services/exclusao-inscricao.service.ts').ExclusaoInscricaoService)()
        await excluir.excluir('i1', { modalidade }, 'admin2')
        const registro = state.reembolso ?? state.exclusao
        assert.equal(registro.reservaPixId, q.quoteId); assert.equal(registro.dataTransferencia.getTime(), state.now)
        if (modalidade !== 'EXCLUIR_TUDO') {
            assert.equal(registro.valorReferencia, 75); assert.equal(registro.valorPago, 75); assert.equal(registro.aprovadoPor, 'admin1')
            assert.equal(registro.dataPagamento.getTime(), state.now)
        }
        assert.equal(state.inscricao, null); assert.equal(state.reservas.length, 1)
    }
})

test('cancelar aprovação antiga arquiva dados conhecidos sem inventar transferência ou horário de aprovação', async () => {
    const { state, load } = ambiente()
    state.inscricao.status = 'CONFIRMADA'; state.inscricao.situacaoFinanceira = null
    state.inscricao.valorPago = null; state.inscricao.dataPagamento = null
    const financeiro = new (load('services/financeiro.service.ts').FinanceiroService)()
    await financeiro.realizarAcao('i1', { acao: 'CANCELAMENTO' }, 'admin1')
    assert.equal(state.cancelado.dataPagamento, null); assert.equal(state.cancelado.dataTransferencia, undefined)
    assert.equal(state.cancelado.valorReferencia, 50); assert.equal(state.inscricao.valorReferencia, null)
})

test('aprova integral sem horário pelo preço atual e mantém transferência sem registro', async () => {
    const { state, aprovar } = ambiente()
    state.inscricao.evento.preco = 100
    const dados = { modalidade: 'PAGO', valorPago: 100, semReservaConferida: true, observacao: 'Pagamento integral conferido manualmente' }
    const r = await aprovar.aprovarInscricao('i1', dados, 'admin1')
    assert.equal(r.valorReferencia, 100); assert.equal(r.valorPago, 100)
    assert.equal(r.dataTransferencia, null); assert.equal(r.reservaPixId, null)
    assert.equal(r.dataPagamento.getTime(), state.now)
})

test('aprova reserva selecionada vencida sem horário ou confirmação de prazo', async () => {
    const { state, pix, aprovar } = ambiente()
    const q = await pix.obter('i1', 'a1', true)
    state.now += 3600000; state.inscricao.evento.preco = 100
    await assert.rejects(aprovar.aprovarInscricao('i1', { modalidade: 'PAGO', quoteId: q.quoteId, valorPago: 70 }, 'admin1'),
        error => error.code === 'VALOR_DIVERGENTE')
    const r = await aprovar.aprovarInscricao('i1', { modalidade: 'PAGO', quoteId: q.quoteId, valorPago: 75,
        observacao: 'a'.repeat(500) }, 'admin1')
    assert.equal(r.valorReferencia, 75); assert.equal(r.valorPago, 75); assert.equal(r.dataTransferencia, null)
    assert.equal(r.reservaPixId, q.quoteId); assert.equal(r.dataPagamento.getTime(), state.now)
    assert.match(r.observacaoFinanceira, /Reserva Pix selecionada na aprovação; horário da transferência não informado\./)
    assert.equal(r.observacaoFinanceira.length, 500)
})

test('aprovação sem confirmação preserva validação de horário informado e reserva invalidada', async () => {
    for (const hora of ['2026-11-03T14:30:00-03:00', '2026-11-03T18:20:00-03:00', '2026-11-03T14:20:00']) {
        const { state, pix, aprovar } = ambiente(); const q = await pix.obter('i1', 'a1', true)
        state.now += 3600000
        await assert.rejects(aprovar.aprovarInscricao('i1', pago(q.quoteId, hora), 'admin1'))
    }
    const { pix, state, aprovar } = ambiente(); const q = await pix.obter('i1', 'a1', true)
    state.reservas[0].invalidadaAt = new Date(state.now)
    await assert.rejects(aprovar.aprovarInscricao('i1', { modalidade: 'PAGO', quoteId: q.quoteId, valorPago: 75 }, 'admin1'))
})

test('desconto dispensa horário sem perder valor recebido, motivo e conferência manual', async () => {
    const { state, aprovar } = ambiente()
    const r = await aprovar.aprovarInscricao('i1', { modalidade: 'DESCONTO', valorPago: 60,
        semReservaConferida: true, observacao: 'Desconto autorizado' }, 'admin1')
    assert.equal(r.valorReferencia, 75); assert.equal(r.valorPago, 60); assert.equal(r.valorDesconto, 15)
    assert.equal(r.dataTransferencia, null); assert.equal(r.observacaoFinanceira, 'Desconto autorizado')
    assert.equal(r.dataPagamento.getTime(), state.now)
})

test('endpoint administrativo aceita aprovação com reserva sem data ou confirmação do prazo', async () => {
    const { pix, state, adminApi } = ambiente()
    const q = await pix.obter('i1', 'a1', true); state.now += 3600000
    const dados = { modalidade: 'PAGO', quoteId: q.quoteId, valorPago: 75 }
    const resposta = await adminApi.POST(request(dados), context)
    assert.equal(resposta.status, 200)
    const { data } = await resposta.json()
    assert.equal(data.dataTransferencia, null); assert.equal(data.valorPago, 75)
    assert.match(data.observacaoFinanceira, /Reserva Pix selecionada na aprovação/)
})
