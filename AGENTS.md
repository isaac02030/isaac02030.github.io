# Instruções para agentes

## Revisão obrigatória de PR

Antes de pedir o sim do Isaac, todo pull request passa por uma revisão só de leitura, feita por um agente diferente de quem escreveu o código.

O revisor não edita nada. Só relata:

- o risco: baixo, médio ou alto;
- os problemas, com o arquivo e a linha;
- a recomendação: mesclar, corrigir antes, ou precisa de decisão do dono.

Nada é mesclado sem o sim do Isaac.

### Checklist

**AUTORIZAÇÃO**

- Toda rota nova ou alterada usada pela tela exige login.
- A tela não mostra dados de quem não participa.
- Ex-participantes não gravam.

**BANCO/ROTAS**

- O site não muda o banco.
- O pull request diz qual rota nova do servidor ele espera. Se não espera nenhuma, diz isso.

**DADOS PESSOAIS E SEGREDOS**

- Nenhuma chave, token, senha, nome real ou dado de saúde no código, nos prints, nos mocks ou na descrição.
- Mocks só em localhost, com checagem automática, e nunca fingem que salvou em produção.
- Textos sensíveis (notas de crise) não são guardados nem enviados onde não devem.

**TESTES**

- Os scripts de checagem passam.
- Há teste do caso negado quando couber.

**TELAS**

- Estados de erro, vazio e sem internet.
- Claro e escuro.
- Telas de crise calmas, sem animação e sem cor de alarme.
- Números de crise reconferidos nas fontes antes de cada lançamento.

**DEPENDÊNCIAS**

- Pacote, skill ou plugin novo de terceiros só entra depois da leitura do código e do sim do Isaac.
