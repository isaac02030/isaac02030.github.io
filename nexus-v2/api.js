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

/* Sessão (PR 26 do servidor): o login é conferido a cada pedido.
   401 com code "session_ended": a conta saiu ou a sessão acabou. Limpa a
   sessão deste aparelho (token, usuário e as cópias da missão; o tema fica),
   guarda o aviso para a tela de entrar e volta ao login.
   503 com code "auth_unavailable": o servidor não conseguiu conferir agora.
   Nada é apagado; o aviso aparece no topo da tela.
   Textos aprovados (iguais aos de legal-textos.js; a checagem confere). */
var NEXUS_TEXTO_SESSAO_ENCERRADA = "Sessão encerrada. Entre de novo.";
var NEXUS_TEXTO_SESSAO_INDISPONIVEL = "Não foi possível conferir sua sessão agora. Tente de novo em instantes.";
var NEXUS_CHAVE_AVISO_LOGIN = "nexus_v2_aviso_login";
var NEXUS_CHAVE_ACEITE_OK = "nexus_v2_aceite_conferido";

function nexusLimparSessao() {
  try {
    var i = localStorage.length;
    while (i > 0) {
      i -= 1;
      var chave = localStorage.key(i);
      if (chave && chave.indexOf("nexus_v2_") === 0 && chave !== "nexus_v2_tema") localStorage.removeItem(chave);
    }
  } catch (erroLocal) {}
  try {
    var j = sessionStorage.length;
    while (j > 0) {
      j -= 1;
      var chaveSessao = sessionStorage.key(j);
      if (chaveSessao && chaveSessao.indexOf("nexus_v2_") === 0) sessionStorage.removeItem(chaveSessao);
    }
  } catch (erroSessao) {}
}

/* Mantém só o ?tema= ao trocar de tela (como a saída de Ajustes). */
function nexusBuscaTema() {
  try {
    var tema = new URLSearchParams(location.search).get("tema");
    if (tema === "claro" || tema === "escuro" || tema === "sistema") return "?tema=" + tema;
  } catch (erro) {}
  return "";
}

function nexusSessaoEncerrada() {
  nexusLimparSessao();
  try {
    sessionStorage.setItem(NEXUS_CHAVE_AVISO_LOGIN, "sessao_encerrada");
  } catch (erro) {}
  location.replace("./index.html" + nexusBuscaTema());
}

/* 503 auth_unavailable (revisão da Clara): um aviso só.
   Se a própria tela mostra o erro dela (um .alerta-falha visível), esse erro
   fica, passa a neutro (não é culpa de quem usa) e o aviso do topo não
   aparece. Só quando a tela não mostra erro (o conteúdo carregou, por
   exemplo de uma cópia guardada) o aviso aparece no topo, com role="alert". */
var NEXUS_ESPERA_ERRO_DA_TELA_MS = 250;
var NEXUS_OBSERVA_ERRO_DA_TELA_MS = 3000;

function nexusVisivel(el) {
  return el.id !== "aviso-sessao" && !el.hidden && !(el.closest && el.closest("[hidden]"));
}

/* Erros visíveis da própria tela: os de falha e os que já passaram a neutro
   por este mesmo aviso (marcados com .erro-de-sessao; um segundo 503, como o
   do /me, não pode trazer o aviso do topo de volta). */
function nexusErrosDaTela() {
  var lugar = document.querySelector("main") || document.body;
  if (!lugar || !lugar.querySelectorAll) return [];
  var falhas = Array.prototype.filter.call(lugar.querySelectorAll(".alerta-falha"), nexusVisivel);
  var neutros = Array.prototype.filter.call(lugar.querySelectorAll(".erro-de-sessao"), nexusVisivel);
  return falhas.concat(neutros);
}

/* Deixa os erros da tela neutros e esconde o aviso do topo. */
function nexusAjustarErrosDaTela() {
  var erros = nexusErrosDaTela();
  if (!erros.length) return false;
  erros.forEach(function (el) {
    el.classList.remove("alerta-falha");
    el.classList.add("alerta-neutro");
    el.classList.add("erro-de-sessao");
  });
  var topo = document.getElementById("aviso-sessao");
  if (topo) topo.hidden = true;
  return true;
}

