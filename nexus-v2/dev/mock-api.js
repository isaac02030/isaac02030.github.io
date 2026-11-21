/* Mock local da API. Só para testar a tela neste computador.
   Não é o servidor do Nexus. Não guarda senha em arquivo.
   A chave pública do aviso nasce na memória e não é gravada.
   Rode na raiz do repositório: node nexus-v2/dev/mock-api.js
   A tela fala com http://localhost:3000 (veja NEXUS_API_URL em api.js).

   Login (POST /api/users/login):
   - senha "errada" → 401 Credenciais inválidas.
   - e-mail falha@exemplo.com → 500
   - e-mail lento@exemplo.com → espera e depois entra
   - e-mail com-missao@exemplo.com → entra e já tem uma missão ativa
   - qualquer outro e-mail e senha → entra, sem missão
   Cadastro (POST /api/users/register):
   - senha com menos de 6 caracteres → 400
   - nome "repetido" ou e-mail repetido@exemplo.com → 400 já em uso
   - e-mail falha@exemplo.com → 500
   - o resto cria a conta, sem missão
   Missão (POST /api/missions), com o token do login:
   - sem título ou sem categoria → 400
   - título exatamente "falha" → 500
   - título exatamente "lento" → espera 8 segundos e cria
   - o resto cria a missão. duration_days do pedido é ignorado e fica 30,
     como na rota de verdade. started_at nasce agora.
   Aviso:
   - GET /api/notifications/vapid-key → chave pública
   - POST /api/notifications/subscribe → grava a inscrição na memória
   Lembrete (PUT /api/users/me/reminder):
   - esta rota ainda não existe no servidor de verdade
   - só responde se a origem for localhost, 127.0.0.1 ou [::1]
   - fora disso, devolve 404 e não guarda nada
   - aqui ela guarda { reminder_time, timezone } na memória
   - ?cenario=lembrete-erro → 500, não guarda
   - ?cenario=lembrete-lento → espera 8 segundos e guarda
   Estender (POST /api/missions/:id/extend com { days: 36 }):
   - esta rota ainda não existe no servidor de verdade
   - não é continue-solo
   - só responde se a origem for localhost, 127.0.0.1 ou [::1]
   - fora disso, devolve 404 e não muda a duração
   - aqui soma 36 a duration_days. Se o status era completed, volta a active
   - ?cenario=extend-erro → 500, não muda a duração

   Hoje (a tela pede estas rotas, nunca o placar):
   - GET /api/missions
   - GET /api/missions/:id  (inclui partner_name)
   - GET /api/checkins/:missionId  → { progress }
   - GET /api/checkins/:missionId/streak
     → streak, total, today_done, brio, consistency, recovered,
       missed_yesterday, missed_days, missed_days_before_today, recovery_needed
   - GET /api/checkins/:id/score espelha o servidor: { mission_id, mode, scores,
     leader, my_streak }. scores usa o username como chave. Sem par, a chave
     "null" existe, como na rota de verdade. A tela Missão só lê isso no Rival.
   - POST /api/missions/:id/abandon segue a rota de verdade.
     Solo ativo encerra. Com par, a outra pessoa continua em solo.
     Missão que não está ativa responde 404.

   A sequência manda difficult_days (números do dia), difficult_days_used e
   difficult_days_remaining. Cada check-in pode trazer difficult (true ou false).
   Os cenários abaixo mandam esses campos. Uma missão criada pela tela não
   recebe. O cenário sem-campo também não, e ignora difficult no POST.

   Troque o estado com ?cenario= na URL da tela, ou entre com o e-mail:
   - nao-registrado  (nao-registrado@exemplo.com)  dia ainda sem registro
   - registrado      (registrado@exemplo.com)      registro feito, com nota
   - dificil-hoje                                  o dia de hoje foi registrado como difícil, com nota
   - duo             (duo@exemplo.com)             Duo, Par Teste já registrou
   - duo-sem         (duo-sem@exemplo.com)         Duo, o par ainda não registrou
   - esperando       (esperando@exemplo.com)       à espera do par, Solo visível
   - vazio           (vazio@exemplo.com)           sem missão
   - erro            (erro-hoje@exemplo.com)       falha ao abrir o dia
   - recuperacao     (recuperacao@exemplo.com)     ontem sem registro, dentro do Hoje
   - falta-1         (falta-1@exemplo.com)         igual à recuperação: 1 dia
   - falta-3         (falta-3@exemplo.com)         3 dias sem registro
   - recuperacao-zero (recuperacao-zero@exemplo.com) restantes 0, sem o link difícil
   - recuperacao-sem-numero                        sem missed_days e sem dia difícil
   - recuperacao-sem-fato                          sem missed_days e sem missed_yesterday
   - recuperacao-seguidos                          2 seguidos forçados, o link some
   - recuperacao-sem-minimo                        sem o mínimo gravado
   - recuperacao-minusculo                         mínimo em minúscula, na linha de baixo
   - falta-antiga        (falta-antiga@exemplo.com) Hoje normal, com um dia antigo sem registro
   - recuperacao-sem-antes                         sem missed_days_before_today, cai em missed_days - 1
   - recuperacao-contagem-zero                     antes de hoje é 0; a frase não mostra 0
   - recuperacao-contagem-some                     antes de hoje é 0 e ontem houve registro; a frase some
   - sem-campo       (sem-campo@exemplo.com)       igual ao não registrado, sem dia difícil
   - solo            (solo@exemplo.com)            Solo, sem par
   - duo-esperando   (duo-esperando@exemplo.com)   Duo à espera, o dia conta
   - duo-com-par     (duo-com-par@exemplo.com)     Duo com Ana, nome de exemplo
   - rival-placar    (rival-placar@exemplo.com)    Rival com Ana, dias de exemplo
   - convite-indisponivel                          Solo, o convite por link avisa
   - link-fake       (link-fake@exemplo.com)       a página só mostra o link em localhost
   - dois-seguidos   (dois-seguidos@exemplo.com)   os 2 dias anteriores foram difíceis
   - quatro-usados   (quatro-usados@exemplo.com)   difficult_days_remaining 0
   - sem-restante    (sem-restante@exemplo.com)    há dia difícil, sem o campo remaining
   - ignora-difficult (ignora-difficult@exemplo.com) o POST não confirma difficult
   - so-is-difficult (so-is-difficult@exemplo.com) o POST grava, mas responde is_difficult
   - post-seguidos   (post-seguidos@exemplo.com)   o POST responde o 400 de 2 seguidos
   - post-crise      (post-crise@exemplo.com)      o POST grava sem a nota e responde crisis: true,
                                                    como o filtro do servidor. O mock não lê a nota:
                                                    o sinal vem só do cenário.
   - post-quatro     (post-quatro@exemplo.com)     o POST responde o 400 dos 4 dias
   - quatro-e-seguidos (quatro-e-seguidos@exemplo.com) os 4 acabaram e os 2 anteriores também

   Check-in (POST /api/checkins com { mission_id, note } e, na tela 5,
   difficult: true e minimum_done: true; sem minimum_done, 400 como no servidor):
   A resposta segue a rota de verdade: { checkin, day, already_done, message }.
   Campo de crise só no cenário post-crise. Não lemos a nota para inventar um.
   Com difficult: true, o check-in volta com difficult: true, salvo nos cenários
   que ignoram o campo. A rota real devolve a coluna is_difficult; o cenário
   so-is-difficult copia isso e não manda checkin.difficult.
   - estudo            formulário de aprendizagem, dia em aberto
   - academia          (academia@exemplo.com)        categoria fitness
   - lento             o POST espera 8 segundos e registra
   - erro-registro     (erro-registro@exemplo.com)   POST responde 500
   - nota-servidor     (nota-servidor@exemplo.com)   POST 400 no texto europeu da prova
   - repetido          POST responde already_done true
   - terminada         (terminada@exemplo.com)       o dia passou de 30
   - fim-30            (fim-30@exemplo.com)          dia 31, 30 check-ins
   - fim-27            (fim-27@exemplo.com)          dia 31, 27 check-ins
   - fim-status        (fim-status@exemplo.com)      status completed no dia 12
   - extend-erro       (extend-erro@exemplo.com)     o POST /extend responde 500
   - inativa           (inativa@exemplo.com)         a missão não está ativa
   - sem-porque        o porquê vem vazio

   Resposta do Grande Irmão (a página resolve, sem rota de IA):
   A flag NEXUS_ABRIR_TELA_IA_APOS_CHECKIN continua false.
   ?ia=1 no check-in ou no dia difícil manda o sucesso para grande-irmao.html
   só se o host for localhost ou 127.0.0.1. Em outro host, ?ia=1 não faz nada.
   Estes cenários são da página, não deste servidor:
   - cumpriu       frase fixa do dia cumprido
   - dificil       frase fixa do dia difícil (dia-dificil é o mesmo)
   - volta         frase fixa da volta ao ciclo
   - offline       frase fixa, sem erro técnico
   - ia-exemplo    só em localhost/127.0.0.1; o texto fica em dev/ia-exemplo.js
   Não existe GET /api/vertice/message nem POST /api/assistant/mission.

   Isto não vale no servidor de verdade. São só atalhos deste arquivo.
   Os nomes daqui são de teste. Par Teste não é uma pessoa real. */

