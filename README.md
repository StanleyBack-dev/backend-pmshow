# PM SHOW — Backend

API NestJS + **GraphQL** (Apollo, code-first) do app da banda PM SHOW (Polícia
Militar de Goiás): repertório, mídias, agenda, escalas e notificações. O plano
completo está em [`../PLANO.md`](../PLANO.md).

## Arquitetura

DDD modular com Ports & Adapters. Cada módulo tem suas próprias camadas:

```
src/modules/<módulo>/
├── domain/                regras puras (sem Nest, TypeORM, GraphQL) — o lint bloqueia esses imports
├── application/           casos de uso + ports (interfaces) — só depende de ports
├── infrastructure/        adapters (TypeORM, Neon Object Storage, Brevo, Web Push, oEmbed)
└── presentation/graphql/  resolvers + DTOs (@ObjectType / @InputType)
```

- Um módulo só conversa com outro pelo que ele exporta no `*.module.ts`.
- O GraphQL fica em `/graphql`. O REST existe só para o health check (`GET /`)
  e para as rotas `/internal/*` chamadas pelos workflows agendados.
- Toda requisição precisa do header `X-Internal-Api-Key`: só o BFF (Next.js)
  conhece essa chave.
- Os erros chegam como `{ message, extensions: { code, statusCode, details } }`
  (`AppException` + catálogos em `src/common/exceptions/catalogs`).
- Proteções do GraphQL: introspecção desligada em produção, sem playground,
  limite de profundidade (`depthLimitRule`) e de aliases (`aliasLimitRule`).
- Login e recuperação de senha têm limite por IP (`AuthThrottleService`), além
  do bloqueio por conta. O IP é guardado só como HMAC.
- Os logs passam por `redact()`, que mascara e-mails, telefones e tokens (LGPD).

### Módulos

| Módulo           | Responsabilidade                                                                                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `identity`       | Usuários, credenciais (scrypt), sessões (access JWT + refresh revogável), primeiro acesso, recuperação de senha, bloqueio por tentativas e bootstrap do ADMIN_MASTER |
| `access-control` | Grupos (`USER`, `ADMIN`, `ADMIN_MASTER`), permissões padrão por grupo, exceções por usuário, `PermissionsGuard` + `@RequirePermissions`                              |
| `audit`          | Trilha de auditoria das ações administrativas (a leitura exige `AUDIT_READ`)                                                                                         |
| `mails`          | Provider (log ou Brevo) + templates                                                                                                                                  |
| `members`        | Perfil na banda: nome de guerra, posto/graduação, naipe, situação e instrumentos                                                                                     |
| `repertoire`     | Músicas, categorias, tonalidade, tags e busca sem acento                                                                                                             |
| `media`          | Áudios (Neon Object Storage, URLs assinadas) e vídeos do YouTube                                                                                                     |
| `events`         | Agenda: eventos, locais e setlist por evento                                                                                                                         |
| `availability`   | Indisponibilidades (férias, licença, missão…) com aprovação                                                                                                          |
| `rosters`        | Escalas: regras de conflito, publicação, ciência, avisos e lembretes                                                                                                 |
| `outbox`         | Fila transacional entre módulos, com novas tentativas                                                                                                                |
| `notifications`  | Caixa de entrada, e-mail (com `.ics`) e Web Push, com preferências por pessoa                                                                                        |
| `broadcasts`     | Comunicados para a banda, um naipe ou os escalados de um evento                                                                                                      |
| `dashboard`      | Painel do gestor (contagens só de leitura)                                                                                                                           |
| `maintenance`    | Limpeza diária de dados vencidos (sessões, códigos, fila, notificações lidas)                                                                                        |

Guards globais, nesta ordem: chave interna do BFF → sessão → primeiro acesso
(senha temporária) → permissões. As permissões são lidas a cada requisição, então
uma revogação vale na hora, sem esperar o token expirar.

### Schema

O schema é gerado a partir dos resolvers. O arquivo `src/graphql/schema.gql`,
que o frontend usa para gerar tipos, vem só de:

```bash
npm run schema:generate   # não precisa de banco
```

O CI falha se o arquivo estiver desatualizado (`npm run schema:check`).

### E-mail

`MAIL_DRIVER=log` registra os e-mails no console sem enviar (use até a conta
Brevo existir). `MAIL_DRIVER=brevo` envia de verdade e exige `BREVO_API_KEY` e
`MAIL_FROM_EMAIL`.

## Rodando localmente

```bash
npm install
cp .env.example .env.local        # preencha os valores
npm run secrets:generate          # INTERNAL_API_KEY, CRON_SECRET, JWT_ACCESS_SECRET, AUTH_HASH_SECRET
npm run migration:run
# primeiro admin: preencha BOOTSTRAP_ADMIN_MASTER_* com ENABLED=true, suba a API
# uma vez e depois volte para ENABLED=false
npm run start:dev                 # http://localhost:4000/graphql
```

## Deploy (Vercel + Neon)

1. Crie o banco no Neon e copie a connection string **pooled**.
2. Importe este repositório na Vercel e configure as variáveis do `.env.example` com `NODE_ENV=production`.
3. O workflow `deploy-backend.yml` roda as migrations antes de cada deploy em produção.

As rotinas agendadas (`.github/workflows/routines.yml`) rodam pelo **GitHub
Actions**, chamando `/internal/*` com `CRON_SECRET`, e não pelo cron da Vercel.
Elas precisam dos secrets `API_URL` e `CRON_SECRET` no repositório.

Backup, restauração e o dia a dia da operação estão em
[`docs/OPERACAO.md`](docs/OPERACAO.md).

## Scripts

`npm test` · `npm run lint:check` · `npm run typecheck` · `npm run build` · `npm run schema:generate` · `npm run migration:create` · `npm run storage:cors` · `npm run push:vapid`
