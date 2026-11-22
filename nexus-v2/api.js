/* A URL da API fica só nesta linha.
   O servidor antigo está desligado. Não aponte para ele.
   Para testar neste computador, deixe http://localhost:3000
   e rode: node nexus-v2/dev/mock-api.js
   Quando houver um servidor novo, troque só o endereço abaixo. */
var NEXUS_API_URL = "http://localhost:3000";

function nexusUrl(caminho) {
  var base = String(NEXUS_API_URL || "").replace(/\/+$/, "");
  return base + caminho;
}

/* A tela Hoje lê ?cenario= na própria página e grava aqui.
   O servidor de verdade ignora esse parâmetro. O mock usa para trocar o estado. */
function caminhoComCenario(caminho) {
  var nome = "";
  if (typeof window !== "undefined" && typeof window.NEXUS_CENARIO === "string") {
    nome = window.NEXUS_CENARIO;
  }
  if (!/^[a-z0-9-]{1,40}$/.test(nome)) return caminho;
  return caminho + "?cenario=" + encodeURIComponent(nome);
}

async function nexusLerJson(resposta) {
  try {
    return await resposta.json();
  } catch (erro) {
    return {};
  }
}

/* Envia JSON e devolve um resultado simples.
   A senha só viaja no login e no cadastro. Este arquivo não a guarda.
   opcoes.metodo: GET, POST, PUT ou DELETE. Sem opcoes, o pedido é POST.
   opcoes.auth: manda o token da sessão, se existir neste aparelho. */
async function nexusPedir(caminho, corpo, opcoes) {
  var extras = opcoes || {};
  var metodo = extras.metodo || "POST";
  if (!NEXUS_API_URL || navigator.onLine === false) {
    return { ok: false, semRede: true, status: 0, erro: "" };
  }

  var cabecalhos = { "Accept": "application/json" };
  if (corpo != null && metodo !== "GET" && metodo !== "HEAD") {
    cabecalhos["Content-Type"] = "application/json";
  }
  if (extras.auth) {
    var token = "";
    try {
      token = localStorage.getItem("nexus_v2_token") || "";
    } catch (erroToken) {
      token = "";
    }
    if (token) cabecalhos.Authorization = "Bearer " + token;
  }

  var pedido = {
    method: metodo,
    headers: cabecalhos,
    cache: "no-store"
  };
  if (corpo != null && metodo !== "GET" && metodo !== "HEAD") {
    pedido.body = JSON.stringify(corpo);
  }

  var resposta;
  try {
    resposta = await fetch(nexusUrl(caminho), pedido);
  } catch (erro) {
    return { ok: false, semRede: true, status: 0, erro: "" };
  }

  var dados = await nexusLerJson(resposta);
  var erro = dados && typeof dados.error === "string" ? dados.error : "";
  if (!resposta.ok) {
    return { ok: false, semRede: false, status: resposta.status, erro: erro, dados: dados };
  }
  return { ok: true, semRede: false, status: resposta.status, erro: "", dados: dados };
}

/* Rota planejada. O servidor de verdade ainda não tem PUT /api/users/me/reminder.
   O começo da missão e Ajustes usam esta mesma chamada.
   O mock só aceita a chamada se a página estiver em localhost, 127.0.0.1 ou [::1].
   Se a resposta for 404 ou outra falha, o começo segue e guarda o horário no aparelho.
   Ajustes, fora do desenvolvimento, não chama esta função: mostra o erro e não grava. */
