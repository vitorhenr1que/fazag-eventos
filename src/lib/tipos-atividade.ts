export const TIPOS_ATIVIDADE_INICIAIS = [
    {
        nome: 'Estudos de iniciação científica',
        descricao: 'Atividades de pesquisa científica desenvolvida pelo aluno ou grupo de alunos, sob orientação de um docente da IES, inseridos formalmente no programa de práticas investigativas',
        cargaHorariaMaxima: 20,
        porcentagemAnual: 10,
    },
    {
        nome: 'Participação em eventos científicos como ouvinte (Externos)',
        descricao: 'Participação em congressos, seminários, simpósios, cursos e afins',
        cargaHorariaMaxima: 50,
        porcentagemAnual: 20,
    },
    {
        nome: 'Apresentação de trabalhos em evento científico',
        descricao: 'Apresentação de trabalhos em evento científico promovidos por profissionais/grupos de profissionais (pôster ou apresentação oral)',
        cargaHorariaMaxima: 40,
        porcentagemAnual: 10,
    },
    {
        nome: 'Atividades voluntárias',
        descricao: 'Atividades de voluntariado realizadas em instituições reconhecidas',
        cargaHorariaMaxima: 60,
        porcentagemAnual: 15,
    },
    {
        nome: 'Estágio extracurricular',
        descricao: 'Atividades de estágio pertinentes à área do curso validadas pela coordenação de estágios',
        cargaHorariaMaxima: 100,
        porcentagemAnual: 20,
    },
    {
        nome: 'Visitas técnicas',
        descricao: 'Visitas a locais ou entidades de interesse à área do curso, validadas pela coordenação do curso',
        cargaHorariaMaxima: 40,
        porcentagemAnual: 10,
    },
    {
        nome: 'Monitoria',
        descricao: 'Atividades de monitoria regulamentada pela IES',
        cargaHorariaMaxima: 100,
        porcentagemAnual: 20,
    },
    {
        nome: 'Participação em Cargos de Representação Estudantil',
        descricao: 'Participação como membro regular em exercício de mandato, por eleição de seus pares, em atividades do Diretório Acadêmico, Atlética e/ou Colegiados da IES',
        cargaHorariaMaxima: 50,
        porcentagemAnual: 10,
    },
    {
        nome: 'Semana Científica',
        descricao: 'Evento da IES com atribuição de estímulo à pesquisa, interação, divulgação científica e expansão do conhecimento',
        cargaHorariaMaxima: 120,
        porcentagemAnual: 20,
    },
    {
        nome: 'Fazação',
        descricao: 'Eventos sociais que levam a faculdade para a comunidade, parte dos programas de extensão universitária, buscando compartilhar conhecimento e promover a inclusão social',
        cargaHorariaMaxima: 120,
        porcentagemAnual: 20,
    },
    {
        nome: 'Palestras, rodas de conversas, simpósio, oficinas, congressos (Internos Fazag)',
        descricao: 'Eventos internos que complementam a formação acadêmica, proporcionando atualização, networking e desenvolvimento de habilidades práticas',
        cargaHorariaMaxima: 120,
        porcentagemAnual: 20,
    },
]

export type TipoAtividadeInicial = (typeof TIPOS_ATIVIDADE_INICIAIS)[number]
