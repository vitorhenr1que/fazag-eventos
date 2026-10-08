import { z } from 'zod'
import { AppError } from './app-error'

export const PRAZO_PIX_MS = 1_800_000

function documentoValido(chave: string) {
    if (/^(\d)\1+$/.test(chave)) return false
    const cpf = chave.length === 11
    const base = cpf ? 9 : 12
    for (let etapa = 0; etapa < 2; etapa++) {
        const tamanho = base + etapa
        let soma = 0
        for (let i = 0; i < tamanho; i++) {
            const peso = cpf ? tamanho + 1 - i : ((tamanho - 1 - i) % 8) + 2
            soma += Number(chave[i]) * peso
        }
        const resto = soma % 11
        if (Number(chave[tamanho]) !== (resto < 2 ? 0 : 11 - resto)) return false
    }
    return true
}

export function validarChavePix(valor: string | null) {
    const chave = valor?.trim() ?? ''
    const valida = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chave)
        || /^\+[1-9]\d{1,14}$/.test(chave)
        || (/^[\x21-\x7e]{1,77}$/.test(chave) && z.string().email().safeParse(chave).success)
        || (/^(\d{11}|\d{14})$/.test(chave) && documentoValido(chave))
    if (!valida) throw new AppError('Defina uma chave Pix válida para o evento', 400, 'PIX_CHAVE_INVALIDA')
    return chave
}

export function valorPix(valor: unknown) {
    const texto = String(valor ?? '')
    if (!/^\d{1,8}(\.\d{1,2})?$/.test(texto) || Number(texto) <= 0) {
        throw new AppError('Defina um preço válido para o evento', 400, 'PIX_PRECO_INVALIDO')
    }
    return Number(texto).toFixed(2)
}

function campo(id: string, valor: string) {
    const tamanho = Buffer.byteLength(valor, 'utf8')
    if (tamanho > 99) throw new AppError('Campo Pix excede o limite do BR Code')
    return id + String(tamanho).padStart(2, '0') + valor
}

export function crcPix(payload: string) {
    let crc = 0xffff
    const bytes = Buffer.from(payload, 'utf8')
    for (let pos = 0; pos < bytes.length; pos++) {
        crc ^= bytes[pos] << 8
        for (let i = 0; i < 8; i++) crc = ((crc << 1) ^ (crc & 0x8000 ? 0x1021 : 0)) & 0xffff
    }
    return crc.toString(16).toUpperCase().padStart(4, '0')
}

// BR Code estático. O vencimento é da reserva de preço, não um bloqueio bancário.
export function gerarCodigoPix(chave: string, valor: string, txid: string) {
    if (!/^[a-zA-Z0-9]{1,25}$/.test(txid)) throw new AppError('Referência Pix inválida')
    const payload = campo('00', '01') + campo('26', campo('00', 'br.gov.bcb.pix') + campo('01', validarChavePix(chave)))
        + campo('52', '0000') + campo('53', '986') + campo('54', valorPix(valor)) + campo('58', 'BR')
        + campo('59', 'FAZAG') + campo('60', 'VALENCA') + campo('62', campo('05', txid)) + '6304'
    return payload + crcPix(payload)
}
