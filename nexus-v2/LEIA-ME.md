# Nexus v2

App novo, em HTML, CSS e JavaScript puro, sem etapa de build. Esta pasta tem a base, a tela de entrar, o começo da missão e o Hoje. A pasta `nexus/` é o app antigo e não entra nesta versão.

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

## Hoje

Mostra o dia da missão: o título, o mínimo, se o registro de hoje já foi feito e, no Duo, só a frase de que o par já registrou. Não há placar. A tela não chama `GET /api/checkins/:id/score`.

Embaixo ficam três abas: Hoje, Missão e Ajustes. Missão, Ajustes, o check-in e a recuperação ainda são páginas simples, com a mesma barra.

No mock, abra o Hoje já com a sessão de teste e um estado na URL. Exemplo, com o token gravado neste aparelho:

http://localhost:8080/hoje.html?cenario=nao-registrado&tema=claro

Estados do `?cenario=`:

- `nao-registrado` — ainda falta registrar o dia
- `registrado` — o dia está feito e aparece a nota
- `duo` — o par (Par Teste) já registrou hoje
- `duo-sem` — é Duo, mas o par ainda não registrou (a tela não fala do par)
- `esperando` — o par ainda não entrou; o Solo continua na tela
- `vazio` — sem missão
- `erro` — «Não foi possível abrir o dia. Tente de novo.»
- `recuperacao` — `recovery_needed` manda para a página da recuperação
- `sem-campo` — igual ao dia sem registro, mas a resposta não traz dia difícil

O mesmo vale entrando com o e-mail do estado, por exemplo `duo@exemplo.com`. A senha pode ser qualquer uma, menos `errada`.

`?rede=off` mostra o último dia guardado neste aparelho, como se não houvesse internet. Sem um dia guardado, a tela avisa para tentar de novo quando a conexão voltar.

O servidor de verdade ainda não manda os dias difíceis. A linha «Dias difíceis: restam N de 4.» só aparece quando a resposta traz `difficult_days_remaining`. As marcas diferentes só aparecem quando vem `difficult_days`. O mock inclui esses dois campos nos cenários. Uma missão recém-criada não os tem, e a tela não inventa o número.