function nexusMostrarAvisoNoTopo(texto) {
  var aviso = document.getElementById("aviso-sessao");
  if (!aviso) {
    aviso = document.createElement("div");
    aviso.id = "aviso-sessao";
    aviso.className = "alerta alerta-neutro aviso-sessao";
    aviso.setAttribute("role", "alert");
    var lugar = document.querySelector("main") || document.body;
    if (!lugar) return;
    lugar.insertBefore(aviso, lugar.firstChild);
  }
  var paragrafo = document.createElement("p");
  paragrafo.textContent = texto;
  aviso.replaceChildren(paragrafo);
  aviso.hidden = false;
}

function nexusAvisoDeSessao(texto) {
  if (typeof document === "undefined") return;
  setTimeout(function () {
    if (nexusAjustarErrosDaTela()) return;
    nexusMostrarAvisoNoTopo(texto);
    /* Se o erro da tela aparecer depois, ele fica e o do topo sai. */
    if (typeof MutationObserver === "function" && document.body) {
      var observador = new MutationObserver(function () {
        if (nexusAjustarErrosDaTela()) observador.disconnect();
      });
      observador.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "hidden"] });
      setTimeout(function () { observador.disconnect(); }, NEXUS_OBSERVA_ERRO_DA_TELA_MS);
    }
  }, NEXUS_ESPERA_ERRO_DA_TELA_MS);
}

/* Notas neste aparelho (revisão do Argos no PR 24). Sem o «sim» confirmado
   pelo servidor, nenhuma cópia do texto da nota fica guardada: a cópia do
   dia perde a nota e o rascunho do registro (check-in e dia difícil) sai.
   NEXUS_CHAVE_ESCOLHA_NOTA guarda só a escolha («yes»), nunca texto. */
var NEXUS_CHAVE_ESCOLHA_NOTA = "nexus_v2_escolha_nota";
var NEXUS_CHAVE_RASCUNHO_NOTA = "nexus_v2_rascunho_checkin";

function nexusEsquecerNotasLocais() {
  try {
    var bruto = localStorage.getItem("nexus_v2_hoje");
    if (bruto) {
      var cache = JSON.parse(bruto);
      if (cache && typeof cache === "object" && cache.nota) {
        cache.nota = "";
        localStorage.setItem("nexus_v2_hoje", JSON.stringify(cache));
      }
    }
  } catch (erroCache) {}
  try {
    sessionStorage.removeItem(NEXUS_CHAVE_RASCUNHO_NOTA);
  } catch (erroRascunho) {}
}

/* Guarda a escolha lida do servidor. Qualquer coisa que não seja «yes»
   esquece as cópias locais da nota. */
function nexusLembrarEscolhaNota(valor) {
  try {
    if (valor === "yes") sessionStorage.setItem(NEXUS_CHAVE_ESCOLHA_NOTA, "yes");
    else sessionStorage.removeItem(NEXUS_CHAVE_ESCOLHA_NOTA);
  } catch (erro) {}
  if (valor !== "yes") nexusEsquecerNotasLocais();
}

/* O rascunho do texto da nota só pode ficar com o «sim» confirmado nesta aba. */
function nexusPodeGuardarRascunhoDaNota() {
  try {
    return sessionStorage.getItem(NEXUS_CHAVE_ESCOLHA_NOTA) === "yes";
  } catch (erro) {
    return false;
  }
}

/* Estado do aviso neste aparelho: "permitido", "pendente" (ainda não
   pedido), "bloqueado" ou "sem-suporte". */
function nexusEstadoDoAviso() {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return "sem-suporte";
  if (Notification.permission === "granted") return "permitido";
  if (Notification.permission === "denied") return "bloqueado";
  return "pendente";
}

function nexusBytesDaChave(base64) {
  var limpo = String(base64 || "").trim();
  var padding = "=".repeat((4 - (limpo.length % 4)) % 4);
  var base = (limpo + padding).replace(/-/g, "+").replace(/_/g, "/");
  var cru = atob(base);
  var saida = new Uint8Array(cru.length);
  for (var i = 0; i < cru.length; i++) saida[i] = cru.charCodeAt(i);
  return saida;
}

/* Inscreve este aparelho para receber avisos (só com a permissão dada).
   Não liga os lembretes: isso é a escolha da pessoa (PUT reminders). */