var http = require("http");
var crypto = require("crypto");

var PORTA = 3000;
if (/^[0-9]+$/.test(String(process.env.NEXUS_MOCK_PORTA || ""))) {
  PORTA = Number(process.env.NEXUS_MOCK_PORTA);
}
var ESPERA_LENTA_MS = 4000;
var ESPERA_MISSAO_MS = 8000;
var MS_DIA = 24 * 60 * 60 * 1000;
var emailsUsados = { "repetido@exemplo.com": true };
var nomesUsados = { repetido: true };
var usuarios = {};
var proximaMissao = 2;
var proximoUsuario = 1;

var CENARIO_POR_EMAIL = {
  "nao-registrado@exemplo.com": "nao-registrado",
  "registrado@exemplo.com": "registrado",
  "duo@exemplo.com": "duo",
  "duo-sem@exemplo.com": "duo-sem",
  "esperando@exemplo.com": "esperando",
  "vazio@exemplo.com": "vazio",
  "erro-hoje@exemplo.com": "erro",
  "recuperacao@exemplo.com": "recuperacao",
  "falta-1@exemplo.com": "falta-1",
  "falta-3@exemplo.com": "falta-3",
  "recuperacao-zero@exemplo.com": "recuperacao-zero",
  "falta-antiga@exemplo.com": "falta-antiga",
  "sem-campo@exemplo.com": "sem-campo",
  "solo@exemplo.com": "solo",
  "duo-esperando@exemplo.com": "duo-esperando",
  "duo-com-par@exemplo.com": "duo-com-par",
  "rival-placar@exemplo.com": "rival-placar",
  "convite-indisponivel@exemplo.com": "convite-indisponivel",
  "link-fake@exemplo.com": "link-fake",
  "academia@exemplo.com": "academia",
  "estudo@exemplo.com": "estudo",
  "terminada@exemplo.com": "terminada",
  "fim-30@exemplo.com": "fim-30",
  "fim-27@exemplo.com": "fim-27",
  "fim-status@exemplo.com": "fim-status",
  "extend-erro@exemplo.com": "extend-erro",
  "inativa@exemplo.com": "inativa",
  "erro-registro@exemplo.com": "erro-registro",
  "nota-servidor@exemplo.com": "nota-servidor",
  "dois-seguidos@exemplo.com": "dois-seguidos",
  "quatro-usados@exemplo.com": "quatro-usados",
  "sem-restante@exemplo.com": "sem-restante",
  "ignora-difficult@exemplo.com": "ignora-difficult",
  "so-is-difficult@exemplo.com": "so-is-difficult",
  "post-seguidos@exemplo.com": "post-seguidos",
  "post-crise@exemplo.com": "post-crise",
  "post-quatro@exemplo.com": "post-quatro",
  "quatro-e-seguidos@exemplo.com": "quatro-e-seguidos"
};

function faixaDeDias(ate, pular) {
  var lista = [];
  var fora = {};
  var dia;
  (pular || []).forEach(function (n) { fora[n] = true; });
  for (dia = 1; dia <= ate; dia++) {
    if (!fora[dia]) lista.push(dia);
  }
  return lista;
}

