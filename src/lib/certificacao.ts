interface InscricaoCertificavel {
    status: string
    checkIn?: unknown
    evento: {
        status: string
        dataFim: Date | string
        temSubeventos: boolean
        cargaHorariaBase: number | null
        certificado?: { ativo: boolean } | null
    }
    subeventosEscolhidos?: { checkIn?: unknown; subevento?: { cargaHoraria: number } | null }[]
}

export function avaliarCertificacao(inscricao: InscricaoCertificavel, agora = new Date()) {
    const { evento } = inscricao
    const presencasSub = evento.temSubeventos ? (inscricao.subeventosEscolhidos || []).filter(s => s.checkIn && s.subevento) : []
    const temPresenca = Boolean(inscricao.checkIn) || presencasSub.length > 0
    // Preserva as horas das atividades cursadas; na presença geral, usa a carga base.
    const cargaHoraria = presencasSub.length
        ? presencasSub.reduce((total, item) => total + (item.subevento?.cargaHoraria || 0), 0)
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
