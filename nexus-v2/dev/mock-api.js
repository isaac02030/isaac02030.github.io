/* Mock local da API. Só para testar a tela neste computador.
   Não é o servidor do Nexus. Não guarda senha em arquivo.
   Rode na raiz do repositório: node nexus-v2/dev/mock-api.js
   A tela fala com http://localhost:3000 (veja NEXUS_API_URL em api.js).

   Login (POST /api/users/login):
   - senha "errada" → 401 Credenciais inválidas.
   - e-mail falha@exemplo.com → 500
   - e-mail lento@exemplo.com → espera e depois entra
   - qualquer outro e-mail e senha → entra
   Cadastro (POST /api/users/register):
   - senha com menos de 6 caracteres → 400
   - nome "repetido" ou e-mail repetido@exemplo.com → 400 já em uso
   - e-mail falha@exemplo.com → 500
   - o resto cria a conta
   Isto não vale no servidor de verdade. São só atalhos deste arquivo. */

var http = require("http");

var PORTA = 3000;
var ESPERA_LENTA_MS = 4000;
var TOKEN_DE_TESTE = "teste-local";
var emailsUsados = { "repetido@exemplo.com": true };
var nomesUsados = { repetido: true };

function enviar(res, status, dados) {
  var corpo = JSON.stringify(dados);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Length": Buffer.byteLength(corpo)
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

function sessao(email, username) {
  return {
    token: TOKEN_DE_TESTE,
    user: {
      username: username || "pessoa",
      email: email
    }
  };
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

var servidor = http.createServer(function (req, res) {
  if (req.method === "OPTIONS") {
    enviar(res, 204, {});
    return;
  }
  if (req.method !== "POST") {
    enviar(res, 404, { error: "Não encontrado." });
    return;
  }

  lerCorpo(req).then(function (corpo) {
    var url = req.url.split("?")[0];
    if (url === "/api/users/login") return login(corpo);
    if (url === "/api/users/register") return cadastro(corpo);
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