var CENARIOS = {
  "nao-registrado": { dia: 4, feitos: [1, 3], dificeis: [1, 2], restantes: 2 },
  registrado: { dia: 4, feitos: [1, 3, 4], dificeis: [1, 2], restantes: 2, nota: "Li a página combinada." },
  "dificil-hoje": { dia: 4, feitos: [1, 3, 4], dificeis: [2, 4], restantes: 2, nota: "Li meia página, devagar." },
  duo: { dia: 4, feitos: [1, 3], dificeis: [1, 2], restantes: 2, modo: "parceiro", parFeitos: [1, 2, 3, 4] },
  "duo-sem": { dia: 4, feitos: [1, 3], dificeis: [1, 2], restantes: 2, modo: "parceiro", parFeitos: [1, 2] },
  esperando: { dia: 4, feitos: [1, 3], dificeis: [1, 2], restantes: 2, esperando: true },
  recuperacao: { dia: 4, feitos: [1, 2], dificeis: [2], restantes: 3 },
  "falta-1": { dia: 4, feitos: [1, 2], dificeis: [2], restantes: 3 },
  "falta-3": { dia: 6, feitos: [1, 2], dificeis: [2], restantes: 3 },
  "recuperacao-zero": { dia: 8, feitos: [1, 2, 3, 4, 5, 6], dificeis: [1, 3, 5, 6], restantes: 0 },
  "recuperacao-sem-numero": { dia: 4, feitos: [1, 2], omitirDificeis: true, omitirMissedDays: true },
  "recuperacao-sem-fato": { dia: 4, feitos: [1, 2], dificeis: [2], restantes: 3, omitirMissedDays: true, omitirAntes: true, omitirOntem: true },
  "recuperacao-seguidos": {
    dia: 4,
    feitos: [1],
    dificeis: [1],
    restantes: 3,
    forcarSequencia: {
      recovery_needed: true,
      missed_yesterday: true,
      missed_days: 2,
      today_done: false,
      difficult_days: [2, 3],
      difficult_days_used: 2,
      difficult_days_remaining: 2
    }
  },
  "recuperacao-sem-minimo": { dia: 4, feitos: [1, 2], dificeis: [2], restantes: 3, minimo: "" },
  "recuperacao-minusculo": { dia: 4, feitos: [1, 2], dificeis: [2], restantes: 3, minimo: "uma página" },
  "falta-antiga": { dia: 5, feitos: [1, 2, 4], dificeis: [1], restantes: 3 },
  "recuperacao-sem-antes": { dia: 6, feitos: [1, 2], dificeis: [2], restantes: 3, omitirAntes: true },
  "recuperacao-contagem-zero": {
    dia: 4,
    feitos: [1, 2],
    dificeis: [2],
    restantes: 3,
    forcarSequencia: {
      recovery_needed: true,
      missed_yesterday: true,
      missed_days: 1,
      missed_days_before_today: 0,
      today_done: false
    }
  },
  "recuperacao-contagem-some": {
    dia: 4,
    feitos: [1, 2, 3],
    dificeis: [2],
    restantes: 3,
    forcarSequencia: {
      recovery_needed: true,
      missed_yesterday: false,
      missed_days: 0,
      missed_days_before_today: 0,
      today_done: false
    }
  },
  "recuperacao-negativo": {
    dia: 4,
    feitos: [1, 2, 3],
    dificeis: [2],
    restantes: 3,
    forcarSequencia: {
      recovery_needed: true,
      missed_yesterday: false,
      missed_days: 0,
      missed_days_before_today: -1,
      today_done: false
    }
  },
  "sem-campo": { dia: 4, feitos: [1, 3], omitirDificeis: true, ignoraDifficult: true },
  estudo: { dia: 4, feitos: [1, 3], dificeis: [1, 2], restantes: 2 },
  academia: {
    dia: 4,
    feitos: [1, 3],
    dificeis: [1, 2],
    restantes: 2,
    categoria: "fitness",
    titulo: "Treinar no horário combinado",
    minimo: "Uma série",
    porque: "Quero manter o combinado"
  },
  lento: { dia: 4, feitos: [1, 3], dificeis: [1, 2], restantes: 2, espera: true },
  "erro-registro": { dia: 4, feitos: [1, 3], dificeis: [1, 2], restantes: 2, erroPost: 500 },
  "nota-servidor": { dia: 4, feitos: [1, 3], dificeis: [1, 2], restantes: 2, erroPost: "prova" },
  repetido: { dia: 4, feitos: [1, 3], dificeis: [1, 2], restantes: 2, postJaFeito: true },
  terminada: { dia: 31, feitos: [1, 3], dificeis: [1], restantes: 3 },
  "fim-30": { dia: 31, feitos: faixaDeDias(30), dificeis: [], restantes: 4, omitirDificeis: true },
  "fim-27": { dia: 31, feitos: faixaDeDias(30, [8, 16, 24]), dificeis: [], restantes: 4, omitirDificeis: true },
  "fim-status": { dia: 12, feitos: faixaDeDias(10), status: "completed", dificeis: [], restantes: 4, omitirDificeis: true },
  "extend-erro": { dia: 31, feitos: faixaDeDias(30), dificeis: [], restantes: 4, omitirDificeis: true, erroExtend: true },
  inativa: { dia: 4, feitos: [1], dificeis: [1], restantes: 3, status: "waiting" },
  "sem-porque": { dia: 4, feitos: [1, 3], dificeis: [1, 2], restantes: 2, porque: "" },
  "dois-seguidos": { dia: 4, feitos: [1, 2, 3], dificeis: [2, 3], restantes: 2 },
  "quatro-usados": { dia: 8, feitos: [1, 3, 5, 7], dificeis: [1, 3, 5, 7], restantes: 0 },
  "sem-restante": { dia: 4, feitos: [1, 3], dificeis: [1] },
  "ignora-difficult": { dia: 4, feitos: [1, 3], dificeis: [1, 2], restantes: 2, ignoraDifficult: true },
  "so-is-difficult": { dia: 4, feitos: [1, 3], dificeis: [1, 2], restantes: 2, respostaColuna: true },
  "post-seguidos": { dia: 4, feitos: [1, 3], dificeis: [1], restantes: 3, erroPost: "seguidos" },
  "post-crise": { dia: 4, feitos: [1, 3], dificeis: [1, 2], restantes: 2, crisePost: true },
  "post-quatro": { dia: 5, feitos: [1, 3], dificeis: [1, 3], restantes: 2, erroPost: "quatro" },
  "quatro-e-seguidos": { dia: 6, feitos: [1, 2, 3, 4, 5], dificeis: [2, 3, 4, 5], restantes: 0 },
  /* Ana é um nome de exemplo. Não é uma pessoa real. Os dias também são fictícios. */
  solo: { dia: 4, feitos: [1, 3], dificeis: [1, 2], restantes: 2 },
  "duo-esperando": { dia: 4, feitos: [1, 3], dificeis: [1, 2], restantes: 2, aguardando: "duo" },
  "duo-com-par": {
    dia: 4,
    feitos: [1, 3],
    dificeis: [1, 2],
    restantes: 2,
    modo: "parceiro",
    parNome: "Ana",
    parFeitos: [1, 2]
  },
  "rival-placar": {
    dia: 6,
    feitos: [1, 3, 5],
    dificeis: [1],
    restantes: 3,
    modo: "rival",
    parNome: "Ana",
    parFeitos: [1, 2, 3, 4, 6]
  },
  "convite-indisponivel": { dia: 4, feitos: [1, 3], dificeis: [1, 2], restantes: 2 },
  "link-fake": { dia: 4, feitos: [1, 3], dificeis: [1, 2], restantes: 2, aguardando: "duo" },
  vazio: { vazio: true },
  erro: { erro: true }
};

/* Registro feito neste processo, por e-mail e cenário. Só para o Hoje
   mostrar o dia cumprido depois do POST. Não é o banco de verdade. */
var registroDoCenario = {};
/* Dias somados por POST /extend neste processo. Não é o banco de verdade. */
var extensoes = {};

function chavePublicaVapid() {
  var par = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  var jwk = par.publicKey.export({ format: "jwk" });
  var x = Buffer.from(jwk.x, "base64url");
  var y = Buffer.from(jwk.y, "base64url");
  return Buffer.concat([Buffer.from([4]), x, y]).toString("base64url");
}

var CHAVE_PUBLICA = chavePublicaVapid();

function enviar(res, status, dados) {
  var corpo = JSON.stringify(dados);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Content-Length": Buffer.byteLength(corpo),
    "Cache-Control": "no-store"
  });
  res.end(corpo);
}

function lerCorpo(req) {
  return new Promise(function (resolve, reject) {
    var bruto = "";
    req.on("data", function (parte) {
      bruto += parte;
      if (bruto.length > 20000) {
        reject(new Error("corpo grande"));
        req.destroy();
      }
    });
    req.on("end", function () {
      if (!bruto) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(bruto));
      } catch (erro) {
        reject(erro);
      }
    });
    req.on("error", reject);
  });
}

