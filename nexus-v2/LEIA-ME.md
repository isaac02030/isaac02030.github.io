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

Embaixo ficam três abas, cada uma na sua página: `hoje.html`, `missao.html` e `ajustes.html`. Só uma fica aberta. A troca entra no histórico do navegador, então o voltar do celular desfaz o passo. Cada página guarda a própria rolagem nesta sessão e, na primeira vez, abre no topo.

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
- `falta-1` e `recuperacao` — ontem sem registro, na própria tela Hoje
- `falta-3` — três dias sem registro
- `recuperacao-zero` — os dias difíceis acabaram; o link some
- `recuperacao-sem-numero` — sem `missed_days` e sem dia difícil
- `recuperacao-sem-fato` — sem `missed_days` e sem `missed_yesterday`
- `recuperacao-seguidos` — o link de dia difícil some (2 seguidos)
- `recuperacao-sem-minimo` — sem o mínimo gravado
- `recuperacao-minusculo` — o mínimo em minúscula, em negrito na linha de baixo
- `falta-antiga` — Hoje normal, com um dia antigo sem registro
- `recuperacao-sem-antes` — sem `missed_days_before_today`
- `sem-campo` — igual ao dia sem registro, mas a resposta não traz dia difícil

Se `recovery_needed` é true, o Hoje troca o miolo e mantém a barra de abas. Em cima da grade entra «Dia N de 30», como no Hoje. A marca de falta tem um traço curto. O título é «Hoje ainda dá para voltar». A contagem usa `missed_days_before_today`. Sem esse campo, usa `missed_days - 1`. Um dia vira «Ontem não houve registro.» Dois ou mais viram «Ficaram N dias sem registro.» Zero e negativo não aparecem. «O mínimo de hoje:» fica com o mínimo em negrito na linha de baixo. «Registrar o dia» abre o check-in normal. «Hoje é dia difícil» só aparece com `difficult_days_remaining` maior que zero e sem o bloqueio de 2 seguidos. «Ver a missão» abre `missao.html`.

Depois de um registro feito a partir dessa tela, normal ou difícil, o Hoje diz «Você voltou. O ciclo continua.» O ciclo em dia não mostra essa tela. Erro e falta de internet seguem o Hoje. Com `?ia=1`, esse registro abre a resposta do Grande Irmão em vez do Hoje. Sem o parâmetro, a volta continua sendo o Hoje.

O mesmo vale entrando com o e-mail do estado, por exemplo `duo@exemplo.com`. A senha pode ser qualquer uma, menos `errada`.

`?rede=off` mostra o último dia guardado neste aparelho, como se não houvesse internet. Sem um dia guardado, a tela avisa para tentar de novo quando a conexão voltar.

A linha «Dias difíceis: restam N de 4.» só aparece quando a sequência traz `difficult_days_remaining` maior que zero. O losango só aparece com `difficult_days` ou com `difficult: true` no check-in. Sem esses campos, a linha e o losango ficam de fora. O mock manda `difficult_days`, `difficult_days_used` e `difficult_days_remaining` nos cenários. `sem-campo` e uma missão recém-criada não mandam.

A grade dos dias tem um único nome para o leitor de tela, no formato «Dia 4 de 30: 1 cumprido, 2 difíceis, 0 faltas». Os números saem das marcas. Cada dia entra numa conta só. As marcas em si ficam escondidas do leitor e não recebem foco.

## Registro de hoje

O botão «Registrar o dia» abre `checkin.html`. É uma tela por cima do Hoje: tem Voltar e não mostra a barra de abas. O voltar do celular desfaz o passo.

O pedido é `POST /api/checkins`, com `mission_id` e `note`. Não mandamos `difficult`. A nota fica num rascunho desta aba (`sessionStorage`), o mesmo da tela de dia difícil, e some depois de um registro feito. Não vai para `localStorage` e não fica numa fila para enviar depois.

No mock, com a sessão já gravada:

