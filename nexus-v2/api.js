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

async function nexusLerJson(resposta) {
  try {
    return await resposta.json();
  } catch (erro) {
    return {};
  }
}

/* Envia JSON e devolve um resultado simples.
   A senha só viaja neste pedido. Este arquivo não a guarda. */
async function nexusPedir(caminho, corpo) {
  if (!NEXUS_API_URL || navigator.onLine === false) {
    return { ok: false, semRede: true, status: 0, erro: "" };
  }

  var resposta;
  try {
    resposta = await fetch(nexusUrl(caminho), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      cache: "no-store",
      body: JSON.stringify(corpo)
    });
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
  }
};
