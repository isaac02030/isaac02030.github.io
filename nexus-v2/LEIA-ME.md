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

O link "Esqueci a senha" fica escondido porque essa rota ainda não existe. Depois de entrar ou criar conta, a tela confirma e guarda a sessão neste aparelho. As telas seguintes (o começo da missão e o Hoje) ainda não foram feitas.
