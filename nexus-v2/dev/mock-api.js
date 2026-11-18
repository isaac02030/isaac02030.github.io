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
     como na rota de verdade.
   Aviso:
   - GET /api/notifications/vapid-key → chave pública
   - POST /api/notifications/subscribe → grava a inscrição na memória
   Lembrete (PUT /api/users/me/reminder):
   - esta rota ainda não existe no servidor de verdade
   - aqui ela guarda { reminder_time, timezone } na memória
   Isto não vale no servidor de verdade. São só atalhos deste arquivo. */

var http = require("http");
var crypto = require("crypto");

var PORTA = 3000;
var ESPERA_LENTA_MS = 4000;
var ESPERA_MISSAO_MS = 8000;
var emailsUsados = { "repetido@exemplo.com": true };
var nomesUsados = { repetido: true };
var usuarios = {};
var proximaMissao = 2;

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
      email: email,
      username: username || "pessoa",
      missoes: [],
      lembrete: null,
      avisos: []
    };
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
  return { status: 200, dados: usuarios[email].missoes.slice() };
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
  var id = proximaMissao;
  proximaMissao += 1;
  var mission = {
    id: id,
    title: title,
    category: category,
    daily_minimum: typeof corpo.daily_minimum === "string" ? corpo.daily_minimum : null,
    why_it_matters: typeof corpo.why_it_matters === "string" ? corpo.why_it_matters : null,
    mode: "solo",
    duration_days: 30,
    proof_mode: typeof corpo.proof_mode === "string" && corpo.proof_mode ? corpo.proof_mode : "self_report",
    status: "active",
    level: "iniciante"
  };
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

function salvarLembrete(email, corpo) {
  var hora = typeof corpo.reminder_time === "string" ? corpo.reminder_time : "";
  var fuso = typeof corpo.timezone === "string" ? corpo.timezone.trim() : "";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora) || !fuso) {
    return { status: 400, dados: { error: "Horário inválido." } };
  }
  usuarios[email].lembrete = { reminder_time: hora, timezone: fuso };
  return { status: 200, dados: { reminder_time: hora, timezone: fuso } };
}

function negar(acesso) {
  return { status: acesso.status, dados: acesso.dados };
}

garantirUsuario("com-missao@exemplo.com", "pessoa");
usuarios["com-missao@exemplo.com"].missoes.push({
  id: 1,
  title: "Ler uma página por dia",
  category: "aprendizagem",
  daily_minimum: "Uma página",
  why_it_matters: "Quero ler sem traduzir",
  mode: "solo",
  duration_days: 30,
  proof_mode: "study_note",
  status: "active",
  level: "iniciante"
});

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
  if (req.method === "GET" && url === "/api/missions") {
    var acessoLista = autorizar(req);
    if (acessoLista.status !== 200) {
      enviar(res, acessoLista.status, acessoLista.dados);
      return;
    }
    var lista = listarMissoes(acessoLista.email);
    enviar(res, lista.status, lista.dados);
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
    if (url === "/api/notifications/subscribe" && req.method === "POST") {
      if (acesso.status !== 200) return negar(acesso);
      return inscrever(acesso.email, corpo);
    }
    if (url === "/api/users/me/reminder" && req.method === "PUT") {
      if (acesso.status !== 200) return negar(acesso);
      return salvarLembrete(acesso.email, corpo);
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