function garantirUsuario(email, username) {
  if (!usuarios[email]) {
    usuarios[email] = {
      id: proximoUsuario,
      email: email,
      username: username || "pessoa",
      missoes: [],
      lembrete: null,
      avisos: [],
      checkins: {}
    };
    proximoUsuario += 1;
  }
  return usuarios[email];
}

function tokenDe(email) {
  return "teste-local." + encodeURIComponent(email);
}

function sessao(email, username) {
  garantirUsuario(email, username);
  return {
    token: tokenDe(email),
    user: {
      username: username || "pessoa",
      email: email
    }
  };
}

function autorizar(req) {
  var header = req.headers.authorization || "";
  if (!header) {
    return { status: 401, email: "", dados: { error: "Acesso negado. Token não fornecido." } };
  }
  var partes = header.split(" ");
  if (partes.length !== 2 || partes[0] !== "Bearer" || partes[1].indexOf("teste-local.") !== 0) {
    return { status: 403, email: "", dados: { error: "Token inválido ou expirado." } };
  }
  var email = "";
  try {
    email = decodeURIComponent(partes[1].slice("teste-local.".length));
  } catch (erro) {
    email = "";
  }
  if (!email || !usuarios[email]) {
    return { status: 403, email: "", dados: { error: "Token inválido ou expirado." } };
  }
  return { status: 200, email: email, dados: {} };
}

function queryDe(req) {
  var i = req.url.indexOf("?");
  if (i < 0) return new URLSearchParams();
  return new URLSearchParams(req.url.slice(i + 1));
}

function nomeDoCenario(req) {
  var pedido = queryDe(req).get("cenario") || "";
  if (!/^[a-z0-9-]{1,40}$/.test(pedido)) return "";
  return pedido;
}

/* O lembrete falso só existe no desenvolvimento, como o exemplo da tela 4.
   Uma página publicada não pode receber «horário salvo» deste processo. */
function hostDoPedido(req) {
  var origem = "";
  if (req.headers && typeof req.headers.origin === "string") origem = req.headers.origin;
  if (!origem && req.headers && typeof req.headers.referer === "string") origem = req.headers.referer;
  if (!origem) return "";
  try {
    return new URL(origem).hostname;
  } catch (erro) {
    return "";
  }
}

function pedidoDeDesenvolvimento(req) {
  var host = hostDoPedido(req);
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
}

function cenarioDe(req, email) {
  var pedido = queryDe(req).get("cenario") || "";
  if (pedido && CENARIOS[pedido]) return pedido;
  if (CENARIO_POR_EMAIL[email]) return CENARIO_POR_EMAIL[email];
  return "";
}

function numeroDoDia(startedAt) {
  var inicio = new Date(startedAt);
  if (!startedAt || isNaN(inicio.getTime())) return 1;
  var dia = Math.floor((Date.now() - inicio.getTime()) / MS_DIA) + 1;
  if (dia < 1) return 1;
  return dia;
}

function calcularBrio(doneDays, todayDay, streak) {
  var completedDays = doneDays.size;
  var totalDays = Math.max(todayDay, 1);
  var consistency = Math.round((completedDays / totalDays) * 100);
  var recoveredAfterMiss = false;
  var seenMiss = false;
  var day;
  for (day = 1; day <= todayDay; day++) {
    if (doneDays.has(day)) {
      if (seenMiss) {
        recoveredAfterMiss = true;
        break;
      }
    } else {
      seenMiss = true;
    }
  }
  var consistencyPart = Math.round(consistency * 0.6);
  var streakPart = Math.min(streak * 6, 24);
  var recoveryPart = completedDays === 0 ? 0 : (recoveredAfterMiss ? 16 : 8);
  var brio = Math.min(100, consistencyPart + streakPart + recoveryPart);
  return { brio: brio, consistency: consistency, recovered: recoveredAfterMiss };
}

function calcularRecuperacao(doneDays, todayDay) {
  var missedYesterday = todayDay > 1 && !doneDays.has(todayDay - 1);
  var missedDays = 0;
  var day;
  for (day = todayDay; day >= 1; day--) {
    if (doneDays.has(day)) break;
    missedDays += 1;
  }
  var antes = 0;
  if (!doneDays.has(todayDay)) antes = Math.max(0, missedDays - 1);
  return {
    missed_yesterday: missedYesterday,
    missed_days: missedDays,
    missed_days_before_today: antes,
    recovery_needed: missedYesterday && !doneDays.has(todayDay)
  };
}

function sequenciaDe(doneDays, todayDay, extra) {
  var streak = 0;
  var d;
  for (d = todayDay; d >= 1; d--) {
    if (doneDays.has(d)) streak += 1;
    else break;
  }
  var brio = calcularBrio(doneDays, todayDay, streak);
  var recovery = calcularRecuperacao(doneDays, todayDay);
  var corpo = {
    streak: streak,
    total: doneDays.size,
    today_done: doneDays.has(todayDay),
    brio: brio.brio,
    consistency: brio.consistency,
    recovered: brio.recovered,
    missed_yesterday: recovery.missed_yesterday,
    missed_days: recovery.missed_days,
    missed_days_before_today: recovery.missed_days_before_today,
    recovery_needed: recovery.recovery_needed
  };
  if (extra && !extra.omitirDificeis) {
    var diasDificeis = extra.dificeis || [];
    corpo.difficult_days = diasDificeis;
    corpo.difficult_days_used = diasDificeis.length;
    if (typeof extra.restantes === "number") corpo.difficult_days_remaining = extra.restantes;
  }
  return corpo;
}

function novaMissao(usuario, campos) {
  var agora = campos.started_at ? new Date(campos.started_at) : new Date();
  var id = campos.id;
  if (!id) {
    id = proximaMissao;
    proximaMissao += 1;
  }
  return {
    id: id,
    user_id: usuario.id,
    partner_id: campos.partner_id || null,
    title: campos.title,
    category: campos.category,
    description: campos.description || null,
    daily_minimum: typeof campos.daily_minimum === "string" ? campos.daily_minimum : null,
    commitment_window: null,
    why_it_matters: typeof campos.why_it_matters === "string" ? campos.why_it_matters : null,
    fallback_plan: null,
    proof_mode: campos.proof_mode || "self_report",
    study_focus: null,
    study_current_stage: null,
    study_target_outcome: null,
    level: "iniciante",
    mode: campos.mode || "solo",
    match_preference: campos.match_preference || null,
    duration_days: 30,
    user_score: campos.user_score || 0,
    partner_score: campos.partner_score || 0,
    status: campos.status || "active",
    started_at: agora.toISOString(),
    partner_started_at: null,
    pair_started_at: campos.pair_started_at || null,
    ends_at: new Date(agora.getTime() + 30 * MS_DIA).toISOString(),
    merged_into_id: null,
    user_contact: null,
    partner_contact: null,
    created_at: agora.toISOString(),
    user_name: usuario.username,
    partner_name: campos.partner_name || null
  };
}

function paraLista(missao) {
  return Object.assign({}, missao, {
    matching_enabled: false,
    counterpart_user_id: missao.partner_id,
    partner_mission_id: null,
    match_started_at: missao.pair_started_at || null,
    partner_last_checkin_day: null,
    partner_last_checkin_at: null
  });
}

