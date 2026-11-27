/* Título novo: o servidor não manda flag de subida (join traz o title atual;
   o check-in não traz título). Aqui o título visto fica guardado neste aparelho
   e a tela abre quando ele muda. Nada de nome de pessoa nem de segredo: só o
   nome do título e o nível, da lista fechada de comunidade-textos.js. */

(function () {
  var CHAVE_VISTO = "nexus_v2_titulo_visto";
  var CHAVE_PENDENTE = "nexus_v2_titulo_pendente";

  function lista() {
    return window.NexusComunidade && Array.isArray(window.NexusComunidade.TITULOS)
      ? window.NexusComunidade.TITULOS
      : [];
  }

  /* Só aceita os cinco títulos do servidor, com o nível certo e 5 marcas.
     Qualquer outro valor volta como null e nunca abre tela. */
  function valido(titulo) {
    if (!titulo || typeof titulo !== "object") return null;
    if (titulo.marks != null && Number(titulo.marks) !== 5) return null;
    var nivel = Number(titulo.level);
    if (!Number.isInteger(nivel) || nivel < 1 || nivel > 5) return null;
    var todos = lista();
    for (var i = 0; i < todos.length; i++) {
      if (todos[i].nome === titulo.name && todos[i].nivel === nivel) {
        return { name: titulo.name, level: nivel, marks: 5 };
      }
    }
    return null;
  }

  function ler(chave) {
    try {
      var bruto = localStorage.getItem(chave);
      if (!bruto) return null;
      var dados = JSON.parse(bruto);
      if (!dados || typeof dados !== "object") return null;
      if (dados.name === "") return { name: "", level: 0, marks: 5 };
      return valido(dados);
    } catch (erro) {
      return null;
    }
  }

  function salvar(chave, dados) {
    try {
      localStorage.setItem(chave, JSON.stringify(dados));
    } catch (erro) {
      /* Sem espaço no aparelho, a tela segue sem lembrar do título. */
    }
  }

  function registrar(titulo) {
    var atual = valido(titulo) || { name: "", level: 0, marks: 5 };
    salvar(CHAVE_VISTO, atual);
  }

  function lerPendente() {
    return ler(CHAVE_PENDENTE);
  }

  function limparPendente() {
    try {
      localStorage.removeItem(CHAVE_PENDENTE);
    } catch (erro) {}
  }

  async function verificar(tituloDaResposta) {
    var atual = valido(tituloDaResposta);
    if (!atual && window.NexusApi && window.NexusApi.meuMerito) {
      var resultado = await window.NexusApi.meuMerito();
      if (!resultado || !resultado.ok) return false;
      atual = valido(resultado.dados && resultado.dados.title);
    }
    if (!atual) return false;

    var visto = ler(CHAVE_VISTO);
    registrar(atual);
    if (!visto || (visto.name === atual.name && visto.level === atual.level)) return false;

    salvar(CHAVE_PENDENTE, atual);
    var busca = window.NexusAbas && window.NexusAbas.busca ? window.NexusAbas.busca(["tema", "cenario", "rede"]) : "";
    location.assign("novo-titulo.html" + busca);
    return true;
  }

  window.NexusTituloNovo = {
    valido: valido,
    registrar: registrar,
    lerPendente: lerPendente,
    limparPendente: limparPendente,
    verificar: verificar
  };
})();
