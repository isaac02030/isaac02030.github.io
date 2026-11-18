# Relatório do Codex

## Feito
- Criados `docs/conselho/decisoes.md` e `docs/conselho/agentes.md` com as instruções fornecidas para o conselho do Nexus.
- A tela da missão respeita o estado do interruptor de emparelhamento automático informado pelo backend.
- Commit `975d24b` enviado ao branch `codex/nexus-council-and-matching-switch`.
- Dédalo: criada a pasta `nexus-v2/` com a base (tokens da direção A "Caderno quente", CSS base, `api.js` com a URL num só lugar) e a tela 00 de entrar e criar conta. A fonte Figtree fica no próprio app. A pasta `nexus/` não foi alterada. O link "Esqueci a senha" fica escondido. Pull request aberto a partir deste branch, sem merge.

## Pendente
- As telas seguintes (onboarding e Hoje) ainda não existem. Depois de entrar, a tela só confirma e guarda a sessão neste aparelho.
- Trocar `NEXUS_API_URL` em `nexus-v2/api.js` quando houver um servidor novo. O servidor antigo continua desligado.
- As rotas de redefinir senha ainda não existem.
- Nada foi mesclado em `main`.

## Dúvidas
- Nenhuma nesta etapa.
