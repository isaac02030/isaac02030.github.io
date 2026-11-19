/* Link fictício de convite. Só entra na página em localhost ou 127.0.0.1.
   Em outro host, missao.html não carrega este arquivo.
   O endereço não leva a lugar nenhum e não é um convite de verdade. */

var NexusDevConvite = {
  link: function () {
    return "https://exemplo.invalid/nexus/convite-ficticio";
  }
};
