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
   opcoes.metodo: GET, POST ou PUT. Sem opcoes, o pedido é POST.
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

/* Rota planejada. O servidor atual não tem PUT /api/users/me/reminder.
   Se a resposta for 404 ou outra falha, quem chamou segue e guarda o horário no aparelho. */
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
  return nexusPedir("/api/users/me/reminder", {
    reminder_time: hora,
    timezone: fuso
  }, { metodo: "PUT", auth: true });
}

var NexusApi = {
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
      password: dados.password
    });
  },
  /* GET /api/missions devolve uma lista. Sem missão ativa, o começo abre o onboarding. */
  listarMissoes: function () {
    return nexusPedir(caminhoComCenario("/api/missions"), null, { metodo: "GET", auth: true });
  },
  /* GET /api/missions/:id devolve a missão, com partner_name.
     Não pedimos o placar. A rota /api/checkins/:id/score não é usada. */
  obterMissao: function (id) {
    return nexusPedir(caminhoComCenario("/api/missions/" + encodeURIComponent(id)), null, { metodo: "GET", auth: true });
  },
  /* GET /api/checkins/:missionId devolve { progress }, com o seu avanço e o do par. */
  progressoDaMissao: function (id) {
    return nexusPedir(caminhoComCenario("/api/checkins/" + encodeURIComponent(id)), null, { metodo: "GET", auth: true });
  },
  /* GET /api/checkins/:missionId/streak devolve today_done, recovery_needed,
     missed_yesterday, missed_days e recovered.
     recovered é do brio: houve um dia feito depois de uma falta anterior.
     Não quer dizer que o retorno de hoje já aconteceu.
     missed_days conta o vão desde hoje, e inclui o dia de hoje quando
     ele ainda não foi feito. A frase da tela tira esse dia.
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
      difficult: true
    }, { metodo: "POST", auth: true });
  },
  /* duration_days vai no pedido porque estes 30 dias são o combinado da tela.
     A rota atual não lê esse campo: a coluna já nasce 30 e o fim é agora + 30 dias.
     Enviar 30 não muda o resultado. Não mandamos level, description, fallback_plan
     nem commitment_window: o servidor não exige esses campos. */
  criarMissao: function (dados) {
    return nexusPedir("/api/missions", {
      title: dados.title,
      category: dados.category,
      daily_minimum: dados.daily_minimum,
      why_it_matters: dados.why_it_matters,
      mode: "solo",
      duration_days: 30,
      proof_mode: dados.proof_mode
    }, { metodo: "POST", auth: true });
  },
  chaveVapid: function () {
    return nexusPedir("/api/notifications/vapid-key", null, { metodo: "GET" });
  },
  inscreverNotificacao: function (subscription) {
    return nexusPedir("/api/notifications/subscribe", {
      subscription: subscription
    }, { metodo: "POST", auth: true });
  },
  saveReminderTime: saveReminderTime
};
