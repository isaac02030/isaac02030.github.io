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

O horário do lembrete vai para `PUT /api/users/me/reminder`. Essa rota ainda não existe no servidor de verdade. O mock responde. Se a rota falhar, a missão continua e o horário fica gravado neste aparelho. A tela Ajustes usa a mesma chamada. Lá, se a rota falhar, o horário não é trocado e a tela pede para tentar de novo.

## Hoje

Segue a especificação da tela Hoje do guia visual v2.1 da Clara. De cima para baixo: o título «Hoje» (grande, recebe o foco ao abrir), «Dia X de 30» e a régua de marcas, o cartão da missão (título e «O mínimo de hoje:», com o mínimo grande sobre uma linha de pauta), o estado do dia, a linha do par no Duo e o botão principal colado acima das abas. A margem lateral é 24px. Não há placar. A tela não chama `GET /api/checkins/:id/score`. A linha «Porque:» fica só na aba Missão.

A régua tem 15 marcas por linha, de 16px, com vão de 6px. Feito: quadrado cheio. Dia difícil: quadrado cheio com um ponto no meio. Ainda por fazer: só o contorno. Dia que passou sem registro: contorno com um traço curto, como no Dia 30. Hoje: contorno duplo. A régua fica escondida do leitor de tela. O mesmo fato vai em texto escondido ao lado de «Dia X de 30», por exemplo «1 cumprido, 2 difíceis, 0 faltas».

Estados:

- Não feito: «Ainda não registrou o dia.» com um círculo vazio. Botão «Registrar o dia».
- Feito: «Registro feito. Palavra cumprida hoje.» com o check, na cor de sucesso. O botão vira o secundário «Ver a nota de hoje», que mostra e esconde a nota. Sem nota, não há botão.
- Dia difícil registrado: «Dia difícil registrado. O mínimo de hoje era pequeno, e valeu.» com uma meia-lua. Sem vermelho.
- Carregando: só o texto «Abrindo o dia…». Nada gira.
- Sem internet: faixa no topo, «Sem internet. Mostrando o que o aparelho guardou.» Ao tocar em «Registrar o dia»: «O registro não foi enviado. Tente de novo quando a conexão voltar.» (a faixa já diz que não há internet) Nada é enviado, guardado ou posto numa fila.
- Erro: «Não foi possível abrir o dia. Tente de novo.» e o botão «Tentar de novo».
- Vazio: «Ainda não há missões. Que tal começar a primeira?» e «Começar uma missão».
- Recuperação: a Tela 6, logo abaixo.

As abas têm 56px de altura. A fonte é a Figtree variável, servida pela pasta `fonts/` (licença SIL OFL 1.1 em `fonts/OFL.txt`). A cor do papel claro fica só no token `--papel` de `tokens.css`.

Checagem: `node nexus-v2/dev/checar-hoje.js`.

Embaixo ficam três abas, cada uma na sua página: `hoje.html`, `missao.html` e `ajustes.html`. Só uma fica aberta. A troca entra no histórico do navegador, então o voltar do celular desfaz o passo. Cada página guarda a própria rolagem nesta sessão e, na primeira vez, abre no topo.

No mock, abra o Hoje já com a sessão de teste e um estado na URL. Exemplo, com o token gravado neste aparelho:

http://localhost:8080/hoje.html?cenario=nao-registrado&tema=claro

Estados do `?cenario=`:

- `nao-registrado` — ainda falta registrar o dia
- `registrado` — o dia está feito; «Ver a nota de hoje» mostra a nota
- `dificil-hoje` — o dia de hoje foi registrado como difícil
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

`?rede=off` mostra o último dia guardado neste aparelho, como se não houvesse internet, com a faixa no topo. No Hoje, o parâmetro só vale em `localhost`, `127.0.0.1` ou `[::1]`. Sem um dia guardado, a tela avisa para tentar de novo quando a conexão voltar.

A linha «Dias difíceis: restam N de 4.» só aparece quando a sequência traz `difficult_days_remaining` maior que zero. A marca de dia difícil só aparece com `difficult_days` ou com `difficult: true` no check-in. Sem esses campos, a linha fica de fora e a régua não marca dia difícil. O mock manda `difficult_days`, `difficult_days_used` e `difficult_days_remaining` nos cenários. `sem-campo` e uma missão recém-criada não mandam.

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
- `?rede=off` — não envia e não guarda a nota para depois. «Sem internet. Sua nota continua aqui. Tente de novo quando a conexão voltar.» No Hoje, a faixa diz «Sem internet» e o alerta diz «O registro não foi enviado. Tente de novo quando a conexão voltar.»

«Hoje é dia difícil» abre `dia-dificil.html` com a nota que já estava no campo. Voltar ao check-in devolve a mesma nota.

