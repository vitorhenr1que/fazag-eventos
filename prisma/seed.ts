import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    console.log('🌱 Iniciando seed...')

    // 1. Criar Admin
    const adminEmail = 'admin@faculdade.com'
    const adminSenha = await bcrypt.hash('admin123', 10)

    const admin = await prisma.admin.upsert({
        where: { email: adminEmail },
        update: {},
        create: {
            email: adminEmail,
            nome: 'Administrador Principal',
            senha: adminSenha,
            role: 'SUPER_ADMIN'
        }
    })
    console.log(`👤 Admin criado: ${admin.email}`)

    // 2. Criar Alunos
    const alunosIds = ['ADM200026', 'ADM200027']
    for (const id of alunosIds) {
        await prisma.aluno.upsert({
            where: { id },
            update: {},
            create: {
                id,
                nome: `Aluno Teste ${id}`,
                email: `aluno.${id.toLowerCase()}@faculdade.com`
            }
        })
    }
    console.log(`🎓 Alunos criados: ${alunosIds.join(', ')}`)

    // 3. Evento Simples (Sem subeventos)
    const eventoSimples = await prisma.evento.upsert({
        where: { slug: 'palestra-inovacao-2026' },
        update: {},
        create: {
            nome: 'Palestra de Inovação e Carreira',
            slug: 'palestra-inovacao-2026',
            descricao: 'Uma palestra incrível sobre o futuro do mercado de trabalho.',
            local: 'Auditório Principal',
            dataInicio: new Date('2026-05-10T19:00:00'),
            dataFim: new Date('2026-05-10T22:00:00'),
            totalVagas: 100,
            status: 'PUBLISHED',
            tipo: 'GRATUITO',
            temSubeventos: false,
            cargaHorariaBase: 180, // 3 horas
            limiteSubeventosPorAluno: null
        }
    })
    console.log(`📅 Evento Simples criado: ${eventoSimples.nome}`)

    // 4. Evento Composto (Semana Acadêmica)
    const eventoComposto = await prisma.evento.upsert({
        where: { slug: 'semana-tecnologia-2026' },
        update: {},
        create: {
            nome: 'Semana de Tecnologia 2026',
            slug: 'semana-tecnologia-2026',
            descricao: 'Evento com múltiplos workshops e palestras.',
            local: 'Campus I',
            dataInicio: new Date('2026-10-20T08:00:00'),
            dataFim: new Date('2026-10-25T18:00:00'),
            totalVagas: 500,
            status: 'PUBLISHED',
            tipo: 'PAGO',
            temSubeventos: true,
            cargaHorariaBase: null,
            limiteSubeventosPorAluno: 3, // Aluno pode escolher até 3
            subeventos: {
                create: [
                    {
                        nome: 'Workshop: React Avançado',
                        descricao: 'Aprenda padrões avançados de React.',
                        local: 'Lab 01',
                        dataInicio: new Date('2026-10-21T14:00:00'),
                        dataFim: new Date('2026-10-21T18:00:00'),
                        totalVagas: 30,
                        cargaHoraria: 240
                    },
                    {
                        nome: 'Palestra: IA Generativa nos Negócios',
                        descricao: 'Impactos da IA no mundo corporativo.',
                        local: 'Auditório B',
                        dataInicio: new Date('2026-10-22T19:00:00'),
                        dataFim: new Date('2026-10-22T21:00:00'),
                        totalVagas: 100,
                        cargaHoraria: 120
                    },
                    {
                        nome: 'Minicurso: Docker para Iniciantes',
                        descricao: 'Containerização na prática.',
                        local: 'Lab 03',
                        dataInicio: new Date('2026-10-23T08:00:00'),
                        dataFim: new Date('2026-10-23T12:00:00'),
                        totalVagas: 25,
                        cargaHoraria: 240
                    }
                ]
            }
        }
    })
    console.log(`📅 Evento Composto criado: ${eventoComposto.nome} com subeventos`)

    console.log('✅ Seed finalizado com sucesso!')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
