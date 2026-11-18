/* Tela 00. Fala com a API só por meio do api.js.
   A senha não é guardada neste aparelho. */

var CHAVE_TOKEN = "nexus_v2_token";
var CHAVE_USUARIO = "nexus_v2_user";
var TEXTO_SEM_REDE = "Sem ligação. Assim que a rede voltar, tente de novo.";

function problemaDoEmail(valor) {
  var texto = valor.trim();
  if (!texto) return "Escreva o seu e-mail.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto)) return "Esse e-mail não parece completo.";
  return "";
}

function iconeAviso(tipo) {
  var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "icone");
  var traco = document.createElementNS("http://www.w3.org/2000/svg", "path");
  traco.setAttribute("fill", "none");
  traco.setAttribute("stroke", "currentColor");
  traco.setAttribute("stroke-width", "2");
  traco.setAttribute("stroke-linecap", "round");
  traco.setAttribute("stroke-linejoin", "round");
  if (tipo === "ok") {
    traco.setAttribute("d", "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.5l2.6 2.6L16.5 9");
  } else if (tipo === "rede") {
    traco.setAttribute("d", "M3 8.5c5-4.5 13-4.5 18 0M6.5 12.5c3-2.6 8-2.6 11 0M10 16.5c1.2-1 2.8-1 4 0M12 19.5h.01");
  } else {
    traco.setAttribute("d", "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v5M12 16.5h.01");
  }
  svg.appendChild(traco);
  return svg;
}

function mostrarAviso(el, tipo, texto) {
  var paragrafo = document.createElement("p");
  paragrafo.textContent = texto;
  el.className = "alerta alerta-" + tipo;
  el.replaceChildren(iconeAviso(tipo), paragrafo);
  el.hidden = false;
}

function esconderAviso(el) {
  if (!el) return;
  el.hidden = true;
  el.replaceChildren();
}

function definirErro(campo, aviso, texto) {
  if (texto) {
    aviso.hidden = false;
    aviso.textContent = texto;
    campo.setAttribute("aria-invalid", "true");
    return;
  }
  aviso.hidden = true;
  aviso.textContent = "";
  campo.removeAttribute("aria-invalid");
}

function limparErros(form) {
  form.querySelectorAll("input").forEach(function (campo) {
    campo.removeAttribute("aria-invalid");
  });
  form.querySelectorAll(".erro-campo").forEach(function (aviso) {
    aviso.hidden = true;
    aviso.textContent = "";
  });
  esconderAviso(form.querySelector(".alerta"));
}

function limparSenhas(form) {
  form.querySelectorAll("[data-senha]").forEach(function (campo) {
    campo.value = "";
    campo.type = "password";
  });
  form.querySelectorAll("[aria-pressed]").forEach(function (botao) {
    botao.setAttribute("aria-pressed", "false");
    botao.textContent = "Mostrar senha";
  });
}

function definirCarregando(botao, ligado) {
  botao.disabled = ligado;
  botao.setAttribute("aria-busy", ligado ? "true" : "false");
  botao.textContent = ligado ? botao.getAttribute("data-carregando") : botao.getAttribute("data-texto");
}

function ligarOlho(botao, campo) {
  botao.addEventListener("click", function () {
    var mostrar = campo.type === "password";
    campo.type = mostrar ? "text" : "password";
    botao.setAttribute("aria-pressed", mostrar ? "true" : "false");
    botao.textContent = mostrar ? "Ocultar senha" : "Mostrar senha";
  });
}

function limparAoDigitar(campo, aviso) {
  campo.addEventListener("input", function () {
    if (campo.getAttribute("aria-invalid") === "true") definirErro(campo, aviso, "");
  });
}

function focarPrimeiro(lista) {
  for (var i = 0; i < lista.length; i++) {
    if (lista[i].texto) {
      lista[i].campo.focus();
      return;
    }
  }
}

function guardarSessao(dados) {
  if (!dados || typeof dados.token !== "string" || !dados.token) return false;
  var usuario = dados.user || {};
  var seguro = {};
  if (typeof usuario.username === "string") seguro.username = usuario.username;
  if (typeof usuario.email === "string") seguro.email = usuario.email;
  try {
    localStorage.setItem(CHAVE_TOKEN, dados.token);
    localStorage.setItem(CHAVE_USUARIO, JSON.stringify(seguro));
    return true;
  } catch (erro) {
    return false;
  }
}

