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
   - **Admin:** `admin@faculdade.com` / `admin123`
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
2. Entre com: `admin@faculdade.com` / `admin123`.
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
  "email": "admin@faculdade.com",
  "senha": "admin123"
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