`?ia=1` liga a ida para a resposta do Grande Irmão só em `localhost` ou `127.0.0.1`. Em outro host, o parâmetro não muda o caminho: o sucesso continua indo para o Hoje. A flag `NEXUS_ABRIR_TELA_IA_APOS_CHECKIN` fica false.

## Dia difícil

Tela por cima do check-in: tem Voltar e não mostra a barra de abas. O pedido é `POST /api/checkins` com `mission_id`, `note` e `difficult: true`. O sucesso só aparece se a resposta for 2xx e `checkin.difficult` for `true`.

A frase «Ainda restam N.» só entra quando a sequência manda `difficult_days_remaining`. O rótulo é «O mínimo de hoje continua valendo:» e o mínimo fica em negrito, na linha de baixo, como está gravado. No Hoje, se o check-in de hoje é difícil, o estado diz «Dia difícil registrado. O mínimo de hoje era pequeno, e valeu.» com uma meia-lua.

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

A tela de ajuda (`crise.html`) tem o título «Você não está sozinho nisso» e a frase «Esta tela não guarda nada sobre você.» O texto é fixo: não usa IA, não lê a nota e não chama a rede. O servidor ainda não manda sinal de crise no check-in. Sem JavaScript, Portugal vem primeiro. Se o idioma do aparelho começa com `pt-BR`, o Brasil sobe. Não há geolocalização. A tela abre pelo endereço direto, pelo link no topo de Ajustes ou pelo link no rodapé do dia difícil. «Voltar à missão» abre `missao.html`. Não entra na barra de abas.

## Ajustes

O link «Precisa de ajuda agora?» fica no topo. O título é só «Ajustes», como o «Hoje». Depois vêm o horário do lembrete, o recado de instalar no iPhone (só no iPhone ou iPad, se o app ainda não está na Tela de Início) e o bloco «Conta». Não há interruptor do Grande Irmão nem a tela do que ele sabe. Isso fica só num comentário TODO.

O campo do horário é o mesmo do passo 3 do começo, já em 20:00. Uma linha explica: o lembrete principal toca nesse horário, e os outros dois do dia só tocam se ainda não houve check-in. «Salvar» chama `PUT /api/users/me/reminder` com o horário e o fuso, a mesma função do começo. Essa rota ainda não existe no servidor de verdade. O mock só responde se a página estiver em `localhost`, `127.0.0.1` ou `[::1]`. Fora disso, a tela mostra o erro e não diz que salvou. O horário guardado neste aparelho não muda, e o número digitado continua no campo. «Horário salvo.» só aparece no desenvolvimento, quando o mock aceita. Isso só pode ir para o ar quando a rota existir no servidor.

Sem internet, ou com `?rede=off`, aparece «Não foi possível salvar agora. Tente de novo quando houver rede.» Esse aviso é um alerta para o leitor de tela.

No mock, só a partir de uma página local:

- `ajustes.html?cenario=lembrete-erro` — o salvar responde erro
- `ajustes.html?cenario=lembrete-lento` — o botão fica em «Salvando…» por 8 segundos
- `?rede=off` — não envia

«Conta» abre «Sair da conta?». A frase diz que a sessão e os rascunhos deste aparelho são apagados, e que a missão continua salva na conta. «Cancelar» é o botão preenchido e recebe o foco. «Sair» é o contorno. Os dois têm pelo menos 44px. Não usam a cor de alarme. «Sair» apaga o token e o usuário deste aparelho, e também os rascunhos desta aba (a nota do dia, o começo da missão e o dia guardado). A missão, os dias e a sequência ficam no servidor. O tema fica. Em seguida abre a tela de entrar.

A tela lê sem internet: os arquivos entram no cache `nexus-v2-v20`.

## Dia 30

Quando o dia passou de `duration_days`, ou quando o status da missão é `completed`, o Hoje abre `dia-30.html`. Antes disso, essa tela volta para o Hoje. É uma tela de fechamento: não tem a barra de abas. Ao abrir, o foco vai para o título. O número de dias sai dos check-ins `completed` desta pessoa, do mesmo jeito que o Hoje conta. Não há placar e não há Porta Aberta.

Entre o título e o fato fica a mesma grade do Hoje, só para leitura. O nome único para o leitor é «N de 30 dias registrados». O dia sem registro usa o traço da falta. A frase logo abaixo do fato usa a cor do texto, peso 600 e o tamanho do corpo. Se o número bate com a duração, a frase é «Palavra cumprida neste ciclo.» Se faltou dia, «Houve falhas, e você chegou ao fim mesmo assim.»