async function nexusInscreverAvisos() {
  if (nexusEstadoDoAviso() !== "permitido") return false;
  var chave = await NexusApi.chaveVapid();
  var publica = chave.ok && chave.dados && typeof chave.dados.publicKey === "string" ? chave.dados.publicKey : "";
  if (!publica) return false;
  var registro = await navigator.serviceWorker.register("sw.js");
  var inscricao = await registro.pushManager.getSubscription();
  if (!inscricao) {
    inscricao = await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: nexusBytesDaChave(publica) });
  }
  if (!inscricao || typeof inscricao.toJSON !== "function") return false;
  var resultado = await NexusApi.inscreverNotificacao(inscricao.toJSON());
  return !!resultado.ok;
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
  var codigo = dados && typeof dados.code === "string" ? dados.code : "";
  if (extras.auth && resposta.status === 401 && codigo === "session_ended") {
    nexusSessaoEncerrada();
    return { ok: false, semRede: false, status: 401, erro: NEXUS_TEXTO_SESSAO_ENCERRADA, dados: dados, sessaoEncerrada: true };
  }
  if (extras.auth && resposta.status === 503 && codigo === "auth_unavailable") {
    nexusAvisoDeSessao(NEXUS_TEXTO_SESSAO_INDISPONIVEL);
    return { ok: false, semRede: false, status: 503, erro: NEXUS_TEXTO_SESSAO_INDISPONIVEL, dados: dados, sessaoIndisponivel: true };
  }
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
  /* Telas da comunidade, 1.ª parte (PRs 40 a 44 do servidor).
     GET /api/communities/recommended/:missionId → { area, subject, communities }
     (as da área da missão, as de assunto parecido primeiro; 404 se a missão
     não é da pessoa; sem área, a lista vem vazia). */
  comunidadesRecomendadas: function (missaoId) {
    return nexusPedir(caminhoComCenario("/api/communities/recommended/" + encodeURIComponent(missaoId)), null, { metodo: "GET", auth: true });
  },
  /* POST /api/communities/:slug/join: entrar (um toque; já membro também é 200). */
  entrarNaComunidade: function (slug) {
    return nexusPedir(caminhoComCenario("/api/communities/" + encodeURIComponent(slug) + "/join"), null, { metodo: "POST", auth: true });
  },
  /* GET /:slug/posts?cursor= → { posts, next_cursor, page_size, continuous_scroll,
     scroll_hint }. 10 por página antes do dia cumprido, 20 depois. Cada post traz
     supports (o total) e supported_by_me, nunca quem apoiou. */
  postsDaComunidade: function (slug, cursor) {
    var caminho = caminhoComCenario("/api/communities/" + encodeURIComponent(slug) + "/posts");
    if (typeof cursor === "string" && cursor) {
      caminho += (caminho.indexOf("?") === -1 ? "?" : "&") + "cursor=" + encodeURIComponent(cursor);
    }
    return nexusPedir(caminho, null, { metodo: "GET", auth: true });
  },
  /* GET /:slug/highlights → { highlights } (até 3 da semana, sem post escondido). */
  destaquesDaComunidade: function (slug) {
    return nexusPedir(caminhoComCenario("/api/communities/" + encodeURIComponent(slug) + "/highlights"), null, { metodo: "GET", auth: true });
  },
  /* POST /:slug/posts com { content }. 201 { post }; 200 com crisis: true (não
     publicado; a tela abre a ajuda); 403 com code (read_only, no_active_mission,
     other_area...); 429 limite de 3 em 24 h. */
  publicarPost: function (slug, texto) {
    return nexusPedir(caminhoComCenario("/api/communities/" + encodeURIComponent(slug) + "/posts"), { content: texto }, { metodo: "POST", auth: true });
  },
  /* POST e DELETE /:slug/posts/:postId/support → { supported, supports }. */
  apoiarPost: function (slug, postId, ligar) {
    return nexusPedir(caminhoComCenario("/api/communities/" + encodeURIComponent(slug) + "/posts/" + encodeURIComponent(postId) + "/support"), null, { metodo: ligar ? "POST" : "DELETE", auth: true });
  },
  /* POST /api/communities com { name, area, category (assunto), description
     (regras), icon (só emoji) }. 201 { community }; 200 com crisis: true;
     403 needs_completed_mission; 409 nome repetido; 429 uma por semana. */
  criarComunidade: function (dados) {
    var corpo = { name: dados.name, area: dados.area };
    if (dados.category) corpo.category = dados.category;
    if (dados.description) corpo.description = dados.description;
    if (dados.icon) corpo.icon = dados.icon;
    return nexusPedir(caminhoComCenario("/api/communities"), corpo, { metodo: "POST", auth: true });
  },
  /* GET /api/communities/merit/me → { missions, title, next, rule }. */
  meuMerito: function () {
    return nexusPedir(caminhoComCenario("/api/communities/merit/me"), null, { metodo: "GET", auth: true });
  },
  /* GET /:slug/ranking → { top (3 primeiros), me (ou null), rule }. */
  rankingDaComunidade: function (slug) {
    return nexusPedir(caminhoComCenario("/api/communities/" + encodeURIComponent(slug) + "/ranking"), null, { metodo: "GET", auth: true });
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
  /* Aceite obrigatório (PR 28): terms_version e privacy_version são as que a
     tela mostrou (legal-textos.js). Sem elas, ou com versão antiga, 400 com
     code legal_acceptance_required ou legal_version_outdated. */
  cadastrar: function (dados) {
    return nexusPedir("/api/users/register", {
      username: dados.username,
      email: dados.email,
      password: dados.password,
      /* AAAA-MM-DD. O servidor confere os 18 anos e não grava a data (PR 18). */
      birth_date: dados.birth_date,
      terms_version: dados.terms_version,
      privacy_version: dados.privacy_version
    });
  },
  /* Nota do check-in (PR 27 do servidor). GET devolve { note_consent:
     "yes" | "no" | null, decided_at, version }. POST com { consent: true }
     liga; DELETE grava «não» e apaga as notas já guardadas (notes_deleted).
     Sem a migração 007: GET null, POST e DELETE 503. */
  escolhaDaNota: function () {
    return nexusPedir("/api/users/me/note-consent", null, { metodo: "GET", auth: true });
  },
  guardarNotas: function () {
    return nexusPedir("/api/users/me/note-consent", { consent: true }, { metodo: "POST", auth: true });
  },
  naoGuardarNotas: function () {
    return nexusPedir("/api/users/me/note-consent", null, { metodo: "DELETE", auth: true });
  },
  /* Lembretes e novidades (PR 29). GET { reminders: { choice, decided_at },
     news: {...} }; PUT só com true/false de verdade. O site só mexe nos
     lembretes: o interruptor de novidades fica escondido (decisão de 22/11). */
  escolhasDeAvisos: function () {
    return nexusPedir("/api/users/me/notification-preferences", null, { metodo: "GET", auth: true });
  },
  mudarLembretes: function (ligado) {
    return nexusPedir("/api/users/me/notification-preferences", { reminders: ligado === true }, { metodo: "PUT", auth: true });
  },
  /* Aviso de mensagem nova do chat (migração 010 do servidor). Antes dela,
     GET devolve messages: null e o PUT responde 503. */
  mudarAvisosDeMensagem: function (ligado) {
    return nexusPedir("/api/users/me/notification-preferences", { messages: ligado === true }, { metodo: "PUT", auth: true });
  },
  /* Chat do Duo/Rival (PRs 32 a 35 do servidor). */
  /* GET /api/messages/:missionId → { mission_id, messages: [...] }: só o par
     atual; sem par ativo, a lista vem vazia. 403 sem acesso. */
  listarMensagens: function (missaoId) {
    return nexusPedir(caminhoComCenario("/api/messages/" + encodeURIComponent(missaoId)), null, { metodo: "GET", auth: true });
  },
  /* POST /api/messages com { mission_id, content }. 201 { message }; 200 com
     crisis: true (não foi enviada; a tela abre a ajuda); 400, 403, 429. */
  enviarMensagem: function (missaoId, texto) {
    return nexusPedir(caminhoComCenario("/api/messages"), { mission_id: missaoId, content: texto }, { metodo: "POST", auth: true });
  },
  /* POST /api/messages/:messageId/report com { reason, details? }. */
  denunciarMensagem: function (mensagemId, motivo, detalhes) {
    var corpo = { reason: motivo };
    if (typeof detalhes === "string" && detalhes.trim()) corpo.details = detalhes.trim();
    return nexusPedir(caminhoComCenario("/api/messages/" + encodeURIComponent(mensagemId) + "/report"), corpo, { metodo: "POST", auth: true });
  },
  /* POST /api/messages/:missionId/block: encerra o par e impede um novo. */
  bloquearPar: function (missaoId) {
    return nexusPedir(caminhoComCenario("/api/messages/" + encodeURIComponent(missaoId) + "/block"), null, { metodo: "POST", auth: true });
  },
  /* GET /api/users/me/blocks → { blocks: [{ block_id, username, created_at }] }.
     Só quem eu bloqueei, do mais recente ao mais antigo. O mock só responde
     em localhost, 127.0.0.1 e [::1]. */
  listarBloqueios: function () {
    return nexusPedir(caminhoComCenario("/api/users/me/blocks"), null, { metodo: "GET", auth: true });
  },
  /* DELETE /api/users/me/blocks/:blockId. 200 { unblocked: true } também quando
     a linha já não existe. O parâmetro é o id do bloqueio, nunca o da pessoa. */
  desbloquear: function (blockId) {
    return nexusPedir(caminhoComCenario("/api/users/me/blocks/" + encodeURIComponent(blockId)), null, { metodo: "DELETE", auth: true });
  },
  /* Só admin: denúncias do chat (trecho, motivo e comentário, sem nomes). */
  denunciasDoChat: function () {
    return nexusPedir(caminhoComCenario("/api/messages/admin/reports"), null, { metodo: "GET", auth: true });
  },
  /* DELETE /api/users/me com { password } (PR 26). 200 { deleted: true };
     403 wrong_password ou admin_account; 400 password_required; 429. */
  excluirConta: function (senha) {
    return nexusPedir("/api/users/me", { password: senha }, { metodo: "DELETE", auth: true });
  },
  /* POST /api/users/me/legal-acceptance com as versões que a tela mostrou.
     200 { legal }; 400 legal_acceptance_required ou legal_version_outdated;
     503 sem a migração 008. */
  aceitarTermos: function (versoes) {
    return nexusPedir("/api/users/me/legal-acceptance", {
      terms_version: versoes.terms_version,
      privacy_version: versoes.privacy_version
    }, { metodo: "POST", auth: true });
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
  /* Convite por link (PR 38 do servidor). O token vai SEMPRE no corpo,
     nunca na URL (a URL entra nos registros de acesso do servidor). */
  criarConvite: function (missaoId, tipo) {
    return nexusPedir(caminhoComCenario("/api/invites"), { mission_id: Number(missaoId), kind: tipo }, { metodo: "POST", auth: true });
  },
  cancelarConvite: function (conviteId) {
    return nexusPedir(caminhoComCenario("/api/invites/" + encodeURIComponent(conviteId)), null, { metodo: "DELETE", auth: true });
  },
  verConvite: function (token) {
    return nexusPedir(caminhoComCenario("/api/invites/preview"), { token: token }, { metodo: "POST", auth: true });
  },
  aceitarConvite: function (token, missaoId) {
    var corpo = { token: token };
    if (missaoId != null) corpo.mission_id = Number(missaoId);
    return nexusPedir(caminhoComCenario("/api/invites/accept"), corpo, { metodo: "POST", auth: true });
  },
  /* GET /api/checkins/:id/score: scores (dias), points (pontos do Rival, PR 37), leader. */
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
    /* Área opcional. Só vai se a pessoa escolheu uma das três. Sem escolha, o campo fica de fora. */
    if (dados.area === "mente" || dados.area === "corpo" || dados.area === "rotina") corpo.area = dados.area;
    /* Assunto opcional. Só vai se sobrou texto depois do trim. Vazio fica de fora. */
    if (typeof dados.subject === "string" && dados.subject.trim()) corpo.subject = dados.subject.trim();
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

/* Reaceitação (PR 28): quem já está com a sessão aberta e precisa aceitar a
   versão atual vai à tela de aceite. Confere uma vez por aba, pelo /me
   (user.legal.needs_acceptance). Não roda na tela de entrar (ela mesma
   cuida disso) nem sem sessão. Sem internet ou com falha: segue a tela,
   e a conferência tenta de novo na próxima tela. */
function nexusConferirAceite() {
  if (typeof document === "undefined" || typeof location === "undefined") return;
  if (/(^|\/)(index\.html)?$/.test(location.pathname)) return;
  var token = "";
  try {
    token = localStorage.getItem("nexus_v2_token") || "";
    if (sessionStorage.getItem(NEXUS_CHAVE_ACEITE_OK) === "sim") return;
  } catch (erro) {
    return;
  }
  if (!token) return;
  NexusApi.eu().then(function (resultado) {
    if (!resultado.ok) return;
    var usuario = resultado.dados && resultado.dados.user;
    var legal = usuario && usuario.legal;
    if (!legal || typeof legal.needs_acceptance !== "boolean") return;
    if (legal.needs_acceptance) {
      location.replace("./index.html" + nexusBuscaTema() + "#aceitar-termos");
      return;
    }
    try {
      sessionStorage.setItem(NEXUS_CHAVE_ACEITE_OK, "sim");
    } catch (erroSessao) {}
  });
}

nexusConferirAceite();
