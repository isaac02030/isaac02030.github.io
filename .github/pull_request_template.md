## O que muda e por quê

<!-- Em português simples: o que este pull request muda e por que. -->

## Área sensível

Este repositório é público. Se o pull request mexe em crise, dados pessoais, senhas ou banco, avise aqui. Se não mexe em nenhuma dessas áreas, escreva "nenhuma".

- Crise:
- Dados pessoais:
- Senhas:
- Banco:

## Rota nova do servidor

O site não muda o banco. Escreva qual rota nova do servidor este pull request espera. Se não espera nenhuma, escreva "nenhuma".

-

## Checklist

### AUTORIZAÇÃO

- [ ] Toda rota nova ou alterada usada pela tela exige login.
- [ ] A tela não mostra dados de quem não participa.
- [ ] Ex-participantes não gravam.

### BANCO/ROTAS

- [ ] O site não muda o banco.
- [ ] A rota nova do servidor que este pull request espera está escrita acima.

### DADOS PESSOAIS E SEGREDOS

- [ ] Nenhuma chave, token, senha, nome real ou dado de saúde no código, nos prints, nos mocks ou na descrição.
- [ ] Mocks só em localhost, com checagem automática, e nunca fingem que salvou em produção.
- [ ] Textos sensíveis (notas de crise) não são guardados nem enviados onde não devem.

### TESTES

- [ ] Os scripts de checagem passam.
- [ ] Há teste do caso negado quando couber.

### TELAS

- [ ] Estados de erro, vazio e sem internet.
- [ ] Claro e escuro.
- [ ] Telas de crise calmas, sem animação e sem cor de alarme.
- [ ] Números de crise reconferidos nas fontes antes de cada lançamento.

### DEPENDÊNCIAS

- [ ] Pacote, skill ou plugin novo de terceiros só entra depois da leitura do código e do sim do Isaac.

## Revisado por (agente diferente de quem escreveu)

<!-- Nome do agente que só leu. Tem de ser outro, não quem escreveu o código. O revisor não edita nada. -->

- Risco (baixo, médio ou alto):
- Problemas (arquivo e linha):
- Recomendação (mesclar / corrigir antes / precisa de decisão do dono):

Nada é mesclado sem o sim do Isaac.
