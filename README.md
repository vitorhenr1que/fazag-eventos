# Sistema de Eventos Universitários (FAZAG)

Este projeto é um sistema completo de gestão de eventos acadêmicos, permitindo que alunos se inscrevam em eventos principais e subeventos (workshops, palestras), realizem check-in e emitam certificados automaticamente. O painel administrativo permite criar e gerenciar eventos.

## 🚀 Requisitos de Instalação

- **Node.js** (v18 ou superior)
- **MySQL** (Instância rodando localmente ou Docker)
- **NPM** ou **Yarn**

## 🛠 Configuração Inicial

1. **Clone o repositório e entre na pasta:**
   ```bash
   git clone <repo-url>
   cd eventos-fazag
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```
   *Nota: Se ocorrer erro de permissão (EACCES) no mac/linux, rode:*
   ```bash
   sudo chown -R $USER ~/.npm # Corrige permissões do cache npm
   npm install
   ```

3. **Configuração de Ambiente:**
   Copie o arquivo `.env.example` para `.env`:
   ```bash
   cp .env.example .env
   ```
   Edite o `.env` com suas credenciais do banco MySQL:
   ```env
   DATABASE_URL="mysql://root:sua_senha@localhost:3306/eventos_fazag"
   ADMIN_JWT_SECRET="troque-isso-por-algo-seguro"
   NEXT_PUBLIC_ALUNO_ID="ADM200026"  # ID simulado para desenvolvimento
   ```

## 🗄 Banco de Dados e Seed

1. **Gerar Client Prisma:**
   ```bash
   npm run prisma:generate
   ```

2. **Rodar as Migrações:**
   Isso criará as tabelas no banco de dados.
   ```bash
   npm run prisma:migrate
   ```

3. **Popular o Banco (Seed):**
   Cria admin, alunos e eventos de exemplo.
   ```bash
   npm run prisma:seed
   ```
   *Dados criados:*
   - **Admin:** `nuppex@fazag.edu.br` / `fazagfaz1`
   - **Alunos:** IDs `ADM200026` e `ADM200027`
   - **Evento 1:** "Palestra de Inovação" (Simples)
   - **Evento 2:** "Semana de Tecnologia" (Com Subeventos)

## ▶️ Executando o Projeto

Para iniciar o ambiente de desenvolvimento:

```bash
npm run dev
```
Acesse: `http://localhost:3000`

## 🧪 Testando as Funcionalidades

### 🎓 Área do Aluno (Simulação)
Como não há login de aluno, a identidade é injetada via header `x-aluno-id`.
Em desenvolvimento, o frontend usa o valor de `NEXT_PUBLIC_ALUNO_ID` do `.env`.

1. **Listar Eventos:** Acesse `/eventos`.
2. **Inscrever-se:** Clique em um evento, veja detalhes e inscreva-se.
3. **Gerenciar Subeventos:** Se o evento tiver subeventos (ex: Semana de Tecnologia), após a inscrição você será direcionado para selecionar as atividades.
4. **Minhas Inscrições:** Acesse `/minhas-inscricoes` para ver status.
5. **Certificado:**
   - O certificado só é emitido após check-in.
   - Para testar emissão, você precisará simular o check-in (via API ou Admin).

### 🔑 Área Administrativa

1. Acesse `/admin/login`.
2. Entre com: `email@fazag.edu.br` / `senha`.
3. (Funcionalidades de Dashboard Admin ainda em desenvolvimento, mas login gera token JWT válido no LocalStorage).

### 📡 Teste de API (Exemplos CURL / .http)

**1. Listar Eventos (Aluno):**
```http
GET http://localhost:3000/api/eventos
x-aluno-id: ADM200026
```

**2. Login Admin:**
```http
POST http://localhost:3000/api/admin/auth/login
Content-Type: application/json

{
  "email": "nuppex@fazag.edu.br",
  "senha": "fazagfaz1"
}
```

**3. Check-in Manual (Simulando QR Code):**
```http
POST http://localhost:3000/api/inscricoes/{ID_INSCRICAO}/checkin-evento
x-aluno-id: ADM200026
```

## 🏗 Estrutura do Projeto

- `src/app/(aluno)`: Rotas públicas do aluno.
- `src/app/(admin)`: Rotas protegidas do admin.
- `src/app/api`: Backend (Route Handlers).
- `src/services`: Regras de negócio.
- `src/repositories`: Acesso ao banco (Prisma).
- `prisma/schema.prisma`: Modelagem do banco.

---
Desenvolvido com Next.js 14+ (App Router), Prisma e Tailwind CSS.

## Relatório financeiro

### Perfis administrativos

| Perfil | Acesso |
| --- | --- |
| ADMIN / SUPER_ADMIN | Todas as áreas administrativas |
| NUPPEX | Dashboard, eventos, inscrições, presença, certificados e tipos de atividade; sem ações financeiras |
| FINANCEIRO | Apenas Pendentes e Financeiro, incluindo aprovação, desconto, isenção, cancelamento de pagamento e registro de reembolso |