function mensagemDaApi(modo, resultado) {
  if (resultado.semRede) {
    return { onde: "topo", tipo: "rede", texto: TEXTO_SEM_REDE };
  }
  var erro = resultado.erro || "";
  if (modo === "entrar" && (resultado.status === 401 || erro === "Credenciais inválidas.")) {
    return {
      onde: "topo",
      tipo: "falha",
      texto: "E-mail ou senha não conferem. Tente de novo."
    };
  }
  if (erro === "Email ou username já está em uso.") {
    return {
      onde: "topo",
      tipo: "falha",
      texto: "Esse e-mail ou nome já está em uso. Se for você, tente entrar."
    };
  }
  if (erro === "Password deve ter pelo menos 6 caracteres.") {
    return {
      onde: "senha",
      tipo: "falha",
      texto: "A senha precisa ter pelo menos 6 caracteres."
    };
  }
  if (modo === "entrar") {
    return {
      onde: "topo",
      tipo: "falha",
      texto: "Não foi possível entrar agora. Tente de novo em instantes."
    };
  }
  return {
    onde: "topo",
    tipo: "falha",
    texto: "Não foi possível criar a conta agora. Tente de novo em instantes."
  };
}

function mostrarVista(qual, moverFoco) {
  var entrar = document.getElementById("vista-entrar");
  var cadastro = document.getElementById("vista-cadastro");
  var eCadastro = qual === "cadastro";
  entrar.hidden = eCadastro;
  cadastro.hidden = !eCadastro;
  document.title = eCadastro ? "Criar conta — Nexus" : "Entrar — Nexus";
  if (moverFoco) {
    document.getElementById(eCadastro ? "titulo-cadastro" : "titulo-entrar").focus();
  }
}

function aoTrocarDeVista() {
  limparErros(document.getElementById("form-entrar"));
  limparErros(document.getElementById("form-cadastro"));
  limparSenhas(document.getElementById("form-entrar"));
  limparSenhas(document.getElementById("form-cadastro"));
  mostrarVista(location.hash === "#criar-conta" ? "cadastro" : "entrar", true);
}

async function enviarEntrar(form) {
  if (form.dataset.ocupado === "sim") return;
  var email = document.getElementById("entrar-email");
  var senha = document.getElementById("entrar-senha");
  var erroEmail = document.getElementById("entrar-email-erro");
  var erroSenha = document.getElementById("entrar-senha-erro");
  var alerta = document.getElementById("alerta-entrar");
  var botao = document.getElementById("btn-entrar");

  limparErros(form);
  var textoEmail = problemaDoEmail(email.value);
  var textoSenha = senha.value.length === 0 ? "Escreva a sua senha." : "";
  definirErro(email, erroEmail, textoEmail);
  definirErro(senha, erroSenha, textoSenha);
  if (textoEmail || textoSenha) {
    focarPrimeiro([
      { campo: email, texto: textoEmail },
      { campo: senha, texto: textoSenha }
    ]);
    return;
  }
  if (navigator.onLine === false) {
    mostrarAviso(alerta, "rede", TEXTO_SEM_REDE);
    return;
  }

  form.dataset.ocupado = "sim";
  definirCarregando(botao, true);
  try {
    var resultado = await NexusApi.entrar(email.value.trim(), senha.value);
    if (!resultado.ok) {
      var aviso = mensagemDaApi("entrar", resultado);
      if (aviso.onde === "senha") {
        definirErro(senha, erroSenha, aviso.texto);
        senha.focus();
      } else {
        mostrarAviso(alerta, aviso.tipo, aviso.texto);
      }
      return;
    }
    guardarSessao(resultado.dados);
    limparSenhas(form);
    /* As telas de onboarding e Hoje ainda não existem.
       Quando existirem: sem missão ativa, ir ao onboarding; com missão, ir a Hoje. */
    mostrarAviso(alerta, "ok", "Você entrou. As próximas telas ainda estão sendo feitas.");
  } finally {
    form.dataset.ocupado = "";
    definirCarregando(botao, false);
  }
}