function saveReminderTime(dados) {
  var hora = dados && typeof dados.reminder_time === "string" ? dados.reminder_time : "";
  var fuso = dados && typeof dados.timezone === "string" ? dados.timezone : "";
  if (!fuso) {
    try {
      fuso = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch (erroFuso) {
      fuso = "UTC";
    }
  }
  return nexusPedir(caminhoComCenario("/api/users/me/reminder"), {
    reminder_time: hora,
    timezone: fuso
  }, { metodo: "PUT", auth: true });
}

var NexusApi = {
  /* GET /api/users/me devolve { user: { id, username, adult_confirmed, ... } }.
     A comunidade usa o id só para não mostrar «Denunciar» no próprio post. */
  eu: function () {
    return nexusPedir("/api/users/me", null, { metodo: "GET", auth: true });
  },
  /* Comunidade (PR 18 do servidor). Tudo exige login e 18+ confirmado.
     Sem a confirmação: 403 com code "adult_confirmation_required". */
  listarComunidades: function () {
    return nexusPedir(caminhoComCenario("/api/communities"), null, { metodo: "GET", auth: true });
  },
  /* GET /api/communities/:slug devolve { community, ranking, posts, access }.
     Post escondido só vem para o autor, com hidden: true e hidden_reason. */
  abrirComunidade: function (slug) {
    return nexusPedir(caminhoComCenario("/api/communities/" + encodeURIComponent(slug)), null, { metodo: "GET", auth: true });
  },
  /* POST /api/communities/:slug/posts/:postId/report com { reason, details? }.
     201 { reported: true }; 201 ou 200 com crisis: true (a tela abre a ajuda);
     409 já denunciado; 503 sem a migração 005. details só vai se tiver texto. */
  denunciarPost: function (slug, postId, motivo, detalhes) {
    var corpo = { reason: motivo };
    if (typeof detalhes === "string" && detalhes.trim()) corpo.details = detalhes.trim();
    return nexusPedir(caminhoComCenario("/api/communities/" + encodeURIComponent(slug) + "/posts/" + encodeURIComponent(postId) + "/report"), corpo, { metodo: "POST", auth: true });
  },
  /* Só admin (o servidor decide). Os outros recebem 403. */
  postsEscondidos: function () {
    return nexusPedir(caminhoComCenario("/api/communities/admin/hidden-posts"), null, { metodo: "GET", auth: true });
  },
  restaurarPost: function (postId) {
    return nexusPedir(caminhoComCenario("/api/communities/admin/posts/" + encodeURIComponent(postId) + "/restore"), null, { metodo: "POST", auth: true });
  },
  apagarPost: function (postId) {
    return nexusPedir(caminhoComCenario("/api/communities/admin/posts/" + encodeURIComponent(postId)), null, { metodo: "DELETE", auth: true });
  },
  entrar: function (email, senha) {
    return nexusPedir("/api/users/login", {
      email: email,
      password: senha
    });
  },
  cadastrar: function (dados) {
    return nexusPedir("/api/users/register", {
      username: dados.username,
      email: dados.email,
      password: dados.password,
      /* AAAA-MM-DD. O servidor confere os 18 anos e não grava a data (PR 18). */
      birth_date: dados.birth_date
    });
  },
  /* GET /api/missions devolve uma lista. Sem missão ativa, o começo abre o onboarding. */
  listarMissoes: function () {
    return nexusPedir(caminhoComCenario("/api/missions"), null, { metodo: "GET", auth: true });
  },
  /* GET /api/missions/:id devolve a missão.
     user_name é quem criou. partner_name é o par, ou null.
     O placar não vem neste pedido. */
  obterMissao: function (id) {
    return nexusPedir(caminhoComCenario("/api/missions/" + encodeURIComponent(id)), null, { metodo: "GET", auth: true });
  },
  /* GET /api/checkins/:missionId/score
     Forma no servidor: { mission_id, mode, scores, leader, my_streak }.
     scores é um mapa. A chave é o username de quem criou e o do par.
     O valor é a contagem de check-ins feitos, não my_streak.
     Se partner_name é null, a chave vira a string "null".
     leader é um username ou "Empate!".
     A tela Missão só usa isso no Rival ativo, e só os dois nomes e os dias. */
  placarDaMissao: function (id) {
    return nexusPedir(caminhoComCenario("/api/checkins/" + encodeURIComponent(id) + "/score"), null, { metodo: "GET", auth: true });
  },
  /* POST /api/missions/:id/abandon
     Solo, ou sem par: a missão fica abandoned e o registro para.
     Com par e modo parceiro ou rival: quem sai é removido e a outra
     pessoa continua na mesma missão, em solo. Não chama continue-solo.
     O corpo vai vazio. O servidor não lê o corpo. */
  abandonarMissao: function (id) {
    return nexusPedir(caminhoComCenario("/api/missions/" + encodeURIComponent(id) + "/abandon"), null, { metodo: "POST", auth: true });
  },
  /* GET /api/checkins/:missionId devolve { progress }, com o seu avanço e o do par. */
  progressoDaMissao: function (id) {
    return nexusPedir(caminhoComCenario("/api/checkins/" + encodeURIComponent(id)), null, { metodo: "GET", auth: true });
  },
  /* GET /api/checkins/:missionId/streak devolve today_done, recovery_needed,
     missed_yesterday, missed_days e recovered.
     recovered é do brio: houve um dia feito depois de uma falta anterior.
     Não quer dizer que o retorno de hoje já aconteceu.
     missed_days conta o vão desde hoje e inclui o dia de hoje aberto.
     missed_days_before_today, quando vier, já tira o hoje. Sem ele, a
     frase usa missed_days - 1. Zero e negativo não entram na frase.
     A branch de dia difícil também manda difficult_days,
     difficult_days_used e difficult_days_remaining.
     O placar não entra nesta chamada. */
  sequenciaDaMissao: function (id) {
    return nexusPedir(caminhoComCenario("/api/checkins/" + encodeURIComponent(id) + "/streak"), null, { metodo: "GET", auth: true });
  },
  /* POST /api/checkins. O corpo é só mission_id e note.
     A resposta traz day, already_done, checkin e message.
     O check-in não manda difficult. */
  registrarDia: function (id, nota) {
    return nexusPedir(caminhoComCenario("/api/checkins"), {
      mission_id: id,
      note: nota
    }, { metodo: "POST", auth: true });
  },
  /* O mesmo POST, com difficult: true. O nome do campo é difficult.
     A tela só trata como salvo um 2xx em que checkin.difficult é true. */
  registrarDiaDificil: function (id, nota) {
    return nexusPedir(caminhoComCenario("/api/checkins"), {
      mission_id: id,
      note: nota,
      difficult: true,
      /* O toque em «Fiz o mínimo». Sem isto, o servidor responde 400. */
      minimum_done: true
    }, { metodo: "POST", auth: true });
  },
  /* duration_days vai no pedido porque estes 30 dias são o combinado da tela.
     A rota atual não lê esse campo: a coluna já nasce 30 e o fim é agora + 30 dias.
     Enviar 30 não muda o resultado. Não mandamos level, description, fallback_plan
     nem commitment_window: o servidor não exige esses campos.
     mission_weekdays (1 = segunda ... 7 = domingo) só vai quando a pessoa
     escolheu de 3 a 6 dias. Com os 7, o campo fica de fora: o servidor já
     entende como todos os dias, e a missão não depende da migração 004. */
  criarMissao: function (dados) {
    var corpo = {
      title: dados.title,
      category: dados.category,
      daily_minimum: dados.daily_minimum,
      why_it_matters: dados.why_it_matters,
      mode: "solo",
      duration_days: 30,
      proof_mode: dados.proof_mode
    };
    if (Array.isArray(dados.mission_weekdays)) corpo.mission_weekdays = dados.mission_weekdays.slice();
    return nexusPedir("/api/missions", corpo, { metodo: "POST", auth: true });
  },
  chaveVapid: function () {
    return nexusPedir("/api/notifications/vapid-key", null, { metodo: "GET" });
  },
  inscreverNotificacao: function (subscription) {
    return nexusPedir("/api/notifications/subscribe", {
      subscription: subscription
    }, { metodo: "POST", auth: true });
  },
  saveReminderTime: saveReminderTime,
  /* Rota planejada. O servidor de verdade ainda não tem POST /api/missions/:id/extend.
     O corpo é { days: 36 }. Não reutiliza continue-solo.
     O mock só aceita se a página estiver em localhost, 127.0.0.1 ou [::1].
     Se a resposta não for sucesso, a tela do fim mostra o erro e não segue. */
  estenderMissao: function (id) {
    return nexusPedir(caminhoComCenario("/api/missions/" + encodeURIComponent(id) + "/extend"), {
      days: 36
    }, { metodo: "POST", auth: true });
  }
};