function sequenciaDoCenario(spec, dificeis, restantes, acrescentouDificil) {
  if (spec.omitirDificeis || (!Array.isArray(spec.dificeis) && !acrescentouDificil)) {
    return { omitirDificeis: true };
  }
  var extra = { dificeis: dificeis };
  if (typeof restantes === "number") extra.restantes = restantes;
  return extra;
}

function montarCenario(nome, usuario) {
  var spec = CENARIOS[nome];
  if (!spec) return null;
  if (spec.erro) return { erro: true };
  if (spec.vazio) return { vazio: true };

  var dia = spec.dia;
  var extra = registroDoCenario[usuario.email + "|" + nome];
  var feitos = spec.feitos.slice();
  if (extra && feitos.indexOf(extra.day) === -1) feitos.push(extra.day);
  var dificeis = Array.isArray(spec.dificeis) ? spec.dificeis.slice() : [];
  var acrescentouDificil = false;
  if (!spec.omitirDificeis && extra && extra.difficult === true && dificeis.indexOf(extra.day) === -1) {
    dificeis.push(extra.day);
    acrescentouDificil = true;
  }
  var restantes = spec.restantes;
  if (acrescentouDificil && typeof restantes === "number") restantes = Math.max(0, restantes - 1);
  var notaDoDia = spec.nota || null;
  if (extra && extra.note) notaDoDia = extra.note;
  var inicio = new Date(Date.now() - (dia - 1) * MS_DIA).toISOString();
  var partner = null;
  if (spec.modo === "parceiro" || spec.modo === "rival") {
    partner = { id: usuario.id + 1000, name: spec.parNome || "Par Teste" };
  }
  var categoria = spec.categoria || "aprendizagem";

  var mission = novaMissao(usuario, {
    id: 7,
    title: spec.titulo || "Ler uma página por dia",
    category: categoria,
    daily_minimum: typeof spec.minimo === "string" ? spec.minimo : "Uma página",
    why_it_matters: spec.porque === "" ? "" : (spec.porque || "Quero ler sem traduzir"),
    proof_mode: spec.prova || (categoria === "fitness" ? "workout_proof" : "study_note"),
    mode: spec.modo || "solo",
    match_preference: spec.esperando || spec.aguardando === "duo"
      ? "parceiro"
      : (spec.modo === "parceiro" ? "parceiro" : (spec.modo === "rival" ? "rival" : null)),
    status: spec.status || (spec.esperando ? "waiting" : "active"),
    started_at: inicio,
    partner_id: partner ? partner.id : null,
    partner_name: partner ? partner.name : null,
    user_score: feitos.length,
    partner_score: (spec.parFeitos || []).length,
    pair_started_at: partner ? inicio : null
  });
  if (spec.aguardando) mission.pending_invite = spec.aguardando;
  var extraDias = extensoes[usuario.email + "|" + nome] || 0;
  if (extraDias > 0) {
    mission.duration_days += extraDias;
    var inicioMs = new Date(mission.started_at).getTime();
    if (!isNaN(inicioMs)) {
      mission.ends_at = new Date(inicioMs + mission.duration_days * MS_DIA).toISOString();
    }
    if (mission.status === "completed") mission.status = "active";
  }

  var progress = {};
  progress[String(usuario.id)] = {
    username: usuario.username,
    checkins: feitos.map(function (diaFeito) {
      var item = {
        day: diaFeito,
        completed: true,
        note: diaFeito === dia && notaDoDia ? notaDoDia : null
      };
      if (!spec.omitirDificeis && (Array.isArray(spec.dificeis) || acrescentouDificil)) {
        item.difficult = dificeis.indexOf(diaFeito) !== -1;
      }
      return item;
    })
  };
  if (partner) {
    progress[String(partner.id)] = {
      username: partner.name,
      checkins: (spec.parFeitos || []).map(function (diaFeito) {
        return { day: diaFeito, completed: true, note: null };
      })
    };
  }

  return {
    mission: mission,
    progress: { progress: progress },
    streak: ajustarSequencia(sequenciaDe(new Set(feitos), dia, sequenciaDoCenario(spec, dificeis, restantes, acrescentouDificil)), spec)
  };
}

function ajustarSequencia(streak, spec) {
  if (spec.omitirMissedDays) delete streak.missed_days;
  if (spec.omitirAntes) delete streak.missed_days_before_today;
  if (spec.omitirOntem) delete streak.missed_yesterday;
  if (spec.forcarSequencia) {
    Object.keys(spec.forcarSequencia).forEach(function (chave) {
      streak[chave] = spec.forcarSequencia[chave];
    });
  }
  return streak;
}

function acharMissao(email, id) {
  var lista = usuarios[email].missoes;
  for (var i = 0; i < lista.length; i++) {
    if (String(lista[i].id) === String(id)) return lista[i];
  }
  return null;
}

function progressoGuardado(email, id) {
  var usuario = usuarios[email];
  var lista = usuario.checkins[id] || [];
  var progress = {};
  if (lista.length) {
    progress[String(usuario.id)] = {
      username: usuario.username,
      checkins: lista.map(function (item) {
        var saida = {
          day: item.day,
          completed: item.completed === true,
          note: item.note || null
        };
        if (item.difficult === true) saida.difficult = true;
        return saida;
      })
    };
  }
  return { progress: progress };
}

async function login(corpo) {
  var email = typeof corpo.email === "string" ? corpo.email.trim() : "";
  var senha = typeof corpo.password === "string" ? corpo.password : "";
  if (!email || !senha) {
    return { status: 400, dados: { error: "Email e password são obrigatórios." } };
  }
  if (email === "falha@exemplo.com") {
    return { status: 500, dados: { error: "Erro interno." } };
  }
  if (email === "lento@exemplo.com") {
    await new Promise(function (resolver) {
      setTimeout(resolver, ESPERA_LENTA_MS);
    });
  }
  if (senha === "errada") {
    return { status: 401, dados: { error: "Credenciais inválidas." } };
  }
  return { status: 200, dados: sessao(email, "pessoa") };
}

function cadastro(corpo) {
  var username = typeof corpo.username === "string" ? corpo.username.trim() : "";
  var email = typeof corpo.email === "string" ? corpo.email.trim() : "";
  var senha = typeof corpo.password === "string" ? corpo.password : "";
  if (!username || !email || !senha) {
    return { status: 400, dados: { error: "Todos os campos são obrigatórios." } };
  }
  if (senha.length < 6) {
    return { status: 400, dados: { error: "Password deve ter pelo menos 6 caracteres." } };
  }
  if (emailsUsados[email] || nomesUsados[username]) {
    return { status: 400, dados: { error: "Email ou username já está em uso." } };
  }
  if (email === "falha@exemplo.com") {
    return { status: 500, dados: { error: "Erro interno." } };
  }
  emailsUsados[email] = true;
  nomesUsados[username] = true;
  return { status: 201, dados: sessao(email, username) };
}

function listarMissoes(email) {
  return { status: 200, dados: usuarios[email].missoes.map(paraLista) };
}