«Continuar mais 36 dias» chama `POST /api/missions/:id/extend` com `{ days: 36 }`. O botão fica desabilitado enquanto o pedido não volta, para um toque duplo não abrir duas vezes. Essa rota ainda não existe no servidor de verdade. O mock só responde em `localhost`, `127.0.0.1` ou `[::1]`. Fora disso, ou se a resposta falhar, a tela diz «Não foi possível abrir os próximos 36 dias. Tente de novo.» e não segue. Sem internet: «Sem internet. O ciclo já terminou; continuar fica para quando a conexão voltar.» Os dois avisos são um alerta. O texto fica na tela se a pessoa tocar de novo antes da resposta.

«Agora não» não chama o servidor. Não há rota de fim de ciclo no `api.js`. O botão só volta para o Hoje. A missão continua como estava. Quando essa rota existir, o rótulo volta a ser «Encerrar esta missão», com uma frase de confirmação, como em Sair da conta.

No mock, com a sessão já gravada:

- `dia-30.html?cenario=fim-30` — 30 de 30, «Palavra cumprida neste ciclo.»
- `dia-30.html?cenario=fim-27` — 27 de 30, «Houve falhas, e você chegou ao fim mesmo assim.»
- `dia-30.html?cenario=fim-status` — status `completed` ainda no dia 12
- `dia-30.html?cenario=extend-erro` — o continuar responde erro
- `dia-30.html?cenario=nao-registrado` — ainda não é o fim; volta para o Hoje
- `?rede=off` — não envia o continuar

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

A aba Missão mostra a missão atual. «Sua missão» fica pequeno, em cima. O título grande é o objetivo (`title`). Ao lado do título, o modo é uma cápsula, na mesma cor: «Solo», «Duo, esperando o par», «Duo com [nome]» ou «Rival com [nome]». Embaixo, quando o servidor manda o campo: «Dia N de D» (`started_at` e `duration_days`), o mínimo (`daily_minimum`) e «Porque:» (`why_it_matters`). Sem o campo, a linha some. Não há coluna chamada `porque`.

O placar só aparece no Rival ativo. A primeira linha é «Você». A outra é o nome do par. Os dias saem de `scores`, no formato «3 dias» ou «1 dia». `my_streak` não entra no placar.

«Convidar para Duo» e «Convidar para Rival» não criam missão e não entram na fila. A rota de convite por link ainda não existe. A flag `NEXUS_CONVITE_POR_LINK` em `missao.js` fica false. Ao tocar, a tela diz «O convite por link ainda não está disponível.» Sem internet, diz que o convite não pode ser criado. Não mostra erro técnico.

`?cenario=link-fake` só mostra um link em `localhost` ou `127.0.0.1`. O endereço fica em `dev/convite-exemplo.js`. A checagem é `node nexus-v2/dev/checar-convite-exemplo.js`. Em outro host, a página não carrega esse arquivo.

«Abandonar missão» fica no fim da página, longe dos botões de cima. O primeiro passo diz o que acontece e o botão é «Continuar». O segundo pergunta «Abandonar mesmo?» e o botão é «Sim, abandonar». «Cancelar» fica nos dois. O pedido `POST /api/missions/:id/abandon` só sai no segundo. No Solo, a missão termina e a pessoa não registra mais os dias dela. Com par, quem sai é removido e a outra pessoa continua em Solo. A tela não chama `continue-solo`. Se falhar ou estiver sem internet, a missão continua na tela.

No mock, com a sessão já gravada:

- `missao.html?cenario=solo`
- `missao.html?cenario=duo-esperando`
- `missao.html?cenario=duo-com-par` — o nome Ana é exemplo
- `missao.html?cenario=rival-placar` — Ana e os dias são exemplo
- `missao.html?cenario=convite-indisponivel`
- `missao.html?cenario=link-fake` só em localhost ou 127.0.0.1
- `missao.html?cenario=offline` ou `?rede=off` — o placar, se houver, é o último guardado neste aparelho

Ana não é uma pessoa real. O nome da conta no mock continua `pessoa`.


## Idade no cadastro, comunidade, denúncia e área da equipe

Acompanha o PR 18 do servidor. Os textos destas telas ficam só em `comunidade-textos.js`.

- **Cadastro:** antes de «Criar conta», a data de nascimento em três campos (dia, mês e ano). Vai como `birth_date` (AAAA-MM-DD). O site só confere se a data existe; quem decide a idade é o servidor, que não grava a data. Menor de 18 (403): a tela troca por «Ainda não dá para criar sua conta» e os campos são apagados. Sem a migração 006 (503): «Não foi possível criar a conta agora. Tente mais tarde.»
- **Comunidade** (`comunidade.html`, sem link nas abas por enquanto): sem `?c=` mostra a lista; com `?c=<slug>`, os posts. Só leitura. Conta sem a confirmação de idade (403 `adult_confirmation_required`) vê só o aviso e «Agora não». Não há caixa de «Tenho 18 anos»: o banco novo começa do zero e toda conta nasce com a data.
- **Denúncia:** «Denunciar» em cada post que não é seu abre uma folha com os 5 motivos e um comentário opcional (até 280). Com sinal de crise no comentário, o servidor responde `crisis: true` e a tela de ajuda abre; se a denúncia valeu, a ajuda mostra uma linha a mais (`crise.html?de=denuncia`).
- **Post escondido:** só o autor vê, com o motivo mais citado. Nunca o número de denúncias.
- **Área da equipe** (`equipe.html`): só admin. Os outros veem «Esta área é só da equipe.» Nunca mostra quem denunciou nem o autor.