async function enviarCadastro(form) {
  if (form.dataset.ocupado === "sim") return;
  var nome = document.getElementById("cadastro-nome");
  var email = document.getElementById("cadastro-email");
  var senha = document.getElementById("cadastro-senha");
  var confirma = document.getElementById("cadastro-confirma");
  var erroNome = document.getElementById("cadastro-nome-erro");
  var erroEmail = document.getElementById("cadastro-email-erro");
  var erroSenha = document.getElementById("cadastro-senha-erro");
  var erroConfirma = document.getElementById("cadastro-confirma-erro");
  var alerta = document.getElementById("alerta-cadastro");
  var botao = document.getElementById("btn-criar");

  limparErros(form);
  var textoNome = nome.value.trim() ? "" : "Diga como você quer ser chamado.";
  var textoEmail = problemaDoEmail(email.value);
  var textoSenha = "";
  if (senha.value.length === 0) textoSenha = "Escreva a sua senha.";
  else if (senha.value.length < 6) textoSenha = "A senha precisa ter pelo menos 6 caracteres.";
  var textoConfirma = "";
  if (!textoSenha && senha.value !== confirma.value) textoConfirma = "As duas senhas não são iguais.";

  definirErro(nome, erroNome, textoNome);
  definirErro(email, erroEmail, textoEmail);
  definirErro(senha, erroSenha, textoSenha);
  definirErro(confirma, erroConfirma, textoConfirma);
  if (textoNome || textoEmail || textoSenha || textoConfirma) {
    focarPrimeiro([
      { campo: nome, texto: textoNome },
      { campo: email, texto: textoEmail },
      { campo: senha, texto: textoSenha },
      { campo: confirma, texto: textoConfirma }
    ]);
    return;
  }
  if (navigator.onLine === false) {
    mostrarAviso(alerta, "rede", TEXTO_SEM_REDE);
    return;
  }

  form.dataset.ocupado = "sim";
  definirCarregando(botao, true);
  try {
    var resultado = await NexusApi.cadastrar({
      username: nome.value.trim(),
      email: email.value.trim(),
      password: senha.value
    });
    if (!resultado.ok) {
      var aviso = mensagemDaApi("cadastro", resultado);
      if (aviso.onde === "senha") {
        definirErro(senha, erroSenha, aviso.texto);
        senha.focus();
      } else {
        mostrarAviso(alerta, aviso.tipo, aviso.texto);
      }
      return;
    }
    guardarSessao(resultado.dados);
    limparSenhas(form);
    mostrarAviso(alerta, "ok", "Conta criada. As próximas telas ainda estão sendo feitas.");
  } finally {
    form.dataset.ocupado = "";
    definirCarregando(botao, false);
  }
}

function atualizarBarra() {
  var tema = document.documentElement.getAttribute("data-theme");
  var escuro = tema === "dark" || (tema !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  var meta = document.getElementById("cor-da-barra");
  if (meta) meta.setAttribute("content", escuro ? "#161411" : "#0B5F52");
}

function iniciar() {
  var formEntrar = document.getElementById("form-entrar");
  var formCadastro = document.getElementById("form-cadastro");

  formEntrar.addEventListener("submit", function (evento) {
    evento.preventDefault();
    enviarEntrar(formEntrar);
  });
  formCadastro.addEventListener("submit", function (evento) {
    evento.preventDefault();
    enviarCadastro(formCadastro);
  });

  ligarOlho(document.getElementById("entrar-olho"), document.getElementById("entrar-senha"));
  ligarOlho(document.getElementById("cadastro-olho"), document.getElementById("cadastro-senha"));
  ligarOlho(document.getElementById("cadastro-confirma-olho"), document.getElementById("cadastro-confirma"));

  limparAoDigitar(document.getElementById("entrar-email"), document.getElementById("entrar-email-erro"));
  limparAoDigitar(document.getElementById("entrar-senha"), document.getElementById("entrar-senha-erro"));
  limparAoDigitar(document.getElementById("cadastro-nome"), document.getElementById("cadastro-nome-erro"));
  limparAoDigitar(document.getElementById("cadastro-email"), document.getElementById("cadastro-email-erro"));
  limparAoDigitar(document.getElementById("cadastro-senha"), document.getElementById("cadastro-senha-erro"));
  limparAoDigitar(document.getElementById("cadastro-confirma"), document.getElementById("cadastro-confirma-erro"));

  mostrarVista(location.hash === "#criar-conta" ? "cadastro" : "entrar", false);
  window.addEventListener("hashchange", aoTrocarDeVista);

  atualizarBarra();
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", atualizarBarra);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
}

iniciar();