async function criarMissao(email, corpo) {
  var title = typeof corpo.title === "string" ? corpo.title.trim() : "";
  var category = typeof corpo.category === "string" ? corpo.category.trim() : "";
  if (!title || !category) {
    return { status: 400, dados: { error: "Titulo e categoria sao obrigatorios." } };
  }
  if (title === "falha") {
    return { status: 500, dados: { error: "Erro ao criar missao." } };
  }
  if (title === "lento") {
    await new Promise(function (resolver) {
      setTimeout(resolver, ESPERA_MISSAO_MS);
    });
  }
  var mission = novaMissao(usuarios[email], {
    title: title,
    category: category,
    daily_minimum: typeof corpo.daily_minimum === "string" ? corpo.daily_minimum : null,
    why_it_matters: typeof corpo.why_it_matters === "string" ? corpo.why_it_matters : null,
    proof_mode: typeof corpo.proof_mode === "string" && corpo.proof_mode ? corpo.proof_mode : "self_report",
    mode: "solo",
    status: "active"
  });
  usuarios[email].missoes.unshift(mission);
  return {
    status: 201,
    dados: {
      mission: mission,
      matched: false,
      matchedWith: null,
      matchingEnabled: false,
      message: "Missao solo criada."
    }
  };
}

function inscrever(email, corpo) {
  var sub = corpo && corpo.subscription;
  if (!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
    return { status: 400, dados: { error: "Subscricao invalida." } };
  }
  usuarios[email].avisos.push({
    endpoint: sub.endpoint,
    keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }
  });
  return { status: 200, dados: { success: true, message: "Notificacoes ativadas." } };
}

async function salvarLembrete(email, corpo, cenario) {
  if (cenario === "lembrete-erro") {
    return { status: 500, dados: { error: "Não foi possível salvar o horário." } };
  }
  if (cenario === "lembrete-lento") {
    await new Promise(function (resolver) {
      setTimeout(resolver, ESPERA_MISSAO_MS);
    });
  }
  var hora = typeof corpo.reminder_time === "string" ? corpo.reminder_time : "";
  var fuso = typeof corpo.timezone === "string" ? corpo.timezone.trim() : "";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora) || !fuso) {
    return { status: 400, dados: { error: "Horário inválido." } };
  }
  usuarios[email].lembrete = { reminder_time: hora, timezone: fuso };
  return { status: 200, dados: { reminder_time: hora, timezone: fuso } };
}

var MSG_LIMITE_DIFICIL = "Você já usou os 4 dias difíceis desta missão.";
var MSG_SEGUIDOS_DIFICIL = "Não dá para ter mais de 2 dias difíceis seguidos.";
var MSG_MINIMO_DIFICIL = "Para marcar o dia difícil, confirme que fez o mínimo do contrato e tente de novo.";

function checkinDeResposta(id, email, dia, noteLimpa, querDificil, spec) {
  var checkin = {
    id: 1,
    mission_id: Number(id),
    user_id: usuarios[email].id,
    day_number: dia,
    completed: true,
    note: noteLimpa,
    created_at: new Date().toISOString()
  };
  if (querDificil && spec && spec.respostaColuna) checkin.is_difficult = true;
  else if (querDificil) checkin.difficult = true;
  return checkin;
}

function erroDeDificil(email, id, cenario, spec, dia) {
  var dias = [];
  function por(n) {
    if (!isFinite(n) || n === dia || dias.indexOf(n) !== -1) return;
    dias.push(n);
  }
  if (spec && Array.isArray(spec.dificeis) && !spec.omitirDificeis) {
    spec.dificeis.forEach(function (item) { por(Number(item)); });
  }
  var extra = cenario ? registroDoCenario[email + "|" + cenario] : null;
  if (extra && extra.difficult === true) por(Number(extra.day));
  if (!spec) {
    var lista = usuarios[email].checkins[String(id)] || [];
    lista.forEach(function (item) {
      if (item.difficult === true) por(Number(item.day));
    });
  }
  if (dias.length >= 4) return MSG_LIMITE_DIFICIL;
  if (dias.indexOf(dia - 1) !== -1 && dias.indexOf(dia - 2) !== -1) return MSG_SEGUIDOS_DIFICIL;
  return "";
}

function erroDeProva(proof, note) {
  var text = typeof note === "string" ? note.trim() : "";
  if (proof === "workout_proof" && text.length < 8) {
    return "Esta missao exige uma prova curta antes do check-in.";
  }
  if (proof === "study_note" && text.length < 12) {
    return "Esta missao de estudo exige uma nota curta com o que estudaste hoje.";
  }
  if (proof === "artifact_note" && text.length < 12) {
    return "Esta missao exige um registo curto do que produziste hoje.";
  }
  if (proof === "text_note" && text.length < 8) {
    return "Esta missao exige uma nota curta antes do check-in.";
  }
  return "";
}

async function registrarCheckin(email, corpo, cenario) {
  var id = corpo && corpo.mission_id;
  if (!id) return { status: 400, dados: { error: "mission_id é obrigatório." } };
  var spec = cenario && CENARIOS[cenario] ? CENARIOS[cenario] : null;
  if (spec && spec.erroPost === 500) {
    return { status: 500, dados: { error: "Erro ao registar check-in." } };
  }
  if (spec && spec.erroPost === "prova") {
    return { status: 400, dados: { error: "Esta missao de estudo exige uma nota curta com o que estudaste hoje." } };
  }
  if (spec && spec.erroPost === "seguidos") {
    return { status: 400, dados: { error: MSG_SEGUIDOS_DIFICIL } };
  }
  if (spec && spec.erroPost === "quatro") {
    return { status: 400, dados: { error: MSG_LIMITE_DIFICIL } };
  }
  if (spec && spec.espera) {
    await new Promise(function (resolver) {
      setTimeout(resolver, ESPERA_MISSAO_MS);
    });
  }

  var pacote = cenario ? montarCenario(cenario, usuarios[email]) : null;
  var missao = pacote && pacote.mission ? pacote.mission : acharMissao(email, id);
  if (!missao || String(missao.id) !== String(id)) {
    return { status: 404, dados: { error: "Missão não encontrada." } };
  }
  if (missao.status !== "active") {
    return { status: 400, dados: { error: "Missão não está ativa." } };
  }
  var nota = typeof corpo.note === "string" ? corpo.note : "";
  /* Igual ao servidor: o dia difícil pede minimum_done: true (o toque
     «Fiz o mínimo») e não pede a prova escrita. O check-in comum pede. */
  var pedeDificil = corpo && corpo.difficult === true;
  if (pedeDificil && corpo.minimum_done !== true) {
    return { status: 400, dados: { error: MSG_MINIMO_DIFICIL } };
  }
  var crise = !!(spec && spec.crisePost);
  /* Como no servidor: com crise, a prova escrita não é exigida. */
  var prova = (pedeDificil || crise) ? null : erroDeProva(missao.proof_mode, nota);
  if (prova) return { status: 400, dados: { error: prova } };
  var dia = numeroDoDia(missao.started_at);
  if (dia > missao.duration_days) {
    return { status: 400, dados: { error: "A missão já terminou." } };
  }
  var querDificil = corpo && corpo.difficult === true && !(spec && spec.ignoraDifficult);
  if (querDificil) {
    var bloqueio = erroDeDificil(email, id, cenario, spec, dia);
    if (bloqueio) return { status: 400, dados: { error: bloqueio } };
  }

  var already = false;
  if (spec && spec.postJaFeito) already = true;
  else if (pacote && pacote.streak && pacote.streak.today_done) already = true;
  else {
    var lista = usuarios[email].checkins[String(id)] || [];
    already = lista.some(function (item) {
      return Number(item.day) === dia && item.completed === true;
    });
  }

  /* Como no servidor: com crise, a nota não é guardada. */
  var noteLimpa = !crise && nota.trim() ? nota.trim() : null;
  if (!pacote) {
    if (!usuarios[email].checkins[String(id)]) usuarios[email].checkins[String(id)] = [];
    var guardados = usuarios[email].checkins[String(id)];
    var achei = false;
    guardados.forEach(function (item) {
      if (Number(item.day) === dia) {
        item.completed = true;
        item.note = noteLimpa;
        if (querDificil) item.difficult = true;
        achei = true;
      }
    });
    if (!achei) guardados.push({ day: dia, completed: true, note: noteLimpa, difficult: querDificil });
  }
  if (cenario) {
    registroDoCenario[email + "|" + cenario] = { day: dia, note: noteLimpa, difficult: querDificil };
  }

  var resposta = {
    checkin: checkinDeResposta(id, email, dia, noteLimpa, querDificil, spec),
    day: dia,
    already_done: already,
    message: already ? ("Dia " + dia + " já estava registado!") : ("Dia " + dia + " registado! 🔥")
  };
  if (crise) {
    resposta.crisis = true;
    resposta.crisis_level = "alto";
  }
  return { status: 201, dados: resposta };
}

