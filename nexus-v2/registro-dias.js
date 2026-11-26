/* Regras dos dias registrados, num lugar só.
   O Hoje e a Missão leem daqui para o rastro não divergir:
   os check-ins desta pessoa, os dias feitos, os dias difíceis
   e o que é dia livre. */

(function () {
  var CHAVE_USUARIO = "nexus_v2_user";

  function nomeLocal() {
    try {
      var bruto = localStorage.getItem(CHAVE_USUARIO);
      if (!bruto) return "";
      var usuario = JSON.parse(bruto);
      return usuario && typeof usuario.username === "string" ? usuario.username : "";
    } catch (erro) {
      return "";
    }
  }

  function grupos(progresso) {
    if (!progresso || typeof progresso.progress !== "object" || !progresso.progress) return [];
    return Object.keys(progresso.progress).map(function (chave) {
      var grupo = progresso.progress[chave];
      return {
        username: grupo && typeof grupo.username === "string" ? grupo.username : "",
        checkins: grupo && Array.isArray(grupo.checkins) ? grupo.checkins : []
      };
    });
  }

  function normalizar(checkins) {
    var saida = [];
    checkins.forEach(function (item) {
      if (!item) return;
      var dia = Number(item.day);
      if (!isFinite(dia)) return;
      saida.push({
        day: dia,
        completed: item.completed === true,
        note: typeof item.note === "string" ? item.note : "",
        difficult: item.difficult === true || item.is_difficult === true
      });
    });
    return saida;
  }

  function numerosDe(lista) {
    var dias = [];
    if (!Array.isArray(lista)) return dias;
    lista.forEach(function (item) {
      var n = typeof item === "number" ? item : Number(item && item.day);
      if (isFinite(n) && n > 0) dias.push(n);
    });
    return dias;
  }

  function checkinsMeus(missao, progresso) {
    var lista = grupos(progresso);
    var meuNome = nomeLocal();
    var i;
    if (meuNome) {
      for (i = 0; i < lista.length; i++) {
        if (lista[i].username === meuNome) return normalizar(lista[i].checkins);
      }
    }
    var dono = missao && typeof missao.user_name === "string" ? missao.user_name : "";
    if (dono && (!meuNome || meuNome === dono)) {
      for (i = 0; i < lista.length; i++) {
        if (lista[i].username === dono) return normalizar(lista[i].checkins);
      }
    }
    var par = missao && typeof missao.partner_name === "string" ? missao.partner_name : "";
    var outros = lista.filter(function (grupo) {
      return !par || grupo.username !== par;
    });
    if (outros.length === 1) return normalizar(outros[0].checkins);
    return [];
  }

  /* Sem o campo, devolve null. Não completa com 0. */
  function lerDiasDificeis(sequencia, missao, meus) {
    var veio = false;
    var dias = [];
    if (sequencia && Array.isArray(sequencia.difficult_days)) {
      veio = true;
      dias = numerosDe(sequencia.difficult_days);
    } else if (missao && Array.isArray(missao.difficult_days)) {
      veio = true;
      dias = numerosDe(missao.difficult_days);
    }
    (meus || []).forEach(function (item) {
      if (item.difficult === true) {
        veio = true;
        if (dias.indexOf(item.day) === -1) dias.push(item.day);
      }
    });
    return veio ? dias : null;
  }

  function diasFeitos(meus, dia, hojeFeito) {
    var lista = [];
    (meus || []).forEach(function (item) {
      if (item.completed === true) lista.push(item.day);
    });
    if (hojeFeito && lista.indexOf(dia) === -1) lista.push(dia);
    return lista;
  }

  /* (dia) => true quando o Dia N é dia livre. Hoje segue o servidor. */
  function livreDe(modelo) {
    var daMissao = NexusDias.verificador(modelo.diasSemana, modelo.semanaDia1);
    return function (dia) {
      if (dia === modelo.dia) return modelo.diaLivre === true;
      return !daMissao(dia);
    };
  }

  window.NexusRegistro = {
    checkinsMeus: checkinsMeus,
    diasFeitos: diasFeitos,
    lerDiasDificeis: lerDiasDificeis,
    livreDe: livreDe
  };
})();
