/* A linha da Maratona dentro de comunidade.html?c=<slug>.
   Não é cartão em destaque: uma linha de lista, com nome, quando começa ou
   em que dia está, o total do grupo e «Entrar na maratona» ou «Ver».
   Quem não é membro e a comunidade só leitura não recebem botão de entrar.
   Texto de pessoa entra só por textContent. */

(function () {
  var M = window.NexusMaratonaTextos;
  var T = M.TEXTOS;
  var B = window.NexusComBase;
  var slugAtual = "";
  var maratonaAtual = null;
  var botaoDaLinha = null;

  function visivel(el, sim) {
    if (el) el.hidden = !sim;
  }

  function aviso(texto) {
    var el = document.getElementById("alerta-maratona");
    if (!el) return;
    if (texto) B.mostrarAviso(el, "falha", texto);
    else B.esconderAviso(el);
  }

  function ordem(a, b) {
    var aa = a && a.phase === "active" ? 0 : 1;
    var bb = b && b.phase === "active" ? 0 : 1;
    return aa - bb;
  }

  /* resposta: o resultado de NexusApi.listarMaratonas(slug). Um 503 aqui não
     derruba a comunidade: a linha simplesmente não aparece. */
  function pintar(resposta, acesso, slug) {
    slugAtual = slug || "";
    maratonaAtual = null;
    var linha = document.getElementById("linha-maratona");
    if (!linha) return;
    var itens = resposta && resposta.ok && resposta.dados && Array.isArray(resposta.dados.marathons) ? resposta.dados.marathons : [];
    if (!itens.length) {
      linha.hidden = true;
      return;
    }

    var m = itens.slice().sort(ordem)[0];
    maratonaAtual = m;
    document.getElementById("maratona-nome").textContent = typeof m.title === "string" && m.title ? m.title : T.maratona;
    document.getElementById("maratona-quando").textContent = M.quando(m);
    document.getElementById("maratona-pessoas").textContent = M.contarPessoas(m.participants);

    var membro = !!(acesso && acesso.is_member === true);
    var soLeitura = !!(acesso && acesso.post_code === "read_only");
    var participa = m.is_participant === true;
    var botao = document.getElementById("btn-maratona-entrar");

    if (soLeitura || !membro) {
      botao.hidden = true;
      var motivo = document.getElementById("maratona-motivo");
      motivo.textContent = soLeitura ? T.soLeitura : T.semParticipar;
      visivel(motivo, true);
    } else {
      visivel(document.getElementById("maratona-motivo"), false);
      botao.hidden = false;
      botao.textContent = participa ? T.ver : T.entrarNaMaratona;
    }

    var criar = document.getElementById("link-maratona-criar");
    criar.href = B.link("maratona.html", { c: slugAtual, criar: "1" });
    visivel(criar, !!(resposta.dados && resposta.dados.can_create === true) && membro && !soLeitura);

    linha.hidden = false;
    /* Uma luz por tela: «Publicar» se o formulário está aberto; se não está,
       a única ação da linha pode ser a luz. Nunca as duas ao mesmo tempo. */
    var form = document.getElementById("form-post");
    botao.classList.toggle("btn-luz", !form || form.hidden);
  }

  function abrirDialogo(gatilho) {
    botaoDaLinha = gatilho || null;
    aviso("");
    var dialogo = document.getElementById("dialogo-maratona");
    if (dialogo.showModal) dialogo.showModal();
    else dialogo.setAttribute("open", "");
    document.getElementById("btn-agora-nao-maratona").focus();
  }

  function fecharDialogo() {
    var dialogo = document.getElementById("dialogo-maratona");
    if (dialogo.close) dialogo.close();
    else dialogo.removeAttribute("open");
  }

  function abrir() {
    if (!maratonaAtual) return;
    if (maratonaAtual.is_participant === true) {
      location.assign(B.link("maratona.html", { c: slugAtual, m: maratonaAtual.id }));
      return;
    }
    abrirDialogo(document.getElementById("btn-maratona-entrar"));
  }

  async function entrar() {
    if (!maratonaAtual || !slugAtual) return;
    var botao = document.getElementById("btn-entrar-maratona");
    botao.disabled = true;
    botao.setAttribute("aria-busy", "true");
    var resultado = await NexusApi.entrarNaMaratona(slugAtual, maratonaAtual.id);
    botao.disabled = false;
    botao.setAttribute("aria-busy", "false");

    if (resultado.semRede) return aviso(T.semRede);
    if (B.sessaoVencida(resultado)) return B.irParaEntrada();
    if (B.semIdade(resultado)) return B.abrirAjuda();
    if (!resultado.ok) {
      aviso(resultado.erro || T.erroGenerico);
      botao.focus();
      return;
    }
    location.assign(B.link("maratona.html", { c: slugAtual, m: maratonaAtual.id }));
  }

  function iniciar() {
    var botao = document.getElementById("btn-maratona-entrar");
    if (!botao) return;
    botao.addEventListener("click", abrir);
    document.getElementById("btn-entrar-maratona").addEventListener("click", entrar);
    document.getElementById("btn-agora-nao-maratona").addEventListener("click", function () {
      fecharDialogo();
    });
    var dialogo = document.getElementById("dialogo-maratona");
    dialogo.addEventListener("close", function () {
      if (botaoDaLinha && botaoDaLinha.isConnected) NexusAbas.focar(botaoDaLinha);
      botaoDaLinha = null;
    });
  }

  window.NexusMaratonaLinha = {
    pintar: pintar,
    iniciar: iniciar,
    abrirDialogo: abrirDialogo
  };
})();