function contarFeitos(checkins) {
  var n = 0;
  (checkins || []).forEach(function (item) {
    if (item && item.completed === true) n += 1;
  });
  return n;
}

function grupoDoProgresso(progresso, id) {
  if (!progresso || !progresso.progress || id == null) return null;
  return progresso.progress[String(id)] || null;
}

function diasDoGrupo(progresso, id) {
  var grupo = grupoDoProgresso(progresso, id);
  if (!grupo) return 0;
  return contarFeitos(grupo.checkins);
}

function sequenciaAtual(checkins, dia) {
  var feitos = {};
  (checkins || []).forEach(function (item) {
    if (item && item.completed === true) feitos[item.day] = true;
  });
  var streak = 0;
  var d;
  for (d = dia; d >= 1; d--) {
    if (feitos[d]) streak += 1;
    else break;
  }
  return streak;
}

/* A mesma forma da rota de verdade. A chave null vira a string "null". */
function corpoDoPlacar(missao, progresso, email) {
  var usuario = usuarios[email];
  var diasDono = diasDoGrupo(progresso, missao.user_id);
  var diasPar = missao.partner_id ? diasDoGrupo(progresso, missao.partner_id) : 0;
  var scores = {};
  scores[missao.user_name == null ? "null" : String(missao.user_name)] = diasDono;
  scores[missao.partner_name == null ? "null" : String(missao.partner_name)] = diasPar;
  var meus = grupoDoProgresso(progresso, usuario.id);
  var leader = "Empate!";
  if (diasDono > diasPar) leader = missao.user_name;
  else if (diasPar > diasDono) leader = missao.partner_name;
  return {
    mission_id: missao.id,
    mode: missao.mode,
    scores: scores,
    leader: leader,
    my_streak: sequenciaAtual(meus && meus.checkins, numeroDoDia(missao.started_at))
  };
}

function abandonarMissaoMock(email, id, cenario) {
  var pacote = cenario ? montarCenario(cenario, usuarios[email]) : null;
  var missao = null;
  if (pacote && pacote.mission && String(pacote.mission.id) === String(id)) missao = pacote.mission;
  else if (!pacote || pacote.vazio || pacote.erro) missao = acharMissao(email, id);
  if (pacote && pacote.mission && String(pacote.mission.id) !== String(id)) missao = null;
  if (!missao || String(missao.id) !== String(id) || missao.status !== "active") {
    return { status: 404, dados: { error: "Missao ativa nao encontrada." } };
  }
  var usuario = usuarios[email];
  var temPar = missao.partner_id && missao.mode !== "solo";
  if (!temPar) {
    if (missao.user_id !== usuario.id) {
      return { status: 403, dados: { error: "Nao autorizado para encerrar esta missao." } };
    }
    missao.status = "abandoned";
    missao.ends_at = new Date().toISOString();
    return { status: 200, dados: { success: true, message: "Missao solo encerrada." } };
  }
  if (missao.partner_id === usuario.id) {
    missao.partner_id = null;
    missao.partner_name = null;
    missao.mode = "solo";
  } else if (missao.user_id === usuario.id) {
    missao.user_id = missao.partner_id;
    missao.user_name = missao.partner_name;
    missao.partner_id = null;
    missao.partner_name = null;
    missao.mode = "solo";
  } else {
    return { status: 403, dados: { error: "Nao autorizado para encerrar esta missao." } };
  }
  return {
    status: 200,
    dados: { success: true, message: "Saíste da missão. A outra pessoa continua em solo." }
  };
}

function estenderMissao(email, id, corpo, cenario) {
  if (!corpo || Number(corpo.days) !== 36) {
    return { status: 400, dados: { error: "Dias inválidos." } };
  }
  if (cenario === "extend-erro") {
    return { status: 500, dados: { error: "Não foi possível abrir os próximos 36 dias." } };
  }
  var spec = cenario && CENARIOS[cenario] ? CENARIOS[cenario] : null;
  var pacote = spec ? montarCenario(cenario, usuarios[email]) : null;
  var missao = pacote && pacote.mission ? pacote.mission : acharMissao(email, id);
  if (!missao || String(missao.id) !== String(id)) {
    return { status: 404, dados: { error: "Missão não encontrada." } };
  }
  if (!pacote) {
    missao.duration_days = Number(missao.duration_days) + 36;
    var inicioMs = new Date(missao.started_at).getTime();
    if (!isNaN(inicioMs)) {
      missao.ends_at = new Date(inicioMs + missao.duration_days * MS_DIA).toISOString();
    }
    if (missao.status === "completed") missao.status = "active";
    return { status: 200, dados: { mission: missao, days: 36 } };
  }
  extensoes[email + "|" + cenario] = (extensoes[email + "|" + cenario] || 0) + 36;
  var deNovo = montarCenario(cenario, usuarios[email]);
  return { status: 200, dados: { mission: deNovo.mission, days: 36 } };
}

function negar(acesso) {
  return { status: acesso.status, dados: acesso.dados };
}