- `checkin.html?cenario=estudo` — estudo, nota vazia
- `checkin.html?cenario=academia` — academia
- `checkin.html?cenario=lento` — o botão fica em «Registrando…» por 8 segundos
- `checkin.html?cenario=erro-registro` — «Não foi possível registrar agora. Tente de novo.»
- `checkin.html?cenario=nota-servidor` — o servidor de teste recusa a nota; a tela mostra a regra em português do Brasil
- `checkin.html?cenario=repetido` — o servidor diz que o dia já estava feito
- `checkin.html?cenario=terminada` — «A missão já terminou.»
- `checkin.html?cenario=inativa` — «Esta missão não está ativa.»
- `checkin.html?cenario=registrado` — volta para o Hoje com «Este dia já estava registrado.»
- `checkin.html?cenario=sem-porque` — esconde a linha «Você escreveu»
- `?rede=off` — não envia e não guarda a nota para depois. «Sem internet. Sua nota continua aqui. Tente de novo quando a conexão voltar.» No Hoje, se não há nota na tela: «Sem internet. Tente de novo quando a conexão voltar.»

«Hoje é dia difícil» abre `dia-dificil.html` com a nota que já estava no campo. Voltar ao check-in devolve a mesma nota.

`?ia=1` liga a ida para a resposta do Grande Irmão só em `localhost` ou `127.0.0.1`. Em outro host, o parâmetro não muda o caminho: o sucesso continua indo para o Hoje. A flag `NEXUS_ABRIR_TELA_IA_APOS_CHECKIN` fica false.

## Dia difícil

Tela por cima do check-in: tem Voltar e não mostra a barra de abas. O pedido é `POST /api/checkins` com `mission_id`, `note` e `difficult: true`. O sucesso só aparece se a resposta for 2xx e `checkin.difficult` for `true`.

A frase «Ainda restam N.» só entra quando a sequência manda `difficult_days_remaining`. O rótulo é «O mínimo de hoje continua valendo:» e o mínimo fica em negrito, na linha de baixo, como está gravado. No Hoje, se o check-in de hoje é difícil, o estado diz «Dia difícil registrado. O mínimo valeu.» com o mesmo losango da grade.

Se `difficult_days_remaining` é 0, ou se `difficult_days` inclui os dois dias anteriores, a tela explica e oferece «Registrar o dia normal». O mesmo vale para os 400 «Você já usou os 4 dias difíceis desta missão.» e «Não dá para ter mais de 2 dias difíceis seguidos.».

No mock:

- `dia-dificil.html?cenario=estudo` — formulário, com «Ainda restam 2.»
- `dia-dificil.html?cenario=dois-seguidos` — bloqueio de 2 seguidos
- `dia-dificil.html?cenario=quatro-usados` — os 4 já foram usados
- `dia-dificil.html?cenario=sem-restante` — sem a frase «Ainda restam»
- `dia-dificil.html?cenario=ignora-difficult` — o servidor não confirma o dia difícil
- `dia-dificil.html?cenario=so-is-difficult` — a resposta traz `is_difficult` e não `difficult`
- `dia-dificil.html?cenario=post-seguidos` e `post-quatro` — o bloqueio chega no POST
- `?rede=off` — a nota continua no campo

A tela de ajuda (`crise.html`) continua um marcador: o servidor ainda não manda sinal de crise no check-in, e esta tela não tenta adivinhar pela nota.

## Resposta do Grande Irmão

Cartão simples, sem avatar e sem balão. O título é «O Grande Irmão». A frase é um parágrafo curto. O botão «Voltar a Hoje» fica visível sem rolar. O voltar do celular faz a mesma coisa. A tela não fecha sozinha e não abre sozinha: só depois de um check-in ou de um dia difícil, com a flag ligada.

A flag `NEXUS_ABRIR_TELA_IA_APOS_CHECKIN` fica false em `abas.js`. Desenvolvimento é só o host `localhost` ou `127.0.0.1`. Nesse host, `?ia=1` no check-in ou no dia difícil abre esta tela. Em qualquer outro host, `?ia=1` não faz nada: o registro volta para o Hoje e a frase continua fixa.

