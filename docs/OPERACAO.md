# Operação

Guia para manter a API do PM SHOW funcionando: rotinas, backup, restauração
e o que fazer quando algo falha.

## Rotinas agendadas

`.github/workflows/routines.yml` chama as rotas internas com
`Authorization: Bearer $CRON_SECRET`. Elas ficam paradas até existirem os
secrets `API_URL` (URL pública da API) e `CRON_SECRET` em
**Settings → Secrets and variables → Actions**.

| Quando (horário de Goiás) | Rota                                   | O que faz                                                    |
| ------------------------- | -------------------------------------- | ------------------------------------------------------------ |
| A cada 15 min             | `POST /internal/outbox/process`        | Reenvia notificações que falharam (e-mail fora do ar etc.)    |
| 03:30                     | `POST /internal/media/purge-stale-uploads` | Remove uploads de áudio iniciados e nunca confirmados     |
| 03:30                     | `POST /internal/maintenance/cleanup`   | Apaga dados vencidos (veja "Retenção")                       |
| 06:00                     | `POST /internal/rosters/reminders`     | Lembretes da véspera e do dia para os escalados              |

Para rodar na hora: **Actions → Routines → Run workflow** (roda todas as etapas).

## Retenção de dados (LGPD)

A limpeza diária guarda só o necessário:

| Dado                                   | Fica por                     |
| -------------------------------------- | ---------------------------- |
| Sessões encerradas (com IP e navegador) | 30 dias depois do fim       |
| Códigos de recuperação de senha         | 7 dias depois de expirar    |
| Mensagens entregues da fila (outbox)    | 30 dias                     |
| Notificações lidas                      | 1 ano                       |
| Contadores de limite por IP             | 1 dia (só o HMAC do IP)     |

A trilha de auditoria **não** é apagada: ela registra quem fez o quê nas
ações administrativas.

## Backup e restauração (Neon)

O Neon guarda o histórico do banco (*point-in-time restore*). O tamanho da
janela depende do plano: confira em **Project → Settings → Storage**.

### Restaurar um momento anterior

1. No console do Neon, abra o projeto → **Branches** → **Create branch**.
2. Escolha a branch de produção como origem e marque **Past data**
   (*point in time*), com a data e a hora desejadas.
3. Confira os dados na branch nova, pelo **SQL Editor** ou apontando uma API
   local para a connection string dela.
4. Para voltar a produção a esse ponto, use **Restore** na branch de produção,
   escolhendo o mesmo momento. O Neon guarda o estado anterior como backup
   automático, então dá para desfazer.
5. Rode `npm run migration:run:prod` se a restauração voltou para antes de
   alguma migration.

### Cópia fora do Neon (mensal, recomendado)

```bash
pg_dump "$DATABASE_URL_DIRECT" --format=custom --no-owner --file=pmshow-AAAA-MM-DD.dump
```

- Use a connection string **direta** (sem `-pooler`).
- O arquivo tem dados pessoais (nomes, matrículas, telefones). Guarde num local
  privado com acesso restrito. **Nunca** no repositório nem como artifact do
  GitHub Actions: os repositórios são públicos.
- Para restaurar: `pg_restore --no-owner --dbname "$DATABASE_URL_DIRECT" pmshow-AAAA-MM-DD.dump`
  numa branch vazia.

Os áudios ficam no Neon Object Storage, que é da mesma branch. Restaurar o
banco não restaura arquivos apagados, então apague áudios com cuidado.

## Quando algo dá errado

- **Notificações não chegam:** o painel do gestor (Início) mostra
  "notificações não puderam ser enviadas" quando a fila desistiu de alguma.
  Veja `tb_outbox` com `status = 'FAILED'` e a coluna `last_error`, que já vem
  sem dados pessoais. Corrija a causa (por exemplo, `BREVO_API_KEY`) e volte as
  linhas para `PENDING`:

  ```sql
  UPDATE tb_outbox SET status = 'PENDING', attempts = 0, next_attempt_at = now()
   WHERE status = 'FAILED';
  ```

  A próxima rodada (até 15 min) reenvia.

- **Alguém ficou bloqueado no login:** um gestor pode desbloquear a conta em
  **Administração → Usuários**. O limite por IP (`AUTH_TOO_MANY_REQUESTS`) passa
  sozinho em até 15 minutos.

- **Chave vazada:** gere outra com `npm run secrets:generate` e atualize a
  variável na Vercel (e no frontend, no caso de `INTERNAL_API_KEY`). Trocar
  `JWT_ACCESS_SECRET` ou `AUTH_HASH_SECRET` encerra todas as sessões.