function responderHoje(req, res, email) {
  var caminho = req.url.split("?")[0];
  var cenario = cenarioDe(req, email);
  var pacote = cenario ? montarCenario(cenario, usuarios[email]) : null;

  if (caminho === "/api/missions") {
    if (pacote && pacote.erro) {
      enviar(res, 500, { error: "Erro ao listar missoes." });
      return true;
    }
    if (pacote && pacote.vazio) {
      enviar(res, 200, []);
      return true;
    }
    if (pacote) {
      enviar(res, 200, [paraLista(pacote.mission)]);
      return true;
    }
    var lista = listarMissoes(email);
    enviar(res, lista.status, lista.dados);
    return true;
  }

  var missao = caminho.match(/^\/api\/missions\/(\d+)$/);
  if (missao) {
    if (pacote && pacote.erro) {
      enviar(res, 500, { error: "Erro ao obter missao." });
      return true;
    }
    if (pacote && pacote.vazio) {
      enviar(res, 404, { error: "Missao nao encontrada." });
      return true;
    }
    if (pacote) {
      if (String(pacote.mission.id) !== missao[1]) {
        enviar(res, 404, { error: "Missao nao encontrada." });
        return true;
      }
      enviar(res, 200, pacote.mission);
      return true;
    }
    var achada = acharMissao(email, missao[1]);
    if (!achada) {
      enviar(res, 404, { error: "Missao nao encontrada." });
      return true;
    }
    enviar(res, 200, achada);
    return true;
  }

  var sequencia = caminho.match(/^\/api\/checkins\/(\d+)\/streak$/);
  if (sequencia) {
    if (pacote && pacote.erro) {
      enviar(res, 500, { error: "Erro ao calcular sequência." });
      return true;
    }
    if (pacote && !pacote.vazio) {
      if (String(pacote.mission.id) !== sequencia[1]) {
        enviar(res, 404, { error: "Missão não encontrada." });
        return true;
      }
      enviar(res, 200, pacote.streak);
      return true;
    }
    var missaoSeq = acharMissao(email, sequencia[1]);
    if (!missaoSeq) {
      enviar(res, 404, { error: "Missão não encontrada." });
      return true;
    }
    var feitos = new Set();
    var dificeisGuardados = [];
    (usuarios[email].checkins[sequencia[1]] || []).forEach(function (item) {
      if (item.completed === true) feitos.add(Number(item.day));
      if (item.difficult === true) dificeisGuardados.push(Number(item.day));
    });
    var extraSeq = null;
    if (dificeisGuardados.length) {
      extraSeq = {
        dificeis: dificeisGuardados,
        restantes: Math.max(0, 4 - dificeisGuardados.length)
      };
    }
    enviar(res, 200, sequenciaDe(feitos, numeroDoDia(missaoSeq.started_at), extraSeq));
    return true;
  }

  var placar = caminho.match(/^\/api\/checkins\/(\d+)\/score$/);
  if (placar) {
    if (pacote && pacote.erro) {
      enviar(res, 500, { error: "Erro ao obter placar." });
      return true;
    }
    var missaoPlacar = pacote && pacote.mission ? pacote.mission : acharMissao(email, placar[1]);
    if (!missaoPlacar || String(missaoPlacar.id) !== placar[1]) {
      enviar(res, 404, { error: "Missão não encontrada." });
      return true;
    }
    var progressoPlacar = pacote && pacote.progress ? pacote.progress : progressoGuardado(email, placar[1]);
    enviar(res, 200, corpoDoPlacar(missaoPlacar, progressoPlacar, email));
    return true;
  }

  var progresso = caminho.match(/^\/api\/checkins\/(\d+)$/);
  if (progresso) {
    if (pacote && pacote.erro) {
      enviar(res, 500, { error: "Erro ao obter progresso." });
      return true;
    }
    if (pacote && !pacote.vazio) {
      if (String(pacote.mission.id) !== progresso[1]) {
        enviar(res, 404, { error: "Missão não encontrada." });
        return true;
      }
      enviar(res, 200, pacote.progress);
      return true;
    }
    if (!acharMissao(email, progresso[1])) {
      enviar(res, 404, { error: "Missão não encontrada." });
      return true;
    }
    enviar(res, 200, progressoGuardado(email, progresso[1]));
    return true;
  }

  return false;
}

garantirUsuario("com-missao@exemplo.com", "pessoa");
usuarios["com-missao@exemplo.com"].missoes.push(novaMissao(usuarios["com-missao@exemplo.com"], {
  id: 1,
  title: "Ler uma página por dia",
  category: "aprendizagem",
  daily_minimum: "Uma página",
  why_it_matters: "Quero ler sem traduzir",
  proof_mode: "study_note",
  mode: "solo",
  status: "active"
}));

var servidor = http.createServer(function (req, res) {
  if (req.method === "OPTIONS") {
    enviar(res, 204, {});
    return;
  }

  var url = req.url.split("?")[0];
  if (req.method === "GET" && url === "/api/notifications/vapid-key") {
    enviar(res, 200, { publicKey: CHAVE_PUBLICA });
    return;
  }
  if (req.method === "GET" && (url === "/api/missions" || url.indexOf("/api/missions/") === 0 || url.indexOf("/api/checkins/") === 0)) {
    var acessoLista = autorizar(req);
    if (acessoLista.status !== 200) {
      enviar(res, acessoLista.status, acessoLista.dados);
      return;
    }
    if (responderHoje(req, res, acessoLista.email)) return;
    enviar(res, 404, { error: "Não encontrado." });
    return;
  }
  if (req.method !== "POST" && req.method !== "PUT") {
    enviar(res, 404, { error: "Não encontrado." });
    return;
  }

  lerCorpo(req).then(function (corpo) {
    if (url === "/api/users/login" && req.method === "POST") return login(corpo);
    if (url === "/api/users/register" && req.method === "POST") return cadastro(corpo);

    var acesso = autorizar(req);
    if (url === "/api/missions" && req.method === "POST") {
      if (acesso.status !== 200) return negar(acesso);
      return criarMissao(acesso.email, corpo);
    }
    var abandono = url.match(/^\/api\/missions\/(\d+)\/abandon$/);
    if (abandono && req.method === "POST") {
      if (acesso.status !== 200) return negar(acesso);
      return abandonarMissaoMock(acesso.email, abandono[1], cenarioDe(req, acesso.email));
    }
    if (url === "/api/checkins" && req.method === "POST") {
      if (acesso.status !== 200) return negar(acesso);
      return registrarCheckin(acesso.email, corpo, cenarioDe(req, acesso.email));
    }
    if (url === "/api/notifications/subscribe" && req.method === "POST") {
      if (acesso.status !== 200) return negar(acesso);
      return inscrever(acesso.email, corpo);
    }
    if (url === "/api/users/me/reminder" && req.method === "PUT") {
      if (!pedidoDeDesenvolvimento(req)) {
        return { status: 404, dados: { error: "Não encontrado." } };
      }
      if (acesso.status !== 200) return negar(acesso);
      return salvarLembrete(acesso.email, corpo, nomeDoCenario(req));
    }
    var estender = url.match(/^\/api\/missions\/(\d+)\/extend$/);
    if (estender && req.method === "POST") {
      if (!pedidoDeDesenvolvimento(req)) {
        return { status: 404, dados: { error: "Não encontrado." } };
      }
      if (acesso.status !== 200) return negar(acesso);
      return estenderMissao(acesso.email, estender[1], corpo, cenarioDe(req, acesso.email));
    }
    return { status: 404, dados: { error: "Não encontrado." } };
  }).then(function (resultado) {
    enviar(res, resultado.status, resultado.dados);
  }).catch(function () {
    enviar(res, 400, { error: "Todos os campos são obrigatórios." });
  });
});

servidor.listen(PORTA, "127.0.0.1", function () {
  console.log("Mock do Nexus em http://127.0.0.1:" + PORTA);
  console.log("Só para teste local. Feche com Ctrl+C.");
});