O login direciona o FINANCEIRO para Pendentes. A navegação mostra somente as áreas permitidas,
e todas as APIs administrativas verificam o perfil atual no banco; alterações de perfil valem também
para tokens emitidos anteriormente. O botão Financeiro na lista de eventos aparece somente em
eventos pagos e para quem tem acesso financeiro. Senhas dos usuários são armazenadas como hashes bcrypt.

O painel `/admin/financeiro` permite selecionar um evento, consultar quantidades de inscritos,
confirmados, pagos, pagos com desconto, isentos, gratuitos e pendentes, além de exportar CSV.
O total arrecadado soma somente os recebimentos registrados. O detalhamento inclui aluno,
valor de referência, valor recebido, desconto ou isenção, data, administrador e observação.
Os filtros afetam o detalhamento e sua exportação; os indicadores sempre representam o evento inteiro.

Em `/admin/inscricoes/pendentes`:

- **Aprovar** confirma o pagamento integral do valor de referência da inscrição.
- **Desconto** permite informar o valor efetivamente recebido e confirmar o pagamento.
- **Isenção** confirma sem recebimento e registra o valor dispensado.

Novas inscrições preservam o preço vigente na inscrição. Mudanças posteriores no preço do evento
não alteram esses valores nem os pagamentos já aprovados. Pendências anteriores à atualização,
sem referência histórica, usam o preço vigente na aprovação. Aprovações anteriores sem registro
financeiro aparecem explicitamente como **Sem registro financeiro** e não são estimadas como receita.
O valor a receber é uma estimativa antes de eventuais descontos ou isenções; para pendências
antigas sem valor registrado, essa estimativa usa o preço atual do evento.

Para instalar em um banco com histórico de migrações atualizado:

```bash
npx prisma migrate deploy
npx prisma generate
```

A migração `20261007120000_financeiro_inscricoes` somente adiciona campos opcionais,
sem preencher valores financeiros antigos. Se o banco tiver sido mantido com `prisma db push`,
confira as migrações já refletidas na estrutura antes de usar `migrate deploy`; uma migração
efetivamente aplicada pode ser registrada no histórico com `prisma migrate resolve --applied`.
Não marque como aplicada uma migração cuja estrutura ainda não existe.

Para validar cálculos financeiros e exportação:

```bash
node --test tests/*.test.cjs
```

No detalhamento do relatório, **Cancelar pagamento** limpa o pagamento ou isenção, mantém o valor
de referência e devolve a inscrição a Pendentes. Essa ação não é contabilizada como reembolso.
**Reembolsar** registra a devolução integral do valor recebido e exclui a inscrição e seus vínculos
(atividades escolhidas, presenças e certificado). O cadastro do aluno permanece.
O histórico de reembolsos é independente da inscrição e preserva nome, valor original, data,
administrador responsável e motivo. Pagamentos antigos exigem a informação explícita do valor recebido.
O relatório mostra arrecadação bruta, devoluções e saldo após reembolsos. Não há integração com um
processador de pagamentos: a ação registra uma devolução realizada pelo administrador.
Se a exclusão for interrompida, use **Concluir reembolso** no histórico para retomar a operação
sem duplicar a devolução. Isso também funciona nas tabelas MyISAM do banco existente.

Na lista `/admin/eventos/[id]/inscricoes`, somente o **ADMINISTRADOR** pode usar
**Excluir inscrição**. Eventos pagos exigem escolher entre registrar reembolso,
excluir inscrição e pagamento sem reembolso, ou excluir somente a inscrição mantendo o pagamento.
Eventos gratuitos possuem confirmação simples. Pendentes não possuem pagamento para manter ou reembolsar;
isenções não geram reembolso. Todas as opções excluem os vínculos da inscrição, sem excluir o cadastro do aluno.
Os pagamentos mantidos ficam em histórico próprio no relatório e no CSV, com os valores originais,
datas, responsáveis e motivo; continuam na receita, mas não contam como inscrições atuais.
Exclusões interrompidas aparecem na lista em **Exclusões em processamento** e podem ser retomadas
pela opção original, mesmo quando a inscrição já foi removida.

## ☁️ Configuração Cloudflare R2 (CORS)

Para permitir o upload direto de banners do navegador para o R2, você deve configurar o CORS no bucket `fazag-eventos`:

1. Acesse o painel Cloudflare > R2 > Buckets > **fazag-eventos**.
2. Vá na aba **Settings** > **CORS Policy**.
3. Adicione a seguinte configuração JSON:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://fazag.edu.br", "https://cdn.fazag.edu.br"],
    "AllowedMethods": ["GET", "HEAD", "PUT"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```
*(Nota: Certifique-se de incluir o domínio administrativo se for diferente dos listados).*
