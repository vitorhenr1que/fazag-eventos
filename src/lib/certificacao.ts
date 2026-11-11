interface EventoCargaHoraria {
    cargaHorariaBase: number | null
    limiteSubeventosPorAluno?: number | null
}

interface PresencaSubevento {
    checkIn?: unknown
    subevento?: { cargaHoraria: number } | null
}

export function calcularCargaHorariaSubeventos(evento: EventoCargaHoraria, subeventos: PresencaSubevento[] = []) {
    const presencas = subeventos.filter(s => s.checkIn && s.subevento)
    const limite = evento.limiteSubeventosPorAluno
    if (limite != null && limite > 0 && presencas.length >= limite &&
        evento.cargaHorariaBase != null && evento.cargaHorariaBase > 0) {
        return evento.cargaHorariaBase
    }
    return presencas.reduce((total, item) => total + (item.subevento?.cargaHoraria || 0), 0)
}

interface InscricaoCertificavel {
    status: string
    checkIn?: unknown
    evento: EventoCargaHoraria & {
        status: string
        dataFim: Date | string
        temSubeventos: boolean
        certificado?: { ativo: boolean } | null
    }
    subeventosEscolhidos?: PresencaSubevento[]
}

export function avaliarCertificacao(inscricao: InscricaoCertificavel, agora = new Date()) {
    const { evento } = inscricao
    const presencasSub = evento.temSubeventos ? (inscricao.subeventosEscolhidos || []).filter(s => s.checkIn && s.subevento) : []
    const temPresenca = Boolean(inscricao.checkIn) || presencasSub.length > 0
    const cargaHoraria = presencasSub.length
        ? calcularCargaHorariaSubeventos(evento, presencasSub)
        : inscricao.checkIn ? evento.cargaHorariaBase || 0 : 0
    const eventoFinalizado = evento.status === 'FINISHED' || (evento.status === 'PUBLISHED' && new Date(evento.dataFim).getTime() <= agora.getTime())
    let motivo: string | null = null
    if (inscricao.status !== 'CONFIRMADA') motivo = 'A inscrição precisa estar confirmada para emitir certificado.'
    else if (!evento.certificado?.ativo) motivo = 'A emissão de certificados ainda não foi liberada pela organização.'
    else if (!eventoFinalizado) motivo = 'O certificado só pode ser gerado após o término do evento.'
    else if (!temPresenca) motivo = 'Presença não confirmada. É necessário check-in no evento ou em uma de suas atividades.'
    else if (!Number.isFinite(cargaHoraria) || cargaHoraria <= 0) motivo = 'A organização precisa configurar a carga horária para a sua participação.'
    return { liberado: motivo === null, motivo, cargaHoraria, temPresenca, eventoFinalizado }
}
