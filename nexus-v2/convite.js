/* Convite por link para o Duo e o Rival (PR 38 do servidor; decisões de 26/11).
   - O token vai no CORPO dos pedidos ao servidor, nunca na URL do servidor.
   - O link do site leva o token no fragmento («#t=…»): o fragmento não sai do
     navegador, então não vai para os registros de acesso.
   - O token não é guardado no aparelho: aparece uma vez, para copiar.
   Textos do servidor aprovados no PR 38; os da tela, para o sim do Isaac. */
(function () {
  var TEXTOS = {
    /* Missão (quem convida) */
    convidarDuo: "Convidar para Duo",
    convidarRival: "Convidar para Rival",
    criando: "Criando o convite…",
    rotuloLink: "Link do convite",
    copiar: "Copiar link",
    copiado: "Link copiado.",
    compartilhar: "Compartilhar",
    cancelar: "Cancelar convite",
    cancelando: "Cancelando…",
    apoioDuo: "Quem abrir o link entra nesta missão com você.",
    apoioRival: "Quem abrir o link vira seu rival, cada um na própria missão.",
    validade: "Vale até {data} (hora de Lisboa). Só pode ser usado uma vez.",
    semRedeCriar: "Sem internet. O convite não pode ser criado agora.",
    semRedeCancelar: "Sem internet. O convite não foi cancelado.",
    textoCompartilhar: "Convite para o Nexus",

    /* Página de aceitar (quem recebe) */
    tituloDuo: "Convite para Duo",
    tituloRival: "Convite para Rival",
    tituloGeral: "Convite",
    abrindo: "Abrindo o convite…",
    deQuemDuo: "{nome} chamou você para um Duo.",
    deQuemRival: "{nome} chamou você para ser Rival.",
    desafio: "Desafio: {titulo}",
    missaoDuo: "Missão: {titulo}",
    explicaDuo: "No Duo, vocês cumprem a mesma missão juntos.",
    /* Revisão da Clara do PR 36: no Rival, dizer antes que aceitar muda a missão. */
    explicaRivalMinha: "Ao aceitar, sua missão “{titulo}” passa a valer no Rival.",
    explicaRivalNova: "Ao aceitar, você começa uma missão nova com o mesmo desafio.",
    /* O que a outra pessoa passa a ver (igual à Privacidade: se fez, o dia
       difícil e os pontos; nunca a nota). */
    veDuo: "{nome} vai ver se você cumpriu cada dia e se foi dia difícil. Não vê as suas notas.",
    veRival: "{nome} vai ver se você cumpriu cada dia, se foi dia difícil e os seus pontos. Não vê as suas notas.",
    pontos: "No Rival, cada dia cumprido vale 10 pontos, e o dia difícil também. O dia livre não pontua.",
    aceitar: "Aceitar convite",
    agoraNao: "Agora não",
    aceitando: "Aceitando…",
    irParaMissao: "Ir para a missão",
    /* O convite volta sozinho depois de entrar (o token fica só nesta aba durante o login). */
    entrarPrimeiro: "Para aceitar, entre na sua conta. Depois de entrar, o convite abre de novo.",
    entrar: "Entrar",
    semRede: "Sem internet. O convite não abriu.",
    semRedeAceitar: "Sem internet. O convite não foi aceito.",

    /* Placar do Rival (Missão) */
    pontosDe: "{n} pontos",
    umPonto: "1 ponto",
    regraPontos: "10 pontos por dia cumprido. O dia difícil conta; o dia livre não."
  };

  /* Erros do servidor aprovados no PR 38: a tela mostra a frase dele. */
  var DO_SERVIDOR = [
    "Escolha Duo ou Rival.",
    "Missão não encontrada.",
    "Só dá para convidar numa missão Solo ativa.",
    "Convite cancelado.",
    "Este convite já foi usado.",
    "Convite não encontrado. Confira o link.",
    "Este convite venceu. Peça um novo a quem convidou.",
    "Este convite foi cancelado. Peça um novo a quem convidou.",
    "Você não pode aceitar o seu próprio convite.",
    "Você já está num Duo ou Rival ativo. Saia dele antes de aceitar outro convite.",
    "Esta missão já não está disponível para convite.",
    "Não foi possível aceitar este convite.",
    "Escolha uma missão Solo ativa sua.",
    "O Duo e o Rival são só para maiores de 18 anos.",
    "O convite ainda não está disponível. Tente de novo mais tarde.",
    "Não deu para concluir agora. Tente de novo daqui a pouco.",
    "Pronto. Vocês agora estão em Duo.",
    "Pronto. Vocês agora estão em Rival."
  ];
  var INDISPONIVEL = "O convite ainda não está disponível. Tente de novo mais tarde.";
  var ERRO = "Não deu para concluir agora. Tente de novo daqui a pouco.";
  var NAO_ENCONTRADO = "Convite não encontrado. Confira o link.";

  function preencher(modelo, valores) {
    return modelo.replace(/\{(\w+)\}/g, function (_, chave) {
      return Object.prototype.hasOwnProperty.call(valores, chave) ? String(valores[chave]) : "";
    });
  }

  /* O token do servidor: 43 caracteres base64url. */
  function tokenValido(token) {
    return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
  }

  /* Link do site com o token no fragmento. */
  function linkDoConvite(token, base) {
    if (!tokenValido(token)) return "";
    var raiz = base || (location.origin + location.pathname.replace(/[^/]*$/, ""));
    return raiz + "aceitar-convite.html#t=" + token;
  }

  /* Lê o token do fragmento («#t=…»). */
  function tokenDoFragmento(hash) {
    var texto = typeof hash === "string" ? hash : "";
    var m = /^#t=([A-Za-z0-9_-]{43})$/.exec(texto);
    return m ? m[1] : "";
  }

  /* Texto calmo para um resultado de NexusApi que falhou. */
  function textoDoErro(resultado) {
    if (!resultado) return ERRO;
    if (resultado.status === 503) return INDISPONIVEL;
    if (DO_SERVIDOR.indexOf(resultado.erro) !== -1) return resultado.erro;
    if (resultado.status === 404) return NAO_ENCONTRADO;
    return ERRO;
  }

  /* A validade sempre na hora de Lisboa (como em Meus dados), qualquer que
     seja o fuso do aparelho. */
  function validade(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    var partes = {};
    try {
      new Intl.DateTimeFormat("pt-PT", {
        timeZone: "Europe/Lisbon", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false
      }).formatToParts(d).forEach(function (p) { partes[p.type] = p.value; });
    } catch (erro) {
      return "";
    }
    return preencher(TEXTOS.validade, { data: partes.day + "/" + partes.month + " às " + partes.hour + ":" + partes.minute });
  }

  /* Token guardado SÓ nesta aba, SÓ durante o login, e apagado ao voltar. */
  var CHAVE_PENDENTE = "nexus_v2_convite_pendente";
  function guardarParaOLogin(token) {
    if (!tokenValido(token)) return;
    try { sessionStorage.setItem(CHAVE_PENDENTE, token); } catch (erro) {}
  }
  function pendente() {
    try {
      var t = sessionStorage.getItem(CHAVE_PENDENTE) || "";
      return tokenValido(t) ? t : "";
    } catch (erro) {
      return "";
    }
  }
  function apagarPendente() {
    try { sessionStorage.removeItem(CHAVE_PENDENTE); } catch (erro) {}
  }

  function textoPontos(n) {
    return n === 1 ? TEXTOS.umPonto : preencher(TEXTOS.pontosDe, { n: n });
  }

  window.NexusConvite = {
    TEXTOS: TEXTOS,
    DO_SERVIDOR: DO_SERVIDOR,
    preencher: preencher,
    tokenValido: tokenValido,
    linkDoConvite: linkDoConvite,
    tokenDoFragmento: tokenDoFragmento,
    textoDoErro: textoDoErro,
    validade: validade,
    textoPontos: textoPontos,
    guardarParaOLogin: guardarParaOLogin,
    pendente: pendente,
    apagarPendente: apagarPendente
  };
})();