No mock (`node nexus-v2/dev/mock-api.js`), entre com:

- `sem-idade@exemplo.com` — conta sem a confirmação de idade
- `autor@exemplo.com` — o seu post vem escondido
- `admin@exemplo.com` — abre a área da equipe
- qualquer outro e-mail — comunidade normal
- no cadastro: data de menos de 18 anos (403) ou e-mail `sem-migracao@exemplo.com` (503)

Cenários na URL: `comunidade.html?c=ingles-diario&cenario=` com `comunidade-indisponivel`, `comunidade-erro`, `comunidade-vazia`, `comunidade-fechada`, `denuncia-crise`, `denuncia-crise-nao-enviada`, `denuncia-indisponivel`, `denuncia-erro` ou `denuncia-lenta`; `equipe.html?cenario=` com `equipe-vazia`, `equipe-indisponivel` ou `equipe-erro-acao`. `?rede=off` só vale em localhost.

A checagem é `node nexus-v2/dev/checar-comunidade.js`.

## Termos, privacidade e sessão

- Cadastro: caixa «Li e aceito os Termos de uso e a Política de privacidade.», sempre desmarcada, com os links «Ler os Termos de uso» e «Ler a Política de privacidade». O envio manda `terms_version` e `privacy_version` (as duas «beta-1», em `legal-textos.js`, iguais às do servidor). Ao abrir um dos textos e voltar, o que já foi escrito continua (a senha, não).
- Reaceitação: quando o login ou o `/me` trazem `user.legal.needs_acceptance: true`, a tela «Atualizamos os termos e a privacidade» abre em `index.html#aceitar-termos` (POST `/api/users/me/legal-acceptance`). As outras telas conferem isso uma vez por aba (`api.js`).
- `termos.html` e `privacidade.html` abrem sem login e sem internet. São geradas a partir dos textos do conselho, sem as notas internas; não edite à mão. Os marcadores `[E-MAIL DE PRIVACIDADE]` e `[NOME DO RESPONSÁVEL]` ficam visíveis até o dono do projeto decidir.
- Em todas as chamadas com login (`api.js`): 401 `session_ended` limpa a sessão deste aparelho (o tema fica) e volta a «Entrar» com «Sessão encerrada. Entre de novo.»; 503 `auth_unavailable` mostra «Não foi possível conferir sua sessão agora. Tente de novo em instantes.» no topo, sem apagar nada.
- Mock: `reaceitar@exemplo.com`, `aceite-antigo@exemplo.com`, `aceite-falha@exemplo.com`, `termos-mudaram@exemplo.com`, `sessao-encerrada@exemplo.com` e `sessao-indisponivel@exemplo.com` (detalhes no topo de `dev/mock-api.js`).

A checagem é `node nexus-v2/dev/checar-aceite-legal.js`.

## Seus dados: nota, Meus dados, lembretes e excluir conta

- Check-in: no primeiro registro, a pergunta «Guardar suas notas?» com duas respostas iguais (POST ou DELETE `/api/users/me/note-consent`). «Não guardar» não espera o servidor. Depois, uma linha sob a nota diz se ela será guardada. Sem `note_saved`, a nota sai da cópia do dia e o Hoje não mostra «Ver a nota de hoje».
- Ajustes › Meus dados (`meus-dados.html`): aceites com versão e data, interruptores «Guardar minhas notas» (desligar apaga as notas já guardadas) e «Lembretes do registro diário». O de novidades fica escondido até existir envio. Contato com o marcador `[E-MAIL DE PRIVACIDADE]`. Excluir conta com senha; depois, tudo o que é `nexus_v2_*` sai do aparelho e abre `conta-excluida.html`.
- Começo da missão: a caixa «Quero receber lembretes do meu registro diário neste aparelho.» liga os lembretes (PUT `reminders: true`). Permitir o aviso no navegador, sozinho, não liga nada.
- Textos em `dados-textos.js`. Mock: `primeira-vez@exemplo.com`, `escolha-falha@exemplo.com`, `nao-guarda@exemplo.com`, `avisos-falha@exemplo.com`, `excluir-falha@exemplo.com`, senhas `errada` e `muitas` (detalhes no topo de `dev/mock-api.js`).

A checagem é `node nexus-v2/dev/checar-meus-dados.js`.
