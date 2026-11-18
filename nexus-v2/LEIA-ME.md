# Nexus v2

App novo, em HTML, CSS e JavaScript puro, sem etapa de build. Esta pasta tem a base e a tela de entrar e criar conta. A pasta `nexus/` é o app antigo e não entra nesta versão.

## Ver neste computador

Na raiz do repositório, abra dois terminais.

Terminal 1, o servidor falso (só para teste, não é o Nexus de verdade):

```bash
node nexus-v2/dev/mock-api.js
```

Terminal 2, a pasta do app:

```bash
python3 -m http.server 8080 --directory nexus-v2
```

Abra http://localhost:8080/

No mock, para ver os estados:

- Vazio: toque em Entrar sem escrever nada.
- Erro: use a senha `errada`.
- Devagar: use o e-mail `lento@exemplo.com`.
- Falha do servidor: use o e-mail `falha@exemplo.com`.
- Nome já usado no cadastro: `repetido` ou `repetido@exemplo.com`.
- Sem internet: desligue a internet no navegador, ou feche o terminal do mock, e tente de novo.

Esses atalhos existem só no arquivo `dev/mock-api.js`.

Para ver o escuro com o celular no claro, abra http://localhost:8080/?tema=escuro . Para voltar ao claro, `?tema=claro`. Sem o parâmetro, a tela segue o modo do aparelho.

## Trocar o endereço da API

Abra `api.js`. A URL está numa linha só:

```js
var NEXUS_API_URL = "http://localhost:3000";
```

O servidor antigo está desligado. Quando houver um servidor novo, troque só esse endereço. O login usa `POST /api/users/login`. O cadastro usa `POST /api/users/register`.

## O que esta tela ainda não faz

O link "Esqueci a senha" fica escondido porque essa rota ainda não existe. Depois de entrar ou criar conta, a tela olha as missões. Sem missão ativa, abre o começo (`onboarding.html`). Com missão, abre o Hoje (`hoje.html`).

## Começo da missão

São 3 passos na mesma página. O que a pessoa escreve fica neste aparelho (`sessionStorage`) enquanto ela volta e avança.

1. Escolhe Estudo ou Academia e escreve o objetivo. O exemplo fica numa ajuda embaixo do rótulo, não dentro do campo. Nada é enviado.
2. Escreve por que importa e o mínimo do dia. O cartão de cima tem três linhas (o objetivo, o mínimo e o porquê) e muda enquanto ela digita. Nada é enviado.
3. O horário já vem 20:00 e ela pode mudar. Pode ativar o aviso ou pular. No iPhone, se o app não estiver na Tela de Início, aparece um recado de como instalar. "Começar a missão" cria a missão.

No mock, para ver os estados do começo:

- Objetivo exatamente `falha` → o servidor de teste responde erro.
- Objetivo exatamente `lento` → o botão fica em "Criando a missão…" por 8 segundos e depois cria.
- E-mail `com-missao@exemplo.com` → depois de entrar, cai direto no Hoje.
- Sem internet no passo 1 ou 2: "Sem internet. Assim que a conexão voltar, tente de novo."
- Sem internet no passo 3: "Sem internet. A missão ainda não foi criada."

O horário do lembrete vai para `PUT /api/users/me/reminder`. Essa rota ainda não existe no servidor de verdade. O mock responde. Se a rota falhar, a missão continua e o horário fica gravado neste aparelho.
