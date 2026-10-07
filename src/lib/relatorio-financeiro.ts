export interface RegistroFinanceiro {
    id: string
    status: string
    situacaoFinanceira: string | null
    valorReferencia: string | number | null
    valorPago: string | number | null
    valorDesconto: string | number | null
    dataInscricao: string
    dataPagamento: string | null
    responsavel: string | null
    observacaoFinanceira: string | null
    aluno: { id: string; nome: string; email: string | null }
    reembolsoEmProcessamento?: boolean
    exclusaoEmProcessamento?: boolean
}

export interface RegistroReembolso {
    id: string
    inscricaoOriginalId: string
    alunoId: string
    alunoNome: string
    alunoEmail: string | null
    valorPago: string | number
    valorReferencia: string | number | null
    valorDesconto: string | number | null
    modalidadeOriginal: string
    dataReembolso: string
    dataPagamento: string | null
    estado: string
    responsavelReembolso: string | null
    motivo: string | null
}

export interface PagamentoMantido extends RegistroFinanceiro {
    dataExclusao: string
    responsavelExclusao: string | null
    motivo: string | null
}

export const situacoesFinanceiras: Record<string, string> = {
    PAGO: 'Pago integral', DESCONTO: 'Pago com desconto', ISENTO: 'Isento',
    GRATUITO: 'Gratuito', PENDENTE: 'Pendente', SEM_REGISTRO: 'Sem registro financeiro',
}
export function situacaoDoRegistro(registro: RegistroFinanceiro) {
    return registro.status === 'PENDENTE' ? 'PENDENTE' : registro.situacaoFinanceira || 'SEM_REGISTRO'
}
export function resumirFinanceiro(registros: RegistroFinanceiro[], precoAtual: number, reembolsos: RegistroReembolso[] = [], pagamentosMantidos: PagamentoMantido[] = []) {
    const resumo = { inscritos: registros.length, confirmados: 0, pagos: 0, comDesconto: 0, isentos: 0, gratuitos: 0,
        pendentes: 0, semRegistro: 0, recebido: 0, descontos: 0, isencoes: 0, aReceber: 0, pendentesSemValor: 0 }
    for (const registro of registros) {
        const situacao = situacaoDoRegistro(registro)
        if (registro.status === 'CONFIRMADA') resumo.confirmados++
        if (registro.status === 'CONFIRMADA' && (situacao === 'PAGO' || situacao === 'DESCONTO')) {
            resumo.pagos++
            resumo.recebido += Math.round(Number(registro.valorPago ?? 0) * 100)
            if (situacao === 'DESCONTO') {
                resumo.comDesconto++
                resumo.descontos += Math.round(Number(registro.valorDesconto ?? 0) * 100)
            }
        } else if (situacao === 'ISENTO' && registro.status === 'CONFIRMADA') {
            resumo.isentos++
            resumo.isencoes += Math.round(Number(registro.valorReferencia ?? 0) * 100)
        } else if (situacao === 'GRATUITO') resumo.gratuitos++
        else if (situacao === 'PENDENTE') {
            resumo.pendentes++
            if (registro.valorReferencia === null) resumo.pendentesSemValor++
            resumo.aReceber += Math.round(Number(registro.valorReferencia ?? precoAtual) * 100)
        } else resumo.semRegistro++
    }
    let reembolsado = 0
    let qtdReembolsos = 0
    let reembolsosEmProcessamento = 0
    for (const reembolso of reembolsos) {
        if (reembolso.estado !== 'CONCLUIDO') { reembolsosEmProcessamento++; continue }
        const centavos = Math.round(Number(reembolso.valorPago) * 100)
        reembolsado += centavos
        resumo.recebido += centavos
        qtdReembolsos++
    }
    let valorMantido = 0
    for (const pagamento of pagamentosMantidos) valorMantido += Math.round(Number(pagamento.valorPago ?? 0) * 100)
    resumo.recebido += valorMantido
    return { ...resumo, recebido: resumo.recebido / 100, descontos: resumo.descontos / 100,
        isencoes: resumo.isencoes / 100, aReceber: resumo.aReceber / 100,
        reembolsado: reembolsado / 100, saldo: (resumo.recebido - reembolsado) / 100, qtdReembolsos, reembolsosEmProcessamento,
        valorMantido: valorMantido / 100, pagamentosMantidos: pagamentosMantidos.length,
        mantidosSemValor: pagamentosMantidos.filter(p => p.valorPago === null).length }
}

export function celulaCsv(valor: unknown) {
    const texto = String(valor ?? '')
    // Impedir execução de fórmulas ao abrir nomes e observações em uma planilha.
    return `"${(/^[\s]*[=+@-]/.test(texto) ? "'" : '') + texto.replace(/"/g, '""')}"`
}
