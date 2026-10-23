# Shared Kernel

Contratos e utilitários reutilizáveis entre módulos.

## Princípios

- `domain`: não depende de NestJS, TypeORM ou HTTP.
- `application`: orquestra casos de uso e depende apenas de portas.
- `infrastructure`: implementa portas e integra com tecnologias.

## Convenções

- Prefira `type` imports para contratos.
- Regras de negócio ficam no `domain` dos módulos, nunca em controllers.
- Um módulo só conversa com outro através do que ele exporta no seu
  `*.module.ts` (casos de uso ou tokens de porta) — nunca importando
  `infrastructure/` de outro módulo.