Não há pedido a uma rota de IA. A frase sai dos mesmos dados do Hoje: o check-in de hoje com `difficult`, e a volta quando `missed_days_before_today` é maior que zero ou quando o check-in veio da recuperação. A volta ganha do dia cumprido e também do dia difícil. Se os dois acontecem juntos, a frase é «Você voltou. O ciclo continua.»

Sem internet ou com erro, a frase fixa continua. Não aparece erro técnico.

No mock, com a sessão já gravada:

- `grande-irmao.html?cenario=cumpriu` — «Registro feito. O mínimo de hoje estava escrito, e você cumpriu.»
- `grande-irmao.html?cenario=dificil` — «Dia difícil registrado. O mínimo de hoje era pequeno, e valeu.»
- `grande-irmao.html?cenario=volta` — «Você voltou. O ciclo continua.»
- `grande-irmao.html?cenario=offline` — a frase do dia cumprido, sem erro técnico
- `grande-irmao.html?cenario=ia-exemplo` — só em `localhost` ou `127.0.0.1`. O texto de exemplo fica em `dev/ia-exemplo.js`, que a página não carrega em outro host. A linha «Isso é uma IA. Ela acompanha a missão, não substitui gente de verdade.» usa o tamanho do texto e a cor do texto. O link «Quero continuar esta conversa» alinha à esquerda, com o mesmo recuo do cartão, e tem pelo menos 44px de altura. Fora do desenvolvimento, esse cenário não abre o estado de IA.
- `?tema=escuro` — o mesmo cartão no escuro

Nas frases fixas, a linha da IA e o link não aparecem. Crise, quando houver sinal, vai para a tela 9 e a IA para. Esta tela não detecta crise.

## Missão

A aba Missão mostra o modo atual, com a mesma paleta em Solo, Duo e Rival. O título da página é «Sua missão». O modo é um rótulo: «Solo», «Duo, esperando o par», «Duo com [nome]» ou «Rival com [nome]».

O placar só aparece no Rival ativo. A tela pede `GET /api/checkins/:id/score`. No Duo não há placar. Os dias vêm de `scores`, contados pelos check-ins. `my_streak` não entra no placar.

«Convidar para Duo» e «Convidar para Rival» não criam missão e não entram na fila. A rota de convite por link ainda não existe. A flag `NEXUS_CONVITE_POR_LINK` em `missao.js` fica false. Ao tocar, a tela diz «O convite por link ainda não está disponível.» Sem internet, diz que o convite não pode ser criado. Não mostra erro técnico.

`?cenario=link-fake` só mostra um link em `localhost` ou `127.0.0.1`. O endereço fica em `dev/convite-exemplo.js`. A checagem é `node nexus-v2/dev/checar-convite-exemplo.js`. Em outro host, a página não carrega esse arquivo.

«Abandonar missão» fica no fim da página, longe de «Copiar link». São dois passos. O pedido `POST /api/missions/:id/abandon` só sai no segundo. No Solo, a missão termina e o registro para. Com par, você sai e a outra pessoa continua em Solo na mesma missão. A tela não chama `continue-solo`. Se falhar ou estiver sem internet, a missão continua na tela.

No mock, com a sessão já gravada:

- `missao.html?cenario=solo`
- `missao.html?cenario=duo-esperando`
- `missao.html?cenario=duo-com-par` — o nome Ana é exemplo
- `missao.html?cenario=rival-placar` — Ana e os dias são exemplo
- `missao.html?cenario=convite-indisponivel`
- `missao.html?cenario=link-fake` só em localhost ou 127.0.0.1
- `missao.html?cenario=offline` ou `?rede=off` — o placar, se houver, é o último guardado neste aparelho

Ana não é uma pessoa real. O nome da conta no mock continua `pessoa`.

