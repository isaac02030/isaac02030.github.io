# Relatório do Codex

## Feito
- Criados `docs/conselho/decisoes.md` e `docs/conselho/agentes.md` com as instruções fornecidas para o conselho do Nexus.
- A tela da missão respeita o estado do interruptor de emparelhamento automático informado pelo backend.
- Commit `975d24b` enviado ao branch `codex/nexus-council-and-matching-switch`.
- Dédalo: criada a pasta `nexus-v2/` com a base (tokens da direção A "Caderno quente", CSS base, `api.js` com a URL num só lugar) e a tela 00 de entrar e criar conta. A fonte Figtree fica no próprio app. A pasta `nexus/` não foi alterada. O link "Esqueci a senha" fica escondido. Pull request aberto a partir deste branch, sem merge.
- Clara (Designer de UX) aprovou a tela e pediu 5 ajustes, feitos no mesmo pull request: cartão centralizado com `padding-top` e `env(safe-area-inset-top)`; texto "Sem internet" em português do Brasil e ícone de wi-fi cortado; "Mostrar senha" virou botão de texto, sem borda, com 44 px; "Entrando…" desativa o botão, usa `aria-busy` e um spinner que não gira quando a pessoa pede menos movimento; a borda dos campos já passava de 3:1 e os valores medidos foram para a descrição do PR.

## Feito depois (onboarding)
- Três passos do começo da missão em `nexus-v2/onboarding.html`, mais um Hoje simples. A pasta `nexus/` não foi alterada.
- Depois de entrar, quem não tem missão ativa cai no começo. Quem já tem missão cai no Hoje.
- O pedido da missão manda só os campos combinados. O horário do lembrete chama a rota planejada e, se ela não existir, fica só no aparelho.

## Pendente
- A tela Hoje ainda é um marcador. O check-in de verdade não existe.
- A rota `PUT /api/users/me/reminder` não existe no servidor. O app já chama e não trava se vier 404.
- Trocar `NEXUS_API_URL` em `nexus-v2/api.js` quando houver um servidor novo. O servidor antigo continua desligado.
- As rotas de redefinir senha ainda não existem.
- Nada foi mesclado em `main`.

## Dúvidas
- Nenhuma nesta etapa.
