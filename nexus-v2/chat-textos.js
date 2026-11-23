/* Textos do chat do Duo/Rival (spec da Clara, visual/spec-chat-duo.md, e os
   textos do servidor aprovados nos PRs 32 a 35). Textos iguais aos da
   comunidade («Não foi possível enviar…», «Esta parte ainda não está
   disponível…») ficam só em comunidade-textos.js. A conversa, a Missão, Hoje,
   a tela de ajuda e a área da equipe leem daqui.
   Sem gênero: o app não sabe o gênero do apelido, então bloquear usa a forma
   neutra («esta pessoa»), como a Clara recomendou.
   Também guarda o «já vi até aqui» de cada conversa NESTE aparelho (para
   «2 novas» e «Mensagem nova de…»). Isso nunca vai ao servidor: não é «visto». */
(function () {
  var LIMITE = 280;

  var TEXTOS = {
    /* Conversa */
    titulo: "Conversa com {nome}",
    tituloSemNome: "Conversa",
    missao: "Missão: {titulo}",
    voltar: "Voltar",
    abrindo: "Abrindo a conversa…",
    vazio: "Ainda não há mensagens. Escreva a primeira.",
    erroAbrir: "Não foi possível abrir a conversa. Tente de novo.",
    semRedeAbrir: "Sem internet. A conversa não abriu.",
    semPar: "A conversa só funciona enquanto o Duo ou o Rival estiver ativo.",
    voltarMissao: "Voltar à missão",
    tentarDeNovo: "Tentar de novo",
    hoje: "Hoje",
    ontem: "Ontem",
    mensagens: "Mensagens",
    irParaNovas: "Ir para as novas",

    /* Campo */
    campoRotulo: "Escreva uma mensagem",
    enviar: "Enviar",
    passou: "A mensagem passou de 280 caracteres.",

    /* Estados do envio (só nas minhas mensagens) */
    enviando: "Enviando…",
    enviada: "Enviada",
    falhaSemRede: "Sem internet. A mensagem não foi enviada.",
    falhaSemAcesso: "Você não está mais nesta conversa.",

    /* Opções de uma mensagem dela */
    opcoes: "Opções da mensagem das {hora}",
    opcoesTitulo: "Opções da mensagem",
    denunciarMensagem: "Denunciar esta mensagem",
    bloquear: "Bloquear esta pessoa",
    cancelar: "Cancelar",

    /* Denúncia (os motivos e os botões vêm de comunidade-textos.js) */
    denunciaRepetida: "Você já denunciou esta mensagem.",

    /* Bloquear */
    bloquearTitulo: "Bloquear esta pessoa?",
    bloquearTexto: "Você não verá mais as mensagens desta pessoa e ela não verá as suas. A missão continua.",
    bloquearTextoSaida: "Você não verá mais as mensagens desta pessoa e ela não verá as suas. Esta missão é da outra pessoa: ao bloquear, você sai dela e fica sem missão.",
    bloquearConfirmar: "Bloquear",
    bloqueando: "Bloqueando…",
    bloqueada: "Pessoa bloqueada.",
    bloquearErro: "Não foi possível bloquear agora. Tente de novo.",
    bloquearSemRede: "Sem internet. O bloqueio não foi feito.",
    bloquearIndisponivel: "O bloqueio ainda não está disponível. Tente de novo mais tarde.",

    /* Missão e Hoje */
    abrirConversa: "Abrir a conversa",
    novas: "{n} novas",
    nova: "1 nova",
    mensagemNova: "Mensagem nova de {nome}.",

    /* Tela de ajuda, quando o envio é barrado */
    criseLinha: "Sua mensagem não foi enviada. Se você está passando por um momento difícil, há quem possa ajudar agora.",
    voltarConversa: "Voltar à conversa",

    /* Área da equipe */
    equipeTitulo: "Mensagens do chat denunciadas",
    equipeVazio: "Nenhuma mensagem do chat foi denunciada.",
    equipeIndisponivel: "As denúncias do chat ainda não estão disponíveis.",
    equipeErro: "Não foi possível carregar as denúncias do chat. Tente de novo."
  };

  /* Erros do servidor aprovados (PRs 33 e 35): a tela mostra a frase dele. */
  var DO_SERVIDOR = [
    "A mensagem passou de 280 caracteres. Encurte um pouco e envie de novo.",
    "A mensagem precisa ser um texto. Escreva de novo e envie.",
    "A conversa só funciona enquanto o Duo ou o Rival estiver ativo.",
    "Você enviou muitas mensagens nesta hora. Espere um pouco e envie de novo.",
    "Você chegou ao limite de mensagens de hoje. Amanhã dá para enviar de novo.",
    "Você já fez 10 denúncias nas últimas 24 horas. Tente de novo amanhã."
  ];

  function preencher(modelo, valores) {
    return modelo.replace(/\{(\w+)\}/g, function (_, chave) {
      return Object.prototype.hasOwnProperty.call(valores, chave) ? String(valores[chave]) : "";
    });
  }

  function erroDoServidor(texto) {
    return DO_SERVIDOR.indexOf(texto) !== -1 ? texto : "";
  }

  /* Caracteres reais (um emoji conta 1), como o servidor. */
  function tamanho(texto) {
    return typeof texto === "string" ? Array.from(texto).length : 0;
  }

  function aplicar(raiz) {
    var lista = (raiz || document).querySelectorAll("[data-texto-chat]");
    for (var i = 0; i < lista.length; i++) {
      var chave = lista[i].getAttribute("data-texto-chat");
      if (Object.prototype.hasOwnProperty.call(TEXTOS, chave)) lista[i].textContent = TEXTOS[chave];
    }
  }

  /* ---------- «Já vi até aqui», só neste aparelho ---------- */
  function chaveVista(missaoId) {
    return "nexus_v2_chat_vista_" + String(missaoId);
  }

  function ultimaVista(missaoId) {
    try {
      var n = Number(localStorage.getItem(chaveVista(missaoId)));
      return isFinite(n) && n > 0 ? n : 0;
    } catch (erro) {
      return 0;
    }
  }

  function marcarVista(missaoId, mensagens) {
    var maior = ultimaVista(missaoId);
    (mensagens || []).forEach(function (m) {
      var id = Number(m && m.id);
      if (isFinite(id) && id > maior) maior = id;
    });
    try {
      localStorage.setItem(chaveVista(missaoId), String(maior));
    } catch (erro) {}
  }

  function meuApelido() {
    try {
      var usuario = JSON.parse(localStorage.getItem("nexus_v2_user") || "null");
      return usuario && typeof usuario.username === "string" ? usuario.username.trim() : "";
    } catch (erro) {
      return "";
    }
  }

  /* Quantas mensagens da outra pessoa chegaram depois da última vista. */
  function contarNovas(missaoId, mensagens) {
    var eu = meuApelido();
    var desde = ultimaVista(missaoId);
    return (mensagens || []).filter(function (m) {
      return m && Number(m.id) > desde && typeof m.sender_name === "string" && m.sender_name !== eu;
    }).length;
  }

  /* Duo (parceiro) ou Rival com a outra pessoa: a conversa existe. */
  function temPar(missao) {
    var modo = String(missao && missao.mode || "").toLowerCase();
    var par = missao && typeof missao.partner_name === "string" ? missao.partner_name.trim() : "";
    var ativa = !missao || !missao.status || missao.status === "active";
    return (modo === "parceiro" || modo === "duo" || modo === "rival") && !!par && ativa;
  }

  /* O apelido da outra pessoa (sou dono ou parceiro). */
  function nomeDoOutro(missao) {
    var eu = meuApelido();
    var dono = missao && typeof missao.user_name === "string" ? missao.user_name.trim() : "";
    var par = missao && typeof missao.partner_name === "string" ? missao.partner_name.trim() : "";
    if (eu && eu === par) return dono;
    return par;
  }

  /* No Duo da mesma missão, quem é parceiro (não dono) sai da missão ao bloquear. */
  function souParceiroNaMissaoDoOutro(missao) {
    var eu = meuApelido();
    var dono = missao && typeof missao.user_name === "string" ? missao.user_name.trim() : "";
    return !!eu && !!dono && eu !== dono;
  }

  window.NexusChat = {
    LIMITE: LIMITE,
    TEXTOS: TEXTOS,
    preencher: preencher,
    erroDoServidor: erroDoServidor,
    tamanho: tamanho,
    aplicar: aplicar,
    ultimaVista: ultimaVista,
    marcarVista: marcarVista,
    contarNovas: contarNovas,
    meuApelido: meuApelido,
    temPar: temPar,
    nomeDoOutro: nomeDoOutro,
    souParceiroNaMissaoDoOutro: souParceiroNaMissaoDoOutro
  };
})();
