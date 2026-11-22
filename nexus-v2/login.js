/* Tela 00. Fala com a API só por meio do api.js.
   A senha não é guardada neste aparelho. */

var CHAVE_TOKEN = "nexus_v2_token";
var CHAVE_USUARIO = "nexus_v2_user";
var TEXTO_SEM_REDE = "Sem internet. Assim que a conexão voltar, tente de novo.";

function problemaDoEmail(valor) {
  var texto = valor.trim();
  if (!texto) return "Escreva seu e-mail.";
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
    traco.setAttribute("d", "M12 20h.01M8.5 16.4a5 5 0 0 1 7 0M5 12.6a10 10 0 0 1 4.2-2.2M19 12.6a10 10 0 0 0-2-.9M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8a15 15 0 0 0-11.2-3.7M3 3l18 18");
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
  var rotulo = botao.querySelector(".btn-rotulo");
  var spinner = botao.querySelector(".spinner");
  botao.disabled = ligado;
  botao.setAttribute("aria-busy", ligado ? "true" : "false");
  rotulo.textContent = ligado ? botao.getAttribute("data-carregando") : botao.getAttribute("data-texto");
  if (spinner) spinner.hidden = !ligado;
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

function temMissaoAtiva(dados) {
  var lista = Array.isArray(dados) ? dados : [];
  for (var i = 0; i < lista.length; i++) {
    var status = lista[i] && typeof lista[i].status === "string" ? lista[i].status : "";
    if (status === "active" || status === "waiting") return true;
  }
  return false;
}

/* Sem missão ativa, o começo. Com missão, o Hoje. */
async function seguirDepoisDaSessao(alerta) {
  var lista = await NexusApi.listarMissoes();
  if (!lista.ok) {
    if (lista.semRede) mostrarAviso(alerta, "rede", TEXTO_SEM_REDE);
    else mostrarAviso(alerta, "falha", "Não foi possível ver sua missão agora. Tente de novo em instantes.");
    return false;
  }
  var destino = temMissaoAtiva(lista.dados) ? "hoje.html" : "onboarding.html";
  location.href = destino + location.search;
  return true;
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
  if (modo === "cadastro" && (erro === TEXTOS_IDADE().DO_SERVIDOR.dataFalta || erro === TEXTOS_IDADE().DO_SERVIDOR.dataInvalida)) {
    return { onde: "data", tipo: "falha", texto: TEXTOS_IDADE().TEXTOS.dataErro };
  }
  if (modo === "cadastro" && resultado.status === 503) {
    return { onde: "topo", tipo: "falha", texto: TEXTOS_IDADE().TEXTOS.cadastroIndisponivel };
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
  var menor = document.getElementById("vista-menor");
  var eCadastro = qual === "cadastro";
  var eMenor = qual === "menor";
  entrar.hidden = eCadastro || eMenor;
  cadastro.hidden = !eCadastro;
  menor.hidden = !eMenor;
  if (eMenor) document.title = TEXTOS_IDADE().TEXTOS.menorTitulo + " — Nexus";
  else document.title = eCadastro ? "Criar conta — Nexus" : "Entrar — Nexus";
  if (moverFoco) {
    document.getElementById(eMenor ? "titulo-menor" : (eCadastro ? "titulo-cadastro" : "titulo-entrar")).focus();
  }
}

/* O texto da idade vem de comunidade-textos.js (num lugar só). */
function TEXTOS_IDADE() {
  return window.NexusComunidade;
}

var CAMPOS_DATA = ["cadastro-dia", "cadastro-mes", "cadastro-ano"];

function camposDaData() {
  return CAMPOS_DATA.map(function (id) {
    return document.getElementById(id);
  });
}

/* Erro de forma da data: borda e aria-invalid nos três campos, frase uma vez só. */
function definirErroDaData(texto) {
  var aviso = document.getElementById("cadastro-data-erro");
  camposDaData().forEach(function (campo) {
    if (texto) campo.setAttribute("aria-invalid", "true");
    else campo.removeAttribute("aria-invalid");
  });
  aviso.hidden = !texto;
  aviso.textContent = texto || "";
}

/* Primeiro campo da data que está vazio ou incompleto (para o foco). */
function campoDaDataParaCorrigir() {
  var campos = camposDaData();
  for (var i = 0; i < campos.length; i++) {
    var valor = campos[i].value.trim();
    if (!valor || valor.length < (i === 2 ? 4 : 1) || /\D/.test(valor)) return campos[i];
  }
  return campos[0];
}

/* Só números; ao completar o campo, o foco passa sozinho ao próximo. */
function ligarCamposDaData() {
  camposDaData().forEach(function (campo) {
    campo.addEventListener("input", function () {
      var limpo = campo.value.replace(/\D/g, "").slice(0, Number(campo.getAttribute("maxlength")) || 4);
      if (limpo !== campo.value) campo.value = limpo;
      if (campo.getAttribute("aria-invalid") === "true") definirErroDaData("");
      var proximo = campo.getAttribute("data-proximo");
      if (proximo && limpo.length === Number(campo.getAttribute("maxlength"))) {
        document.getElementById(proximo).focus();
      }
    });
  });
}

/* Nada do cadastro fica na tela depois do 403: campos limpos, senha apagada. */
function limparCadastro(form) {
  form.querySelectorAll("input").forEach(function (campo) {
    campo.value = "";
  });
  limparErros(form);
  limparSenhas(form);
}

function aoTrocarDeVista() {
  limparErros(document.getElementById("form-entrar"));
  limparErros(document.getElementById("form-cadastro"));
  limparSenhas(document.getElementById("form-entrar"));
  limparSenhas(document.getElementById("form-cadastro"));
  definirErroDaData("");
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
  var textoSenha = senha.value.length === 0 ? "Escreva sua senha." : "";
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
  var indo = false;
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
    if (!guardarSessao(resultado.dados)) {
      mostrarAviso(alerta, "falha", "Não foi possível guardar a sessão neste aparelho.");
      return;
    }
    limparSenhas(form);
    indo = await seguirDepoisDaSessao(alerta);
  } finally {
    if (!indo) {
      form.dataset.ocupado = "";
      definirCarregando(botao, false);
    }
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
  if (senha.value.length === 0) textoSenha = "Escreva sua senha.";
  else if (senha.value.length < 6) textoSenha = "A senha precisa ter pelo menos 6 caracteres.";
  var textoConfirma = "";
  if (!textoSenha && senha.value !== confirma.value) textoConfirma = "As duas senhas não são iguais.";
  var partes = camposDaData();
  var nascimento = TEXTOS_IDADE().dataDeNascimento(partes[0].value, partes[1].value, partes[2].value);
  var textoData = nascimento ? "" : TEXTOS_IDADE().TEXTOS.dataErro;

  definirErro(nome, erroNome, textoNome);
  definirErro(email, erroEmail, textoEmail);
  definirErro(senha, erroSenha, textoSenha);
  definirErro(confirma, erroConfirma, textoConfirma);
  definirErroDaData(textoData);
  if (textoNome || textoEmail || textoSenha || textoConfirma || textoData) {
    focarPrimeiro([
      { campo: nome, texto: textoNome },
      { campo: email, texto: textoEmail },
      { campo: senha, texto: textoSenha },
      { campo: confirma, texto: textoConfirma },
      { campo: campoDaDataParaCorrigir(), texto: textoData }
    ]);
    return;
  }
  if (navigator.onLine === false) {
    mostrarAviso(alerta, "rede", TEXTO_SEM_REDE);
    return;
  }

  form.dataset.ocupado = "sim";
  definirCarregando(botao, true);
  var indo = false;
  try {
    var resultado = await NexusApi.cadastrar({
      username: nome.value.trim(),
      email: email.value.trim(),
      password: senha.value,
      birth_date: nascimento
    });
    if (!resultado.ok) {
      /* 403 do servidor: menor de 18. Nada foi guardado; a tela troca por inteiro. */
      if (resultado.status === 403 && resultado.dados && resultado.dados.under_age === true) {
        limparCadastro(form);
        mostrarVista("menor", true);
        return;
      }
      var aviso = mensagemDaApi("cadastro", resultado);
      if (aviso.onde === "data") {
        definirErroDaData(aviso.texto);
        partes[0].focus();
      } else if (aviso.onde === "senha") {
        definirErro(senha, erroSenha, aviso.texto);
        senha.focus();
      } else {
        mostrarAviso(alerta, aviso.tipo, aviso.texto);
      }
      return;
    }
    if (!guardarSessao(resultado.dados)) {
      mostrarAviso(alerta, "falha", "Não foi possível guardar a sessão neste aparelho.");
      return;
    }
    limparSenhas(form);
    indo = await seguirDepoisDaSessao(alerta);
  } finally {
    if (!indo) {
      form.dataset.ocupado = "";
      definirCarregando(botao, false);
    }
  }
}

function atualizarBarra() {
  var tema = document.documentElement.getAttribute("data-theme");
  var escuro = tema === "dark" || (tema !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  var meta = document.getElementById("cor-da-barra");
  if (meta) meta.setAttribute("content", escuro ? "#161411" : "#0B5F52");
}

function iniciar() {
  TEXTOS_IDADE().aplicar(document);
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
  ligarCamposDaData();

  mostrarVista(location.hash === "#criar-conta" ? "cadastro" : "entrar", false);
  window.addEventListener("hashchange", aoTrocarDeVista);

  atualizarBarra();
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", atualizarBarra);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
}

iniciar();
