/* Mock local da API. Só para testar a tela neste computador.
   Não é o servidor do Nexus. Não guarda senha em arquivo.
   A chave pública do aviso nasce na memória e não é gravada.
   Rode na raiz do repositório: node nexus-v2/dev/mock-api.js
   A tela fala com http://localhost:3000 (veja NEXUS_API_URL em api.js).

   Login (POST /api/users/login):
   - senha "errada" → 401 Credenciais inválidas.
   - e-mail falha@exemplo.com → 500
   - e-mail lento@exemplo.com → espera e depois entra
   - e-mail com-missao@exemplo.com → entra e já tem uma missão ativa
   - qualquer outro e-mail e senha → entra, sem missão
   Cadastro (POST /api/users/register):
   - senha com menos de 6 caracteres → 400
   - nome "repetido" ou e-mail repetido@exemplo.com → 400 já em uso
   - e-mail falha@exemplo.com → 500
   - o resto cria a conta, sem missão
   Missão (POST /api/missions), com o token do login:
   - sem título ou sem categoria → 400
   - título exatamente "falha" → 500
   - título exatamente "lento" → espera 8 segundos e cria
   - mission_weekdays (1 = segunda ... 7 = domingo), como no PR 16 do servidor:
     fora de 1 a 7 ou repetido → 400 «Escolha os dias da missão de segunda (1)
     a domingo (7), sem repetir.»; menos de 3 → 400 «Escolha pelo menos 3 dias
     da missão por semana.»; sem o campo (ou null) → todos os dias.
   - título "sem-migracao" com mission_weekdays → 503, como o servidor sem a
     migração 004. Sem o campo, cria normalmente.
   - título "dias-servidor" com mission_weekdays → 400 com a frase dos 3 dias
     (para ver o texto do servidor na tela, mesmo com 3 dias marcados).
   - o resto cria a missão. duration_days do pedido é ignorado e fica 30,
     como na rota de verdade. started_at nasce agora.
   Aviso:
   - GET /api/notifications/vapid-key → chave pública
   - POST /api/notifications/subscribe → grava a inscrição na memória
   Lembrete (PUT /api/users/me/reminder):
   - esta rota ainda não existe no servidor de verdade
   - só responde se a origem for localhost, 127.0.0.1 ou [::1]
   - fora disso, devolve 404 e não guarda nada
   - aqui ela guarda { reminder_time, timezone } na memória
   - ?cenario=lembrete-erro → 500, não guarda
   - ?cenario=lembrete-lento → espera 8 segundos e guarda
   Estender (POST /api/missions/:id/extend com { days: 36 }):
   - esta rota ainda não existe no servidor de verdade
   - não é continue-solo
   - só responde se a origem for localhost, 127.0.0.1 ou [::1]
   - fora disso, devolve 404 e não muda a duração
   - aqui soma 36 a duration_days. Se o status era completed, volta a active
   - ?cenario=extend-erro → 500, não muda a duração

   Hoje (a tela pede estas rotas, nunca o placar):
   - GET /api/missions
   - GET /api/missions/:id  (inclui partner_name)
   - GET /api/checkins/:missionId  → { progress }
   - GET /api/checkins/:missionId/streak
     → streak, total, today_done, brio, consistency, recovered,
       missed_yesterday, missed_days, missed_days_before_today, recovery_needed
   - GET /api/checkins/:id/score espelha o servidor: { mission_id, mode, scores,
     leader, my_streak }. scores usa o username como chave. Sem par, a chave
     "null" existe, como na rota de verdade. A tela Missão só lê isso no Rival.
   - POST /api/missions/:id/abandon segue a rota de verdade.
     Solo ativo encerra. Com par, a outra pessoa continua em solo.
     Missão que não está ativa responde 404.

   A sequência manda difficult_days (números do dia), difficult_days_used e
   difficult_days_remaining. Cada check-in pode trazer difficult (true ou false).
   Os cenários abaixo mandam esses campos. Uma missão criada pela tela não
   recebe. O cenário sem-campo também não, e ignora difficult no POST.

   Troque o estado com ?cenario= na URL da tela, ou entre com o e-mail:
   - nao-registrado  (nao-registrado@exemplo.com)  dia ainda sem registro
   - registrado      (registrado@exemplo.com)      registro feito, com nota
   - dificil-hoje                                  o dia de hoje foi registrado como difícil, com nota
   - duo             (duo@exemplo.com)             Duo, Par Teste já registrou
   - duo-sem         (duo-sem@exemplo.com)         Duo, o par ainda não registrou
   - esperando       (esperando@exemplo.com)       à espera do par, Solo visível
   - vazio           (vazio@exemplo.com)           sem missão
   - erro            (erro-hoje@exemplo.com)       falha ao abrir o dia
   - recuperacao     (recuperacao@exemplo.com)     ontem sem registro, dentro do Hoje
   - falta-1         (falta-1@exemplo.com)         igual à recuperação: 1 dia
   - falta-3         (falta-3@exemplo.com)         3 dias sem registro
   - recuperacao-zero (recuperacao-zero@exemplo.com) restantes 0, sem o link difícil
   - recuperacao-sem-numero                        sem missed_days e sem dia difícil
   - recuperacao-sem-fato                          sem missed_days e sem missed_yesterday
   - recuperacao-seguidos                          2 seguidos forçados, o link some
   - recuperacao-sem-minimo                        sem o mínimo gravado
   - recuperacao-minusculo                         mínimo em minúscula, na linha de baixo
   - falta-antiga        (falta-antiga@exemplo.com) Hoje normal, com um dia antigo sem registro
   - recuperacao-sem-antes                         sem missed_days_before_today, cai em missed_days - 1
   - recuperacao-contagem-zero                     antes de hoje é 0; a frase não mostra 0
   - recuperacao-contagem-some                     antes de hoje é 0 e ontem houve registro; a frase some
   - sem-campo       (sem-campo@exemplo.com)       igual ao não registrado, sem dia difícil
   - solo            (solo@exemplo.com)            Solo, sem par
   - duo-esperando   (duo-esperando@exemplo.com)   Duo à espera, o dia conta
   - duo-com-par     (duo-com-par@exemplo.com)     Duo com Ana, nome de exemplo
   - rival-placar    (rival-placar@exemplo.com)    Rival com Ana, dias de exemplo
   - convite-indisponivel                          Solo, o convite por link avisa
   - link-fake       (link-fake@exemplo.com)       a página só mostra o link em localhost
   - dois-seguidos   (dois-seguidos@exemplo.com)   os 2 dias anteriores foram difíceis
   - quatro-usados   (quatro-usados@exemplo.com)   difficult_days_remaining 0
   - sem-restante    (sem-restante@exemplo.com)    há dia difícil, sem o campo remaining
   - ignora-difficult (ignora-difficult@exemplo.com) o POST não confirma difficult
   - so-is-difficult (so-is-difficult@exemplo.com) o POST grava, mas responde is_difficult
   - post-seguidos   (post-seguidos@exemplo.com)   o POST responde o 400 de 2 seguidos
   - post-crise      (post-crise@exemplo.com)      o POST grava sem a nota e responde crisis: true,
                                                    como o filtro do servidor. O mock não lê a nota:
                                                    o sinal vem só do cenário.
   - post-quatro     (post-quatro@exemplo.com)     o POST responde o 400 dos 4 dias
   - quatro-e-seguidos (quatro-e-seguidos@exemplo.com) os 4 acabaram e os 2 anteriores também
   - dia-livre       (dia-livre@exemplo.com)       Dia 10, hoje é dia livre (3 dias por semana,
                                                    calculados a partir de hoje). O POST do
                                                    check-in responde 400 com free_day: true.
   - semana-livre    (semana-livre@exemplo.com)    Dia 10, hoje é dia da missão, ainda sem
                                                    registro; a régua mostra os dias livres.

   Check-in (POST /api/checkins com { mission_id, note } e, na tela 5,
   difficult: true e minimum_done: true; sem minimum_done, 400 como no servidor):
   A resposta segue a rota de verdade: { checkin, day, already_done, message }.
   Nota com mais de 280 caracteres reais: 400 com a mensagem do servidor.
   Campo de crise só no cenário post-crise. Não lemos a nota para inventar um.
   Com difficult: true, o check-in volta com difficult: true, salvo nos cenários
   que ignoram o campo. A rota real devolve a coluna is_difficult; o cenário
   so-is-difficult copia isso e não manda checkin.difficult.
   - estudo            formulário de aprendizagem, dia em aberto
   - academia          (academia@exemplo.com)        categoria fitness
   - lento             o POST espera 8 segundos e registra
   - erro-registro     (erro-registro@exemplo.com)   POST responde 500
   - nota-servidor     (nota-servidor@exemplo.com)   POST 400 no texto europeu da prova
   - repetido          POST responde already_done true
   - terminada         (terminada@exemplo.com)       o dia passou de 30
   - fim-30            (fim-30@exemplo.com)          dia 31, 30 check-ins
   - fim-27            (fim-27@exemplo.com)          dia 31, 27 check-ins
   - fim-status        (fim-status@exemplo.com)      status completed no dia 12
   - fim-misto                                       dia 31 com faltas, difíceis e dias livres (trilha)
   - trilha-dia1, trilha-meio, trilha-feito          Hoje com a trilha de luz (dia 1; dia 14 com dia sem registro e livre)
   - trilha-66                                       dia 40 de 66, para o rastro da Missão
   - dias-erro                                       a missão abre e o progresso dos dias falha
   - duo-feito                                       Duo com Ana, dia de hoje já registrado
   - extend-erro       (extend-erro@exemplo.com)     o POST /extend responde 500
   - inativa           (inativa@exemplo.com)         a missão não está ativa
   - sem-porque        o porquê vem vazio

   Resposta do Grande Irmão (a página resolve, sem rota de IA):
   A flag NEXUS_ABRIR_TELA_IA_APOS_CHECKIN continua false.
   ?ia=1 no check-in ou no dia difícil manda o sucesso para grande-irmao.html
   só se o host for localhost ou 127.0.0.1. Em outro host, ?ia=1 não faz nada.
   Estes cenários são da página, não deste servidor:
   - cumpriu       frase fixa do dia cumprido
   - dificil       frase fixa do dia difícil (dia-dificil é o mesmo)
   - volta         frase fixa da volta ao ciclo
   - offline       frase fixa, sem erro técnico
   - ia-exemplo    só em localhost/127.0.0.1; o texto fica em dev/ia-exemplo.js
   Não existe GET /api/vertice/message nem POST /api/assistant/mission.

   Idade no cadastro (PR 18 do servidor):
   - sem birth_date → 400 «Falta a data de nascimento...»
   - birth_date fora de AAAA-MM-DD ou data que não existe → 400 «A data de nascimento não parece certa...»
   - menos de 18 anos (corte no fuso UTC-12, 29/02 faz 18 em 01/03) → 403 com under_age: true,
     e nada é guardado (o e-mail continua livre)
   - e-mail sem-migracao@exemplo.com → 503, como o servidor sem a migração 006
   - e-mail menor-sem-campo@exemplo.com → 403 sem under_age (caso negado do site)
   - a data não é guardada: o mock guarda só "adulto: true", como adult_confirmed_at
   GET /api/users/me → { user: { id, username, email, adult_confirmed, legal } }

   Aceite dos termos (PR 28 do servidor), versão atual «beta-1» nos dois:
   - cadastro sem terms_version/privacy_version → 400 code legal_acceptance_required
     (depois da idade, como no servidor); versão diferente → 400 legal_version_outdated
   - e-mail termos-mudaram@exemplo.com no cadastro → 400 legal_version_outdated
     (para ver a frase na tela, mesmo mandando beta-1)
   - login e /me trazem user.legal { ..., needs_acceptance }
   - e-mail reaceitar@exemplo.com → entra sem aceite (needs_acceptance: true)
   - e-mail aceite-antigo@exemplo.com → aceitou «beta-0» (needs_acceptance: true)
   - e-mail aceite-falha@exemplo.com → como reaceitar, e o aceite responde 500
   - POST /api/users/me/legal-acceptance { terms_version, privacy_version }, com login:
     grava a versão e a hora; sem versões → 400; versão antiga → 400; 200 { legal }
   Nota do check-in (PR 27), com login:
   - GET/POST/DELETE /api/users/me/note-consent. POST só com { consent: true }.
     DELETE grava «não» e apaga as notas guardadas da pessoa (notes_deleted).
   - Quem entra pelo login começa com «sim» (para os cenários antigos com nota);
     conta criada no cadastro e os e-mails primeira-vez@exemplo.com e
     escolha-falha@exemplo.com começam sem resposta (a pergunta aparece);
     nao-guarda@exemplo.com começa com «não».
   - e-mail escolha-falha@exemplo.com → POST e DELETE respondem 500.
   - POST /api/checkins só guarda a nota com «sim» e responde note_saved.
   Lembretes e novidades (PR 29), com login:
   - GET/PUT /api/users/me/notification-preferences ({ reminders?, news? },
     só true/false). Tudo começa sem escolha. avisos-falha@exemplo.com → PUT 500.
   Excluir conta (PR 26): DELETE /api/users/me com { password }:
   - sem senha → 400 password_required; senha "errada" → 403 wrong_password;
     senha "muitas" → 429 too_many_attempts; admin@exemplo.com → 403
     admin_account; excluir-falha@exemplo.com → 500; o resto apaga a conta
     (depois disso, o token antigo responde 401 session_ended).
   Sessão conferida a cada pedido (PR 26 do servidor):
   - e-mail sessao-encerrada@exemplo.com → entra, e todo pedido com login
     responde 401 code session_ended «Sessão encerrada. Entre de novo.»
   - e-mail sessao-indisponivel@exemplo.com → entra, e todo pedido com login
     responde 503 code auth_unavailable

   Comunidade (PR 18 do servidor), tudo com login:
   - e-mail sem-idade@exemplo.com → 403 com code adult_confirmation_required em
     toda a comunidade (menos a área da equipe, que tem a própria regra)
   - GET /api/communities → lista; GET /api/communities/:slug → { community, ranking, posts, access }
   - o post 50 é sempre de quem está logado (o site não mostra «Denunciar» nele);
     com autor@exemplo.com ele vem escondido (hidden: true, hidden_reason "perigoso"),
     sem contagem de denúncias, como no servidor. Os outros não veem post escondido.
   - POST .../posts/:postId/report com { reason, details? }: motivo fora da lista → 400;
     o próprio post → 400; segunda denúncia do mesmo post → 409; o resto → 201.
     O mock não lê o comentário para achar crise: o sinal vem só do cenário.
   Cenários da comunidade (?cenario= na página):
   - comunidade-indisponivel  503 ao abrir (e na denúncia), como sem a migração 005
   - comunidade-erro          500 ao abrir
   - comunidade-vazia         sem posts
   - comunidade-fechada       access.can_read_forum false, sem posts
   - denuncia-crise           201 com reported: true e crisis: true (comentário não guardado)
   - denuncia-crise-nao-enviada 200 com reported: false e crisis: true
   - denuncia-indisponivel    503 na denúncia
   - denuncia-erro            500 na denúncia
   - denuncia-lenta           espera 4 segundos e registra
   - idade-crise              com sem-idade@: 200 com crisis: true e saved: false (o portão
                              18+ responde a ajuda antes do 403)
   Área da equipe (só admin@exemplo.com; os outros → 403 «Esta area esta disponivel apenas para o admin.»):
   - GET /api/communities/admin/hidden-posts → posts escondidos (prioridade alta primeiro;
     um com repeat_reporter_alert). Vem username e user_id, como no servidor: a tela não mostra.
   - POST /api/communities/admin/posts/:id/restore → { restored: true }; não escondido → 409
   - DELETE /api/communities/admin/posts/:id → { deleted: true }; não existe → 404
   - ?cenario=equipe-vazia (lista vazia), equipe-indisponivel (503), equipe-erro-acao (500 na ação)

   Chat do Duo/Rival (PRs 32 a 35 do servidor; ?cenario= na página):
   - GET /api/messages/:missionId → { mission_id, messages } (só com par ativo;
     sem par, lista vazia; missão de outra pessoa → 403)
   - POST /api/messages { mission_id, content } → 201 { message }; vazio ou
     não texto → 400; acima de 280 → 400; sem par → 400
   - POST /api/messages/:id/report { reason, details? } → 201; motivo fora da lista → 400
   - POST /api/messages/:missionId/block → 200 { blocked: true }; depois disso a
     missão do cenário fica em Solo
   - GET /api/messages/admin/reports → só admin@exemplo.com; os outros → 403
   O mock não lê a mensagem para achar crise: o sinal vem só do cenário.
   - chat               Duo com Ana, 3 mensagens de exemplo
   - chat-vazio         Duo com Ana, sem mensagens
   - chat-sem-par       Solo (a conversa não abre)
   - chat-parceiro      Duo na missão da Ana (bloquear avisa que você sai da missão)
   - chat-crise         o envio responde crisis: true (nada é gravado)
   - chat-429           o envio responde 429 (limite da hora)
   - chat-lento         o envio espera 8 segundos e grava
   - chat-erro / chat-503   abrir a conversa responde 500 / 503
   - chat-denuncia-409 / chat-denuncia-erro / chat-denuncia-crise
   - chat-bloqueio-erro / chat-bloqueio-503
   - equipe-chat-503    a lista de denúncias do chat responde 503
   Avisos de mensagem: GET/PUT /api/users/me/notification-preferences com «messages».

   Pessoas bloqueadas (rotas novas; o servidor de verdade ainda não tem):
   - GET /api/users/me/blocks → { blocks: [{ block_id, username, created_at }] },
     só quem eu bloqueei, do mais recente ao mais antigo. Sem e-mail e sem
     o id da pessoa.
   - DELETE /api/users/me/blocks/:blockId → 200 { unblocked: true } também
     quando a linha não existe ou é de outra pessoa (a linha dela fica).
   - id inválido → 400. Sem token → 401. 429 e 503 nos cenários abaixo.
   - só responde se a origem for localhost, 127.0.0.1 ou [::1]. Fora disso,
     404 e não apaga nada.
   - ?cenario=bloqueados-vazio, bloqueados-erro (500), bloqueados-503,
     bloqueados-429, bloqueados-lento (espera e devolve a lista)
   - ?cenario=desbloqueio-erro, desbloqueio-503, desbloqueio-429,
     desbloqueio-lento (espera e só então desbloqueia)
   Os apelidos daqui são de teste. Pessoa Leste e Pessoa Oeste não são gente real.

   Convite por link (PR 38 do servidor; ?cenario= na página):
   - POST /api/invites { mission_id, kind } → 201 { invite, token } (token de teste)
   - DELETE /api/invites/:id → { canceled: true }
   - POST /api/invites/preview { token } e /accept { token, mission_id? }
     (o token vai no corpo; o mock recusa token na URL)
   - convite-rival      a prévia é de Rival
   - convite-usado / convite-vencido / convite-cancelado / convite-proprio
   - convite-em-par / convite-bloqueado / convite-menor / convite-503
   - convite-cancelar-erro   o cancelamento responde 500
   Placar: /score devolve também points (10 por dia, como o PR 37).

   Isto não vale no servidor de verdade. São só atalhos deste arquivo.
   Os nomes daqui são de teste. Par Teste não é uma pessoa real. */

var http = require("http");
var crypto = require("crypto");

var PORTA = 3000;
if (/^[0-9]+$/.test(String(process.env.NEXUS_MOCK_PORTA || ""))) {
  PORTA = Number(process.env.NEXUS_MOCK_PORTA);
}
var ESPERA_LENTA_MS = 4000;
var ESPERA_MISSAO_MS = 8000;
var MS_DIA = 24 * 60 * 60 * 1000;
var emailsUsados = { "repetido@exemplo.com": true };
var nomesUsados = { repetido: true };
var usuarios = {};
var proximaMissao = 2;
var proximoUsuario = 1;

var CENARIO_POR_EMAIL = {
  "nao-registrado@exemplo.com": "nao-registrado",
  "registrado@exemplo.com": "registrado",
  "duo@exemplo.com": "duo",
  "duo-sem@exemplo.com": "duo-sem",
  "esperando@exemplo.com": "esperando",
  "vazio@exemplo.com": "vazio",
  "erro-hoje@exemplo.com": "erro",
  "recuperacao@exemplo.com": "recuperacao",
  "falta-1@exemplo.com": "falta-1",
  "falta-3@exemplo.com": "falta-3",
  "recuperacao-zero@exemplo.com": "recuperacao-zero",
  "falta-antiga@exemplo.com": "falta-antiga",
  "sem-campo@exemplo.com": "sem-campo",
  "solo@exemplo.com": "solo",
  "duo-esperando@exemplo.com": "duo-esperando",
  "duo-com-par@exemplo.com": "duo-com-par",
  "rival-placar@exemplo.com": "rival-placar",
  "convite-indisponivel@exemplo.com": "convite-indisponivel",
  "link-fake@exemplo.com": "link-fake",
  "academia@exemplo.com": "academia",
  "estudo@exemplo.com": "estudo",
  "terminada@exemplo.com": "terminada",
  "fim-30@exemplo.com": "fim-30",
  "fim-27@exemplo.com": "fim-27",
  "fim-status@exemplo.com": "fim-status",
  "extend-erro@exemplo.com": "extend-erro",
  "inativa@exemplo.com": "inativa",
  "erro-registro@exemplo.com": "erro-registro",
  "nota-servidor@exemplo.com": "nota-servidor",
  "dois-seguidos@exemplo.com": "dois-seguidos",
  "quatro-usados@exemplo.com": "quatro-usados",
  "sem-restante@exemplo.com": "sem-restante",
  "ignora-difficult@exemplo.com": "ignora-difficult",
  "so-is-difficult@exemplo.com": "so-is-difficult",
  "post-seguidos@exemplo.com": "post-seguidos",
  "post-crise@exemplo.com": "post-crise",
  "post-quatro@exemplo.com": "post-quatro",
  "quatro-e-seguidos@exemplo.com": "quatro-e-seguidos",
  "dia-livre@exemplo.com": "dia-livre",
  "semana-livre@exemplo.com": "semana-livre"
};

/* Dias da missão, como lib/mission-days.js do servidor (relógio deste processo). */
var MSG_DIAS_FORMATO = "Escolha os dias da missão de segunda (1) a domingo (7), sem repetir.";
var MSG_DIAS_MINIMO = "Escolha pelo menos 3 dias da missão por semana.";
var MSG_DIA_LIVRE = "Hoje é dia livre na sua missão, não precisa de check-in. O próximo é no dia da missão.";

function validarDias(valor) {
  if (valor === undefined || valor === null) return { ok: true, valor: null };
  if (!Array.isArray(valor) || !valor.every(function (d) { return typeof d === "number" && Math.floor(d) === d && d >= 1 && d <= 7; })) {
    return { ok: false, erro: MSG_DIAS_FORMATO };
  }
  var unicos = {};
  valor.forEach(function (d) { unicos[d] = true; });
  if (Object.keys(unicos).length !== valor.length) return { ok: false, erro: MSG_DIAS_FORMATO };
  if (valor.length < 3) return { ok: false, erro: MSG_DIAS_MINIMO };
  return { ok: true, valor: valor.slice().sort(function (a, b) { return a - b; }) };
}

function semanaDe(data) {
  var d = data.getDay();
  return d === 0 ? 7 : d;
}

/* (dia) => true quando o Dia N é dia da missão. Sem dias (ou os 7): sempre. */
function verificadorDe(missao) {
  var dias = Array.isArray(missao.mission_weekdays) ? missao.mission_weekdays : null;
  if (!dias || dias.length >= 7) return function () { return true; };
  var dia1 = semanaDe(new Date(missao.started_at));
  return function (n) {
    var semana = (((dia1 - 1 + n - 1) % 7) + 7) % 7 + 1;
    return dias.indexOf(semana) !== -1;
  };
}

function camposDosDias(missao, dia) {
  var dias = Array.isArray(missao.mission_weekdays) && missao.mission_weekdays.length < 7 ? missao.mission_weekdays : null;
  return {
    today_is_mission_day: verificadorDe(missao)(dia),
    mission_weekdays: dias
  };
}

function faixaDeDias(ate, pular) {
  var lista = [];
  var fora = {};
  var dia;
  (pular || []).forEach(function (n) { fora[n] = true; });
  for (dia = 1; dia <= ate; dia++) {
    if (!fora[dia]) lista.push(dia);
  }
  return lista;
}

var CENARIOS = {
  /* Chat (base: Duo com Ana, dia 5). */
  "chat": { dia: 5, feitos: [1, 2, 3, 4], modo: "parceiro", parNome: "Ana", parFeitos: [1, 2, 3], chat: true },
  "chat-vazio": { dia: 5, feitos: [1, 2, 3, 4], modo: "parceiro", parNome: "Ana", parFeitos: [1, 2], chat: true, chatVazio: true },
  "chat-sem-par": { dia: 5, feitos: [1, 2, 3, 4], chat: true },
  "chat-parceiro": { dia: 5, feitos: [1, 2, 3, 4], modo: "parceiro", parNome: "Ana", parFeitos: [1, 2, 3], chat: true, souParceiro: true },
  "chat-crise": { dia: 5, feitos: [1, 2, 3, 4], modo: "parceiro", parNome: "Ana", parFeitos: [1, 2], chat: true },
  "chat-429": { dia: 5, feitos: [1, 2, 3, 4], modo: "parceiro", parNome: "Ana", parFeitos: [1, 2], chat: true },
  "chat-lento": { dia: 5, feitos: [1, 2, 3, 4], modo: "parceiro", parNome: "Ana", parFeitos: [1, 2], chat: true },
  "chat-erro": { dia: 5, feitos: [1, 2, 3, 4], modo: "parceiro", parNome: "Ana", parFeitos: [1, 2], chat: true },
  "chat-503": { dia: 5, feitos: [1, 2, 3, 4], modo: "parceiro", parNome: "Ana", parFeitos: [1, 2], chat: true },
  "chat-denuncia-409": { dia: 5, feitos: [1, 2, 3, 4], modo: "parceiro", parNome: "Ana", parFeitos: [1, 2], chat: true },
  "chat-denuncia-erro": { dia: 5, feitos: [1, 2, 3, 4], modo: "parceiro", parNome: "Ana", parFeitos: [1, 2], chat: true },
  "chat-denuncia-crise": { dia: 5, feitos: [1, 2, 3, 4], modo: "parceiro", parNome: "Ana", parFeitos: [1, 2], chat: true },
  "chat-bloqueio-erro": { dia: 5, feitos: [1, 2, 3, 4], modo: "parceiro", parNome: "Ana", parFeitos: [1, 2], chat: true },
  "chat-bloqueio-503": { dia: 5, feitos: [1, 2, 3, 4], modo: "parceiro", parNome: "Ana", parFeitos: [1, 2], chat: true },
  "nao-registrado": { dia: 4, feitos: [1, 3], dificeis: [1, 2], restantes: 2 },
  registrado: { dia: 4, feitos: [1, 3, 4], dificeis: [1, 2], restantes: 2, nota: "Li a página combinada." },
  "dificil-hoje": { dia: 4, feitos: [1, 3, 4], dificeis: [2, 4], restantes: 2, nota: "Li meia página, devagar." },
  duo: { dia: 4, feitos: [1, 3], dificeis: [1, 2], restantes: 2, modo: "parceiro", parFeitos: [1, 2, 3, 4] },
  "duo-sem": { dia: 4, feitos: [1, 3], dificeis: [1, 2], restantes: 2, modo: "parceiro", parFeitos: [1, 2] },
  esperando: { dia: 4, feitos: [1, 3], dificeis: [1, 2], restantes: 2, esperando: true },
  recuperacao: { dia: 4, feitos: [1, 2], dificeis: [2], restantes: 3 },
  "falta-1": { dia: 4, feitos: [1, 2], dificeis: [2], restantes: 3 },
  "falta-3": { dia: 6, feitos: [1, 2], dificeis: [2], restantes: 3 },
  "recuperacao-zero": { dia: 8, feitos: [1, 2, 3, 4, 5, 6], dificeis: [1, 3, 5, 6], restantes: 0 },
  "recuperacao-sem-numero": { dia: 4, feitos: [1, 2], omitirDificeis: true, omitirMissedDays: true },
  "recuperacao-sem-fato": { dia: 4, feitos: [1, 2], dificeis: [2], restantes: 3, omitirMissedDays: true, omitirAntes: true, omitirOntem: true },
  "recuperacao-seguidos": {
    dia: 4,
    feitos: [1],
    dificeis: [1],
    restantes: 3,
    forcarSequencia: {
      recovery_needed: true,
      missed_yesterday: true,
      missed_days: 2,
      today_done: false,
      difficult_days: [2, 3],
      difficult_days_used: 2,
      difficult_days_remaining: 2
    }
  },
  "recuperacao-sem-minimo": { dia: 4, feitos: [1, 2], dificeis: [2], restantes: 3, minimo: "" },
  "recuperacao-minusculo": { dia: 4, feitos: [1, 2], dificeis: [2], restantes: 3, minimo: "uma página" },
  "falta-antiga": { dia: 5, feitos: [1, 2, 4], dificeis: [1], restantes: 3 },
  "recuperacao-sem-antes": { dia: 6, feitos: [1, 2], dificeis: [2], restantes: 3, omitirAntes: true },
  "recuperacao-contagem-zero": {
    dia: 4,
    feitos: [1, 2],
    dificeis: [2],
    restantes: 3,
    forcarSequencia: {
      recovery_needed: true,
      missed_yesterday: true,
      missed_days: 1,
      missed_days_before_today: 0,
      today_done: false
    }
  },
  "recuperacao-contagem-some": {
    dia: 4,
    feitos: [1, 2, 3],
    dificeis: [2],
    restantes: 3,
    forcarSequencia: {
      recovery_needed: true,
      missed_yesterday: false,
      missed_days: 0,
      missed_days_before_today: 0,
      today_done: false
    }
  },
  "recuperacao-negativo": {
    dia: 4,
    feitos: [1, 2, 3],
    dificeis: [2],
    restantes: 3,
    forcarSequencia: {
      recovery_needed: true,
      missed_yesterday: false,
      missed_days: 0,
      missed_days_before_today: -1,
      today_done: false
    }
  },
  "sem-campo": { dia: 4, feitos: [1, 3], omitirDificeis: true, ignoraDifficult: true },
  estudo: { dia: 4, feitos: [1, 3], dificeis: [1, 2], restantes: 2 },
  academia: {
    dia: 4,
    feitos: [1, 3],
    dificeis: [1, 2],
    restantes: 2,
    categoria: "fitness",
    titulo: "Treinar no horário combinado",
    minimo: "Uma série",
    porque: "Quero manter o combinado"
  },
  lento: { dia: 4, feitos: [1, 3], dificeis: [1, 2], restantes: 2, espera: true },
  "erro-registro": { dia: 4, feitos: [1, 3], dificeis: [1, 2], restantes: 2, erroPost: 500 },
  "nota-servidor": { dia: 4, feitos: [1, 3], dificeis: [1, 2], restantes: 2, erroPost: "prova" },
  repetido: { dia: 4, feitos: [1, 3], dificeis: [1, 2], restantes: 2, postJaFeito: true },
  terminada: { dia: 31, feitos: [1, 3], dificeis: [1], restantes: 3 },
  "fim-30": { dia: 31, feitos: faixaDeDias(30), dificeis: [], restantes: 4, omitirDificeis: true },
  "fim-27": { dia: 31, feitos: faixaDeDias(30, [8, 16, 24]), dificeis: [], restantes: 4, omitirDificeis: true },
  "fim-status": { dia: 12, feitos: faixaDeDias(10), status: "completed", dificeis: [], restantes: 4, omitirDificeis: true },
  "extend-erro": { dia: 31, feitos: faixaDeDias(30), dificeis: [], restantes: 4, omitirDificeis: true, erroExtend: true },
  inativa: { dia: 4, feitos: [1], dificeis: [1], restantes: 3, status: "waiting" },
  "sem-porque": { dia: 4, feitos: [1, 3], dificeis: [1, 2], restantes: 2, porque: "" },
  "dois-seguidos": { dia: 4, feitos: [1, 2, 3], dificeis: [2, 3], restantes: 2 },
  "quatro-usados": { dia: 8, feitos: [1, 3, 5, 7], dificeis: [1, 3, 5, 7], restantes: 0 },
  "sem-restante": { dia: 4, feitos: [1, 3], dificeis: [1] },
  "ignora-difficult": { dia: 4, feitos: [1, 3], dificeis: [1, 2], restantes: 2, ignoraDifficult: true },
  "so-is-difficult": { dia: 4, feitos: [1, 3], dificeis: [1, 2], restantes: 2, respostaColuna: true },
  "post-seguidos": { dia: 4, feitos: [1, 3], dificeis: [1], restantes: 3, erroPost: "seguidos" },
  "post-crise": { dia: 4, feitos: [1, 3], dificeis: [1, 2], restantes: 2, crisePost: true },
  "post-quatro": { dia: 5, feitos: [1, 3], dificeis: [1, 3], restantes: 2, erroPost: "quatro" },
  "quatro-e-seguidos": { dia: 6, feitos: [1, 2, 3, 4, 5], dificeis: [2, 3, 4, 5], restantes: 0 },
  /* diasRelativos: dias da missão contados a partir do dia da semana de hoje
     (0 = hoje). Os feitos são os dias da missão antes de hoje; o primeiro é difícil. */
  "dia-livre": { dia: 10, diasRelativos: [1, 3, 5], feitos: [], dificeis: [], restantes: 3 },
  /* Trilha de luz (prints e checagem). livres: dias que caem em dia livre
     (o mesmo dia da semana a cada 7). Sem feitos automáticos. */
  "trilha-dia1": { dia: 1, feitos: [], dificeis: [], restantes: 4 },
  "trilha-meio": { dia: 14, livres: [12], feitos: [1, 2, 3, 4, 6, 7, 8, 10, 11, 13], dificeis: [6], restantes: 3 },
  "trilha-feito": { dia: 14, livres: [12], feitos: [1, 2, 3, 4, 6, 7, 8, 10, 11, 13, 14], dificeis: [6], restantes: 3 },
  "trilha-66": {
    dia: 40,
    duracao: 66,
    feitos: [1, 2, 3, 4, 6, 7, 8, 10, 11, 13, 14, 15, 16, 17, 18, 20, 21, 22, 24, 25, 27, 28, 29, 30, 31, 32, 34, 35, 36, 37, 38, 39],
    dificeis: [6],
    restantes: 2
  },
  "dias-erro": { dia: 14, livres: [12], feitos: [1, 2, 3, 4, 6, 7, 8, 10, 11, 13], dificeis: [6], restantes: 3, erroProgresso: true },
  "duo-feito": { dia: 4, feitos: [1, 3, 4], dificeis: [1, 2], restantes: 2, modo: "parceiro", parNome: "Ana", parFeitos: [1, 2] },
  "fim-misto": { dia: 31, livres: [12], feitos: [1, 2, 3, 4, 6, 7, 8, 10, 11, 13, 14, 15, 16, 17, 18, 20, 21, 22, 24, 25, 27, 28, 29, 30], dificeis: [6, 20], restantes: 2 },
  "semana-livre": { dia: 10, diasRelativos: [0, 2, 4], feitos: [], dificeis: [], restantes: 3 },
  /* Ana é um nome de exemplo. Não é uma pessoa real. Os dias também são fictícios. */
  solo: { dia: 4, feitos: [1, 3], dificeis: [1, 2], restantes: 2 },
  "duo-esperando": { dia: 4, feitos: [1, 3], dificeis: [1, 2], restantes: 2, aguardando: "duo" },
  "duo-com-par": {
    dia: 4,
    feitos: [1, 3],
    dificeis: [1, 2],
    restantes: 2,
    modo: "parceiro",
    parNome: "Ana",
    parFeitos: [1, 2]
  },
  "rival-placar": {
    dia: 6,
    feitos: [1, 3, 5],
    dificeis: [1],
    restantes: 3,
    modo: "rival",
    parNome: "Ana",
    parFeitos: [1, 2, 3, 4, 6]
  },
  "convite-indisponivel": { dia: 4, feitos: [1, 3], dificeis: [1, 2], restantes: 2 },
  "link-fake": { dia: 4, feitos: [1, 3], dificeis: [1, 2], restantes: 2, aguardando: "duo" },
  vazio: { vazio: true },
  erro: { erro: true }
};

/* Registro feito neste processo, por e-mail e cenário. Só para o Hoje
   mostrar o dia cumprido depois do POST. Não é o banco de verdade. */
var registroDoCenario = {};
/* Dias somados por POST /extend neste processo. Não é o banco de verdade. */
var extensoes = {};

function chavePublicaVapid() {
  var par = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  var jwk = par.publicKey.export({ format: "jwk" });
  var x = Buffer.from(jwk.x, "base64url");
  var y = Buffer.from(jwk.y, "base64url");
  return Buffer.concat([Buffer.from([4]), x, y]).toString("base64url");
}

var CHAVE_PUBLICA = chavePublicaVapid();

/* ---------- Convite por link (só teste local) ---------- */
var convitesMock = [];
var CONVITE_TEXTOS = {
  criado: "Convite criado. O link vale por 7 dias e só pode ser usado uma vez.",
  usado: "Este convite já foi usado.",
  naoEncontrado: "Convite não encontrado. Confira o link.",
  vencido: "Este convite venceu. Peça um novo a quem convidou.",
  cancelado: "Este convite foi cancelado. Peça um novo a quem convidou.",
  proprio: "Você não pode aceitar o seu próprio convite.",
  emPar: "Você já está num Duo ou Rival ativo. Saia dele antes de aceitar outro convite.",
  bloqueado: "Não foi possível aceitar este convite.",
  menor: "O Duo e o Rival são só para maiores de 18 anos.",
  indisponivel: "O convite ainda não está disponível. Tente de novo mais tarde.",
  erro: "Não deu para concluir agora. Tente de novo daqui a pouco.",
  soSolo: "Só dá para convidar numa missão Solo ativa."
};

function tokenDeTeste() {
  return crypto.randomBytes(32).toString("base64url");
}

function responderConvite(req, url, corpo) {
  var acesso = autorizar(req);
  if (acesso.status !== 200) return negar(acesso);
  var cenario = nomeDoCenario(req);
  if (/token=/.test(req.url)) return { status: 400, dados: { error: "O token vai no corpo, nunca na URL." } };
  if (cenario === "convite-503") return { status: 503, dados: { error: CONVITE_TEXTOS.indisponivel } };
  var agora = Date.now();

  if (url === "/api/invites" && req.method === "POST") {
    if (!corpo || (corpo.kind !== "duo" && corpo.kind !== "rival")) return { status: 400, dados: { error: "Escolha Duo ou Rival." } };
    if (cenario === "convite-nao-solo") return { status: 409, dados: { error: CONVITE_TEXTOS.soSolo } };
    var token = tokenDeTeste();
    var convite = { id: convitesMock.length + 1, kind: corpo.kind, token: token, dono: acesso.email, expires_at: new Date(agora + 7 * MS_DIA).toISOString(), cancelado: false };
    convitesMock.push(convite);
    return { status: 201, dados: { invite: { id: convite.id, kind: convite.kind, expires_at: convite.expires_at }, token: token, message: CONVITE_TEXTOS.criado } };
  }
  var cancelar = url.match(/^\/api\/invites\/(\d+)$/);
  if (cancelar && req.method === "DELETE") {
    if (cenario === "convite-cancelar-erro") return { status: 500, dados: { error: CONVITE_TEXTOS.erro } };
    var alvo = convitesMock.find(function (c) { return String(c.id) === cancelar[1] && c.dono === acesso.email; });
    if (!alvo) return { status: 404, dados: { error: CONVITE_TEXTOS.naoEncontrado } };
    alvo.cancelado = true;
    return { status: 200, dados: { canceled: true, message: "Convite cancelado." } };
  }
  if ((url === "/api/invites/preview" || url === "/api/invites/accept") && req.method === "POST") {
    var t = corpo && typeof corpo.token === "string" ? corpo.token : "";
    if (!/^[A-Za-z0-9_-]{43}$/.test(t)) return { status: 404, dados: { error: CONVITE_TEXTOS.naoEncontrado } };
    if (cenario === "convite-usado") return { status: 409, dados: { error: CONVITE_TEXTOS.usado } };
    if (cenario === "convite-vencido") return { status: 410, dados: { error: CONVITE_TEXTOS.vencido } };
    if (cenario === "convite-cancelado") return { status: 410, dados: { error: CONVITE_TEXTOS.cancelado } };
    if (cenario === "convite-proprio") return { status: 400, dados: { error: CONVITE_TEXTOS.proprio } };
    var achado = convitesMock.find(function (c) { return c.token === t; });
    if (achado && achado.cancelado) return { status: 410, dados: { error: CONVITE_TEXTOS.cancelado } };
    var tipo = achado ? achado.kind : (cenario === "convite-rival" ? "rival" : "duo");
    if (url === "/api/invites/preview") {
      return { status: 200, dados: { invite: { kind: tipo, owner_name: "Ana", title: "Ler uma página por dia", category: "aprendizagem", expires_at: new Date(agora + 6 * MS_DIA).toISOString() } } };
    }
    if (cenario === "convite-em-par") return { status: 409, dados: { error: CONVITE_TEXTOS.emPar } };
    if (cenario === "convite-bloqueado") return { status: 403, dados: { error: CONVITE_TEXTOS.bloqueado } };
    if (cenario === "convite-menor") return { status: 403, dados: { error: CONVITE_TEXTOS.menor, code: "adult_confirmation_required", adult_confirmation_required: true } };
    if (achado) achado.cancelado = true;
    return { status: 200, dados: { accepted: true, kind: tipo, mission_id: 7, message: tipo === "rival" ? "Pronto. Vocês agora estão em Rival." : "Pronto. Vocês agora estão em Duo." } };
  }
  return { status: 404, dados: { error: "Não encontrado." } };
}

/* ---------- Chat do Duo/Rival (só teste local) ---------- */
var chatMensagens = {};
var chatBloqueados = {};
var chatDenuncias = [];
var chatProximoId = 100;
var CHAT_MOTIVOS = ["perigoso", "ofensa", "improprio", "spam", "outro"];
var CHAT_CRISE = "Sua mensagem não foi enviada. Se você está passando por um momento difícil, veja os contatos de ajuda abaixo.";

function horaDeHoje(h, m) {
  var d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

function mensagensDoChat(email, nome, usuario, pacote) {
  var chave = email + "|" + nome;
  if (!chatMensagens[chave]) {
    var spec = CENARIOS[nome] || {};
    var par = (pacote && pacote.mission && (spec.souParceiro ? pacote.mission.user_name : pacote.mission.partner_name)) || "Ana";
    chatMensagens[chave] = spec.chatVazio ? [] : [
      { id: 1, mission_id: 7, sender_name: par, content: "Li as duas páginas antes do almoço. E você?", created_at: horaDeHoje(9, 12) },
      { id: 2, mission_id: 7, sender_name: usuario.username, content: "Ainda não. Leio à noite.", created_at: horaDeHoje(9, 20) },
      { id: 3, mission_id: 7, sender_name: par, content: "Combinado. Me conta depois.", created_at: horaDeHoje(9, 21) }
    ];
  }
  return chatMensagens[chave];
}

function temParNoChat(missao) {
  return !!missao && (missao.mode === "parceiro" || missao.mode === "rival") && !!missao.partner_name && missao.status === "active";
}

function responderChat(req, url, corpo) {
  var acesso = autorizar(req);
  if (acesso.status !== 200) return negar(acesso);
  var email = acesso.email;
  var usuario = usuarios[email];
  var cenario = nomeDoCenario(req);
  var pacote = cenario && CENARIOS[cenario] ? montarCenario(cenario, usuario) : null;
  var missao = pacote && pacote.mission ? pacote.mission : null;

  if (url === "/api/messages/admin/reports" && req.method === "GET") {
    if (email !== "admin@exemplo.com") return { status: 403, dados: { error: "Esta area esta disponivel apenas para o admin." } };
    if (cenario === "equipe-chat-503") return { status: 503, dados: { error: "A moderação do chat ainda não está disponível: falta aplicar a migração 011." } };
    var exemplo = [{ id: 1, message_id: 3, excerpt: "Combinado. Me conta depois.", reason: "spam", reason_label: "Propaganda ou spam", details: null, created_at: horaDeHoje(9, 30) }];
    return { status: 200, dados: { reports: chatDenuncias.concat(exemplo) } };
  }

  var conversa = url.match(/^\/api\/messages\/(\d+)$/);
  if (conversa && req.method === "GET") {
    if (cenario === "chat-erro") return { status: 500, dados: { error: "Erro ao obter mensagens." } };
    if (cenario === "chat-503") return { status: 503, dados: { error: "Esta parte ainda não está disponível." } };
    if (!missao || String(missao.id) !== conversa[1]) return { status: 403, dados: { error: "Sem acesso a esta missao." } };
    var lista = temParNoChat(missao) ? mensagensDoChat(email, cenario, usuario, pacote) : [];
    return { status: 200, dados: { mission_id: Number(conversa[1]), messages: lista } };
  }

  if (url === "/api/messages" && req.method === "POST") {
    var conteudo = corpo && corpo.content;
    if (cenario === "chat-crise") return { status: 200, dados: { sent: false, crisis: true, crisis_level: "alto", message: CHAT_CRISE } };
    if (conteudo != null && typeof conteudo !== "string") return { status: 400, dados: { error: "A mensagem precisa ser um texto. Escreva de novo e envie." } };
    var texto = (conteudo || "").trim();
    if (!texto || !corpo.mission_id) return { status: 400, dados: { error: "mission_id e content sao obrigatorios." } };
    if (Array.from(texto).length > 280) return { status: 400, dados: { error: "A mensagem passou de 280 caracteres. Encurte um pouco e envie de novo." } };
    if (!missao || String(missao.id) !== String(corpo.mission_id)) return { status: 403, dados: { error: "Sem acesso a esta missao." } };
    if (!temParNoChat(missao)) return { status: 400, dados: { error: "A conversa só funciona enquanto o Duo ou o Rival estiver ativo." } };
    if (cenario === "chat-429") return { status: 429, dados: { error: "Você enviou muitas mensagens nesta hora. Espere um pouco e envie de novo.", limit: 20, period: "hour" } };
    var nova = { id: chatProximoId++, mission_id: missao.id, sender_name: usuario.username, content: texto, created_at: new Date().toISOString() };
    var gravar = function () {
      mensagensDoChat(email, cenario, usuario, pacote).push(nova);
      return { status: 201, dados: { message: nova } };
    };
    if (cenario === "chat-lento") return new Promise(function (r) { setTimeout(function () { r(gravar()); }, 8000); });
    return gravar();
  }

  var denuncia = url.match(/^\/api\/messages\/(\d+)\/report$/);
  if (denuncia && req.method === "POST") {
    if (cenario === "chat-denuncia-crise") return { status: 201, dados: { reported: true, crisis: true, crisis_level: "alto", message: "Sua denúncia foi registrada, sem o texto que você escreveu. Se você está passando por um momento difícil, veja os contatos de ajuda abaixo." } };
    if (!corpo || CHAT_MOTIVOS.indexOf(corpo.reason) === -1) return { status: 400, dados: { error: "Escolha um dos motivos da lista e envie de novo." } };
    if (cenario === "chat-denuncia-409") return { status: 409, dados: { error: "Você já denunciou esta mensagem. Uma denúncia por pessoa já basta, obrigado.", already_reported: true } };
    if (cenario === "chat-denuncia-erro") return { status: 500, dados: { error: "Não deu para enviar a denúncia agora. Tente de novo daqui a pouco." } };
    var alvo = (chatMensagens[email + "|" + cenario] || []).find(function (m) { return String(m.id) === denuncia[1]; });
    if (!alvo) return { status: 404, dados: { error: "Mensagem não encontrada nesta conversa." } };
    if (alvo.sender_name === usuario.username) return { status: 400, dados: { error: "Você não pode denunciar a sua própria mensagem." } };
    chatDenuncias.push({ id: chatDenuncias.length + 10, message_id: alvo.id, excerpt: alvo.content, reason: corpo.reason, details: typeof corpo.details === "string" ? corpo.details : null, created_at: new Date().toISOString() });
    return { status: 201, dados: { reported: true, message: "Obrigado. Sua denúncia foi registrada." } };
  }

  var bloqueio = url.match(/^\/api\/messages\/(\d+)\/block$/);
  if (bloqueio && req.method === "POST") {
    if (cenario === "chat-bloqueio-erro") return { status: 500, dados: { error: "Não deu para bloquear agora. Tente de novo daqui a pouco." } };
    if (cenario === "chat-bloqueio-503") return { status: 503, dados: { error: "O bloqueio ainda não está disponível. Tente de novo mais tarde." } };
    if (!missao || String(missao.id) !== bloqueio[1]) return { status: 403, dados: { error: "Sem acesso a esta missao." } };
    if (!temParNoChat(missao)) return { status: 400, dados: { error: "Você só pode bloquear a pessoa que está no seu par agora." } };
    chatBloqueados[email + "|" + cenario] = true;
    return { status: 200, dados: { blocked: true, message: "Pronto. O par foi encerrado e vocês não vão ser juntados de novo. A conversa sumiu para os dois." } };
  }
  return { status: 404, dados: { error: "Não encontrado." } };
}

function enviar(res, status, dados) {
  var corpo = JSON.stringify(dados);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Content-Length": Buffer.byteLength(corpo),
    "Cache-Control": "no-store"
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

/* Contas de teste que ainda não responderam sobre a nota (a pergunta aparece). */
function semRespostaDaNota(email) {
  return email === "primeira-vez@exemplo.com" || email === "escolha-falha@exemplo.com";
}

function garantirUsuario(email, username) {
  if (!usuarios[email]) {
    usuarios[email] = {
      id: proximoUsuario,
      email: email,
      username: username || "pessoa",
      missoes: [],
      lembrete: null,
      avisos: [],
      checkins: {},
      /* Aceite dos termos (PR 28): a maioria já aceitou a versão atual. */
      aceite: aceiteInicial(email),
      /* Nota (PR 27): true = sim, false = não, null = ainda não respondeu. */
      notaConsent: semRespostaDaNota(email) ? null : (email === "nao-guarda@exemplo.com" ? false : true),
      notaConsentEm: semRespostaDaNota(email) ? null : new Date().toISOString(),
      /* Avisos (PR 29): nada nasce ligado. */
      lembretes: null,
      lembretesEm: null,
      novidades: null,
      novidadesEm: null
    };
    proximoUsuario += 1;
  }
  return usuarios[email];
}

function tokenDe(email) {
  return "teste-local." + encodeURIComponent(email);
}

var VERSAO_TERMOS = "beta-1";
var VERSAO_PRIVACIDADE = "beta-1";
var MSG_ACEITE_CADASTRO = "Para criar a conta, marque que você leu e aceita os termos e a política de privacidade.";
var MSG_ACEITE_REACEITE = "Para continuar, marque que você leu e aceita os termos e a política de privacidade.";
/* Igual ao servidor (PR 30 do servidor): o mesmo texto do site. */
var MSG_VERSAO_ANTIGA = "Os termos ou a política de privacidade mudaram. Atualize a página (ou feche e abra o app) para ver a versão atual e aceite de novo.";
var MSG_SESSAO_ENCERRADA = "Sessão encerrada. Entre de novo.";
var MSG_SESSAO_INDISPONIVEL = "Não foi possível conferir sua sessão agora. Tente de novo em instantes.";

/* Como lib/legal-acceptance.js do servidor: só a versão atual vale. */
function conferirAceite(corpo, reaceite) {
  var termos = corpo && corpo.terms_version;
  var privacidade = corpo && corpo.privacy_version;
  var falta = function (v) { return typeof v !== "string" || !v.trim(); };
  if (falta(termos) || falta(privacidade)) {
    return { ok: false, status: 400, dados: { error: reaceite ? MSG_ACEITE_REACEITE : MSG_ACEITE_CADASTRO, code: "legal_acceptance_required" } };
  }
  if (termos !== VERSAO_TERMOS || privacidade !== VERSAO_PRIVACIDADE) {
    return { ok: false, status: 400, dados: { error: MSG_VERSAO_ANTIGA, code: "legal_version_outdated", current_terms_version: VERSAO_TERMOS, current_privacy_version: VERSAO_PRIVACIDADE } };
  }
  return { ok: true };
}

/* Contas de teste que entram sem o aceite da versão atual. */
function aceiteInicial(email) {
  if (email === "reaceitar@exemplo.com" || email === "aceite-falha@exemplo.com") return null;
  if (email === "aceite-antigo@exemplo.com") return { termos: "beta-0", privacidade: "beta-0", em: "2026-11-01T10:00:00.000Z" };
  return { termos: VERSAO_TERMOS, privacidade: VERSAO_PRIVACIDADE, em: new Date().toISOString() };
}

function legalDe(usuario) {
  var aceite = usuario.aceite || null;
  return {
    terms_version: aceite ? aceite.termos : null,
    terms_accepted_at: aceite ? aceite.em : null,
    privacy_version: aceite ? aceite.privacidade : null,
    privacy_accepted_at: aceite ? aceite.em : null,
    current_terms_version: VERSAO_TERMOS,
    current_privacy_version: VERSAO_PRIVACIDADE,
    needs_acceptance: !aceite || aceite.termos !== VERSAO_TERMOS || aceite.privacidade !== VERSAO_PRIVACIDADE
  };
}

function aceitarTermosMock(email, corpo) {
  var conferencia = conferirAceite(corpo, true);
  if (!conferencia.ok) return { status: conferencia.status, dados: conferencia.dados };
  if (email === "aceite-falha@exemplo.com") return { status: 500, dados: { error: "Não foi possível guardar seu aceite. Tente de novo." } };
  usuarios[email].aceite = { termos: VERSAO_TERMOS, privacidade: VERSAO_PRIVACIDADE, em: new Date().toISOString() };
  return { status: 200, dados: { legal: legalDe(usuarios[email]) } };
}

var excluidos = {};

function escolhaNotaDe(usuario) {
  var c = usuario.notaConsent;
  return {
    note_consent: c === true ? "yes" : (c === false ? "no" : null),
    decided_at: c == null ? null : usuario.notaConsentEm,
    version: c == null ? null : "nota-beta-1"
  };
}

function avisosDe(usuario) {
  var um = function (valor, em) {
    return { choice: valor === true ? "yes" : (valor === false ? "no" : null), decided_at: valor == null ? null : em };
  };
  return {
    reminders: um(usuario.lembretes, usuario.lembretesEm),
    news: um(usuario.novidades, usuario.novidadesEm),
    messages: um(usuario.avisosMensagem, usuario.avisosMensagemEm)
  };
}

/* Rotas de dados da pessoa (PR 26, 27 e 29). Devolve null se não é daqui. */
function responderDados(req, url, corpo) {
  var metodo = req.method;
  var nota = url === "/api/users/me/note-consent";
  var avisos = url === "/api/users/me/notification-preferences";
  var excluir = url === "/api/users/me" && metodo === "DELETE";
  if (!nota && !avisos && !excluir) return null;
  var acesso = autorizar(req);
  if (acesso.status !== 200) return negar(acesso);
  var email = acesso.email;
  var usuario = usuarios[email];
  var agora = new Date().toISOString();
  if (nota && metodo === "GET") return { status: 200, dados: escolhaNotaDe(usuario) };
  if (nota && metodo === "POST") {
    if (!corpo || corpo.consent !== true) return { status: 400, dados: { error: "Escolha não reconhecida. Toque de novo em «Sim, guardar minhas notas».", code: "consent_required" } };
    if (email === "escolha-falha@exemplo.com") return { status: 500, dados: { error: "Não foi possível guardar sua escolha. Tente de novo." } };
    usuario.notaConsent = true;
    usuario.notaConsentEm = agora;
    return { status: 200, dados: escolhaNotaDe(usuario) };
  }
  if (nota && metodo === "DELETE") {
    if (email === "escolha-falha@exemplo.com") return { status: 500, dados: { error: "Não foi possível guardar sua escolha. Tente de novo." } };
    usuario.notaConsent = false;
    usuario.notaConsentEm = agora;
    var apagadas = 0;
    Object.keys(usuario.checkins).forEach(function (id) {
      usuario.checkins[id].forEach(function (item) {
        if (item.note) { item.note = null; apagadas += 1; }
      });
    });
    var saida = escolhaNotaDe(usuario);
    saida.notes_deleted = apagadas;
    return { status: 200, dados: saida };
  }
  if (avisos && metodo === "GET") return { status: 200, dados: avisosDe(usuario) };
  if (avisos && metodo === "PUT") {
    var chaves = corpo && typeof corpo === "object" ? Object.keys(corpo) : [];
    var valido = chaves.length > 0 && chaves.every(function (k) {
      return (k === "reminders" || k === "news" || k === "messages") && typeof corpo[k] === "boolean";
    });
    if (!valido) return { status: 400, dados: { error: "Escolha não reconhecida. Toque de novo no interruptor.", code: "preferences_invalid" } };
    if (email === "avisos-falha@exemplo.com") return { status: 500, dados: { error: "Não foi possível salvar. Tente de novo." } };
    if (typeof corpo.reminders === "boolean") { usuario.lembretes = corpo.reminders; usuario.lembretesEm = agora; }
    if (typeof corpo.news === "boolean") { usuario.novidades = corpo.news; usuario.novidadesEm = agora; }
    if (typeof corpo.messages === "boolean") { usuario.avisosMensagem = corpo.messages; usuario.avisosMensagemEm = agora; }
    return { status: 200, dados: avisosDe(usuario) };
  }
  if (excluir) {
    var senha = corpo && corpo.password;
    if (email === "admin@exemplo.com") return { status: 403, dados: { error: "A conta de administração não pode ser excluída por aqui.", code: "admin_account" } };
    if (typeof senha !== "string" || !senha) return { status: 400, dados: { error: "Digite sua senha para confirmar.", code: "password_required" } };
    if (senha === "muitas") return { status: 429, dados: { error: "Muitas tentativas com a senha errada. Sua conta não foi excluída. Tente de novo em 15 minutos.", code: "too_many_attempts" } };
    if (senha === "errada") return { status: 403, dados: { error: "Senha incorreta. Sua conta não foi excluída.", code: "wrong_password" } };
    if (email === "excluir-falha@exemplo.com") return { status: 500, dados: { error: "Não foi possível excluir agora. Tente de novo." } };
    excluidos[email] = true;
    delete usuarios[email];
    delete emailsUsados[email];
    return { status: 200, dados: { deleted: true } };
  }
  return { status: 404, dados: { error: "Não encontrado." } };
}

function sessao(email, username) {
  garantirUsuario(email, username);
  return {
    token: tokenDe(email),
    user: {
      username: username || "pessoa",
      email: email,
      legal: legalDe(usuarios[email])
    }
  };
}

function autorizar(req) {
  var header = req.headers.authorization || "";
  if (!header) {
    return { status: 401, email: "", dados: { error: "Acesso negado. Token não fornecido." } };
  }
  var partes = header.split(" ");
  if (partes.length !== 2 || partes[0] !== "Bearer" || partes[1].indexOf("teste-local.") !== 0) {
    return { status: 403, email: "", dados: { error: "Token inválido ou expirado." } };
  }
  var email = "";
  try {
    email = decodeURIComponent(partes[1].slice("teste-local.".length));
  } catch (erro) {
    email = "";
  }
  if (email && excluidos[email]) {
    return { status: 401, email: "", dados: { error: MSG_SESSAO_ENCERRADA, code: "session_ended" } };
  }
  if (!email || !usuarios[email]) {
    return { status: 403, email: "", dados: { error: "Token inválido ou expirado." } };
  }
  if (email === "sessao-encerrada@exemplo.com") {
    return { status: 401, email: "", dados: { error: MSG_SESSAO_ENCERRADA, code: "session_ended" } };
  }
  if (email === "sessao-indisponivel@exemplo.com") {
    return { status: 503, email: "", dados: { error: MSG_SESSAO_INDISPONIVEL, code: "auth_unavailable" } };
  }
  return { status: 200, email: email, dados: {} };
}

function queryDe(req) {
  var i = req.url.indexOf("?");
  if (i < 0) return new URLSearchParams();
  return new URLSearchParams(req.url.slice(i + 1));
}

function nomeDoCenario(req) {
  var pedido = queryDe(req).get("cenario") || "";
  if (!/^[a-z0-9-]{1,40}$/.test(pedido)) return "";
  return pedido;
}

/* O lembrete falso só existe no desenvolvimento, como o exemplo da tela 4.
   Uma página publicada não pode receber «horário salvo» deste processo. */
function hostDoPedido(req) {
  var origem = "";
  if (req.headers && typeof req.headers.origin === "string") origem = req.headers.origin;
  if (!origem && req.headers && typeof req.headers.referer === "string") origem = req.headers.referer;
  if (!origem) return "";
  try {
    return new URL(origem).hostname;
  } catch (erro) {
    return "";
  }
}

function pedidoDeDesenvolvimento(req) {
  var host = hostDoPedido(req);
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
}

function cenarioDe(req, email) {
  var pedido = queryDe(req).get("cenario") || "";
  if (pedido && CENARIOS[pedido]) return pedido;
  if (CENARIO_POR_EMAIL[email]) return CENARIO_POR_EMAIL[email];
  return "";
}

function numeroDoDia(startedAt) {
  var inicio = new Date(startedAt);
  if (!startedAt || isNaN(inicio.getTime())) return 1;
  var dia = Math.floor((Date.now() - inicio.getTime()) / MS_DIA) + 1;
  if (dia < 1) return 1;
  return dia;
}

function calcularBrio(doneDays, todayDay, streak) {
  var completedDays = doneDays.size;
  var totalDays = Math.max(todayDay, 1);
  var consistency = Math.round((completedDays / totalDays) * 100);
  var recoveredAfterMiss = false;
  var seenMiss = false;
  var day;
  for (day = 1; day <= todayDay; day++) {
    if (doneDays.has(day)) {
      if (seenMiss) {
        recoveredAfterMiss = true;
        break;
      }
    } else {
      seenMiss = true;
    }
  }
  var consistencyPart = Math.round(consistency * 0.6);
  var streakPart = Math.min(streak * 6, 24);
  var recoveryPart = completedDays === 0 ? 0 : (recoveredAfterMiss ? 16 : 8);
  var brio = Math.min(100, consistencyPart + streakPart + recoveryPart);
  return { brio: brio, consistency: consistency, recovered: recoveredAfterMiss };
}

function calcularRecuperacao(doneDays, todayDay) {
  var missedYesterday = todayDay > 1 && !doneDays.has(todayDay - 1);
  var missedDays = 0;
  var day;
  for (day = todayDay; day >= 1; day--) {
    if (doneDays.has(day)) break;
    missedDays += 1;
  }
  var antes = 0;
  if (!doneDays.has(todayDay)) antes = Math.max(0, missedDays - 1);
  return {
    missed_yesterday: missedYesterday,
    missed_days: missedDays,
    missed_days_before_today: antes,
    recovery_needed: missedYesterday && !doneDays.has(todayDay)
  };
}

function sequenciaDe(doneDays, todayDay, extra) {
  var streak = 0;
  var d;
  for (d = todayDay; d >= 1; d--) {
    if (doneDays.has(d)) streak += 1;
    else break;
  }
  var brio = calcularBrio(doneDays, todayDay, streak);
  var recovery = calcularRecuperacao(doneDays, todayDay);
  var corpo = {
    streak: streak,
    total: doneDays.size,
    today_done: doneDays.has(todayDay),
    brio: brio.brio,
    consistency: brio.consistency,
    recovered: brio.recovered,
    missed_yesterday: recovery.missed_yesterday,
    missed_days: recovery.missed_days,
    missed_days_before_today: recovery.missed_days_before_today,
    recovery_needed: recovery.recovery_needed
  };
  if (extra && !extra.omitirDificeis) {
    var diasDificeis = extra.dificeis || [];
    corpo.difficult_days = diasDificeis;
    corpo.difficult_days_used = diasDificeis.length;
    if (typeof extra.restantes === "number") corpo.difficult_days_remaining = extra.restantes;
  }
  return corpo;
}

function novaMissao(usuario, campos) {
  var agora = campos.started_at ? new Date(campos.started_at) : new Date();
  var id = campos.id;
  if (!id) {
    id = proximaMissao;
    proximaMissao += 1;
  }
  return {
    id: id,
    user_id: usuario.id,
    partner_id: campos.partner_id || null,
    title: campos.title,
    category: campos.category,
    description: campos.description || null,
    daily_minimum: typeof campos.daily_minimum === "string" ? campos.daily_minimum : null,
    commitment_window: null,
    why_it_matters: typeof campos.why_it_matters === "string" ? campos.why_it_matters : null,
    fallback_plan: null,
    proof_mode: campos.proof_mode || "self_report",
    study_focus: null,
    study_current_stage: null,
    study_target_outcome: null,
    level: "iniciante",
    mode: campos.mode || "solo",
    match_preference: campos.match_preference || null,
    duration_days: 30,
    user_score: campos.user_score || 0,
    partner_score: campos.partner_score || 0,
    status: campos.status || "active",
    started_at: agora.toISOString(),
    partner_started_at: null,
    pair_started_at: campos.pair_started_at || null,
    ends_at: new Date(agora.getTime() + 30 * MS_DIA).toISOString(),
    merged_into_id: null,
    user_contact: null,
    partner_contact: null,
    created_at: agora.toISOString(),
    user_name: usuario.username,
    partner_name: campos.partner_name || null,
    mission_weekdays: Array.isArray(campos.mission_weekdays) ? campos.mission_weekdays : null
  };
}

function paraLista(missao) {
  return Object.assign({}, missao, {
    matching_enabled: false,
    counterpart_user_id: missao.partner_id,
    partner_mission_id: null,
    match_started_at: missao.pair_started_at || null,
    partner_last_checkin_day: null,
    partner_last_checkin_at: null
  });
}

function sequenciaDoCenario(spec, dificeis, restantes, acrescentouDificil) {
  if (spec.omitirDificeis || (!Array.isArray(spec.dificeis) && !acrescentouDificil)) {
    return { omitirDificeis: true };
  }
  var extra = { dificeis: dificeis };
  if (typeof restantes === "number") extra.restantes = restantes;
  return extra;
}

function montarCenario(nome, usuario) {
  var spec = CENARIOS[nome];
  if (!spec) return null;
  if (spec.erro) return { erro: true };
  if (spec.vazio) return { vazio: true };

  var dia = spec.dia;
  var extra = registroDoCenario[usuario.email + "|" + nome];
  var feitos = spec.feitos.slice();
  var diasDaSemana = null;
  if (Array.isArray(spec.diasRelativos)) {
    var semanaHoje = semanaDe(new Date());
    diasDaSemana = spec.diasRelativos.map(function (o) {
      return (((semanaHoje - 1 + o) % 7) + 7) % 7 + 1;
    }).sort(function (a, b) { return a - b; });
  }
  if (Array.isArray(spec.livres)) {
    var semanaDoDia1 = (((semanaDe(new Date()) - 1 - (dia - 1)) % 7) + 7) % 7 + 1;
    var foraDaMissao = spec.livres.map(function (n) { return (((semanaDoDia1 - 1 + n - 1) % 7) + 7) % 7 + 1; });
    diasDaSemana = [1, 2, 3, 4, 5, 6, 7].filter(function (w) { return foraDaMissao.indexOf(w) === -1; });
  }
  if (extra && feitos.indexOf(extra.day) === -1) feitos.push(extra.day);
  var dificeis = Array.isArray(spec.dificeis) ? spec.dificeis.slice() : [];
  if (diasDaSemana && !Array.isArray(spec.livres)) {
    var semanaDia1 = (((semanaDe(new Date()) - 1 - (dia - 1)) % 7) + 7) % 7 + 1;
    var primeiro = true;
    for (var n = 1; n < dia; n++) {
      var semanaN = (((semanaDia1 - 1 + n - 1) % 7) + 7) % 7 + 1;
      if (diasDaSemana.indexOf(semanaN) === -1) continue;
      if (feitos.indexOf(n) === -1) feitos.push(n);
      if (primeiro) {
        dificeis.push(n);
        primeiro = false;
      }
    }
  }
  var acrescentouDificil = false;
  if (!spec.omitirDificeis && extra && extra.difficult === true && dificeis.indexOf(extra.day) === -1) {
    dificeis.push(extra.day);
    acrescentouDificil = true;
  }
  var restantes = spec.restantes;
  if (acrescentouDificil && typeof restantes === "number") restantes = Math.max(0, restantes - 1);
  var notaDoDia = spec.nota || null;
  if (extra && extra.note) notaDoDia = extra.note;
  var inicio = new Date(Date.now() - (dia - 1) * MS_DIA).toISOString();
  var partner = null;
  if (spec.modo === "parceiro" || spec.modo === "rival") {
    partner = { id: usuario.id + 1000, name: spec.parNome || "Par Teste" };
  }
  var categoria = spec.categoria || "aprendizagem";

  var mission = novaMissao(usuario, {
    id: 7,
    title: spec.titulo || "Ler uma página por dia",
    category: categoria,
    daily_minimum: typeof spec.minimo === "string" ? spec.minimo : "Uma página",
    why_it_matters: spec.porque === "" ? "" : (spec.porque || "Quero ler sem traduzir"),
    proof_mode: spec.prova || (categoria === "fitness" ? "workout_proof" : "study_note"),
    mode: spec.modo || "solo",
    match_preference: spec.esperando || spec.aguardando === "duo"
      ? "parceiro"
      : (spec.modo === "parceiro" ? "parceiro" : (spec.modo === "rival" ? "rival" : null)),
    status: spec.status || (spec.esperando ? "waiting" : "active"),
    started_at: inicio,
    partner_id: partner ? partner.id : null,
    partner_name: partner ? partner.name : null,
    user_score: feitos.length,
    partner_score: (spec.parFeitos || []).length,
    pair_started_at: partner ? inicio : null
  });
  if (spec.aguardando) mission.pending_invite = spec.aguardando;
  /* Chat: depois de bloquear, o par acabou (a missão fica em Solo). */
  if (chatBloqueados[usuario.email + "|" + nome]) {
    mission.mode = "solo";
    mission.partner_id = null;
    mission.partner_name = null;
    mission.pair_started_at = null;
  } else if (spec.souParceiro && partner) {
    /* Duo na missão da outra pessoa: ela é a dona, eu sou o par. */
    mission.user_name = partner.name;
    mission.partner_name = usuario.username;
  }
  if (diasDaSemana) mission.mission_weekdays = diasDaSemana;
  if (typeof spec.duracao === "number" && isFinite(spec.duracao) && spec.duracao >= 1) {
    mission.duration_days = Math.floor(spec.duracao);
    var inicioDuracao = new Date(mission.started_at).getTime();
    if (!isNaN(inicioDuracao)) mission.ends_at = new Date(inicioDuracao + mission.duration_days * MS_DIA).toISOString();
  }
  var extraDias = extensoes[usuario.email + "|" + nome] || 0;
  if (extraDias > 0) {
    mission.duration_days += extraDias;
    var inicioMs = new Date(mission.started_at).getTime();
    if (!isNaN(inicioMs)) {
      mission.ends_at = new Date(inicioMs + mission.duration_days * MS_DIA).toISOString();
    }
    if (mission.status === "completed") mission.status = "active";
  }

  var progress = {};
  progress[String(usuario.id)] = {
    username: usuario.username,
    checkins: feitos.map(function (diaFeito) {
      var item = {
        day: diaFeito,
        completed: true,
        note: diaFeito === dia && notaDoDia ? notaDoDia : null
      };
      if (!spec.omitirDificeis && (Array.isArray(spec.dificeis) || acrescentouDificil)) {
        item.difficult = dificeis.indexOf(diaFeito) !== -1;
      }
      return item;
    })
  };
  if (partner) {
    progress[String(partner.id)] = {
      username: partner.name,
      checkins: (spec.parFeitos || []).map(function (diaFeito) {
        return { day: diaFeito, completed: true, note: null };
      })
    };
  }

  var streak = ajustarSequencia(sequenciaDe(new Set(feitos), dia, sequenciaDoCenario(spec, dificeis, restantes, acrescentouDificil)), spec);
  if (diasDaSemana) {
    /* Como o servidor: o dia livre não é falta e não pede recuperação. */
    Object.assign(streak, camposDosDias(mission, dia), {
      missed_yesterday: false,
      missed_days: 0,
      missed_days_before_today: 0,
      recovery_needed: false
    });
  }
  return {
    mission: mission,
    progress: { progress: progress },
    streak: streak,
    erroProgresso: spec.erroProgresso === true
  };
}

function ajustarSequencia(streak, spec) {
  if (spec.omitirMissedDays) delete streak.missed_days;
  if (spec.omitirAntes) delete streak.missed_days_before_today;
  if (spec.omitirOntem) delete streak.missed_yesterday;
  if (spec.forcarSequencia) {
    Object.keys(spec.forcarSequencia).forEach(function (chave) {
      streak[chave] = spec.forcarSequencia[chave];
    });
  }
  return streak;
}

function acharMissao(email, id) {
  var lista = usuarios[email].missoes;
  for (var i = 0; i < lista.length; i++) {
    if (String(lista[i].id) === String(id)) return lista[i];
  }
  return null;
}

function progressoGuardado(email, id) {
  var usuario = usuarios[email];
  var lista = usuario.checkins[id] || [];
  var progress = {};
  if (lista.length) {
    progress[String(usuario.id)] = {
      username: usuario.username,
      checkins: lista.map(function (item) {
        var saida = {
          day: item.day,
          completed: item.completed === true,
          note: item.note || null
        };
        if (item.difficult === true) saida.difficult = true;
        return saida;
      })
    };
  }
  return { progress: progress };
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
  /* Caso negado do site: 403 sem o campo under_age (a tela tem de mostrar a do menor). */
  if (email === "menor-sem-campo@exemplo.com") {
    return { status: 403, dados: { error: MSG_MENOR } };
  }
  var idade = conferirIdade(corpo.birth_date);
  if (!idade.ok) return { status: idade.status, dados: idade.dados };
  /* Aceite depois da idade, como no servidor (PR 28). Nada é criado sem ele. */
  var aceite = conferirAceite(corpo, false);
  if (!aceite.ok) return { status: aceite.status, dados: aceite.dados };
  if (email === "termos-mudaram@exemplo.com") {
    return { status: 400, dados: { error: MSG_VERSAO_ANTIGA, code: "legal_version_outdated", current_terms_version: VERSAO_TERMOS, current_privacy_version: VERSAO_PRIVACIDADE } };
  }
  if (emailsUsados[email] || nomesUsados[username]) {
    return { status: 400, dados: { error: "Email ou username já está em uso." } };
  }
  if (email === "falha@exemplo.com") {
    return { status: 500, dados: { error: "Erro interno." } };
  }
  if (email === "sem-migracao@exemplo.com") {
    return { status: 503, dados: { error: "Não deu para criar a conta agora. Tente de novo mais tarde." } };
  }
  emailsUsados[email] = true;
  nomesUsados[username] = true;
  var criada = sessao(email, username);
  /* Conta nova: como no servidor, ainda sem resposta sobre a nota. */
  usuarios[email].notaConsent = null;
  usuarios[email].notaConsentEm = null;
  return { status: 201, dados: criada };
}

/* Como lib/adult-age.js do servidor: a data só é conferida, nunca guardada. */
var MSG_DATA_FALTA = "Falta a data de nascimento. Preencha e envie de novo.";
var MSG_DATA_INVALIDA = "A data de nascimento não parece certa. Use o formato dia, mês e ano e envie de novo.";
var MSG_MENOR = "O Nexus é só para maiores de 18 anos, por isso não dá para criar a conta agora. Nada do que você escreveu foi guardado.";

function conferirIdade(valor, agora) {
  if (valor === undefined || valor === null || valor === "") {
    return { ok: false, status: 400, dados: { error: MSG_DATA_FALTA } };
  }
  var m = typeof valor === "string" ? valor.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  if (!m) return { ok: false, status: 400, dados: { error: MSG_DATA_INVALIDA } };
  var ano = Number(m[1]);
  var mes = Number(m[2]);
  var dia = Number(m[3]);
  var data = new Date(Date.UTC(ano, mes - 1, dia));
  if (data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) {
    return { ok: false, status: 400, dados: { error: MSG_DATA_INVALIDA } };
  }
  /* Hoje no fuso mais atrasado (UTC-12): ninguém faz 18 antes da hora. */
  var hoje = new Date((typeof agora === "number" ? agora : Date.now()) - 12 * 60 * 60 * 1000);
  var hojeUtc = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate());
  if (data.getTime() > hojeUtc) return { ok: false, status: 400, dados: { error: MSG_DATA_INVALIDA } };
  /* Date.UTC leva 29/02 de ano não bissexto para 01/03. */
  var dezoito = Date.UTC(ano + 18, mes - 1, dia);
  if (dezoito > hojeUtc) return { ok: false, status: 403, dados: { error: MSG_MENOR, under_age: true } };
  return { ok: true };
}

function listarMissoes(email) {
  return { status: 200, dados: usuarios[email].missoes.map(paraLista) };
}

async function criarMissao(email, corpo) {
  var title = typeof corpo.title === "string" ? corpo.title.trim() : "";
  var category = typeof corpo.category === "string" ? corpo.category.trim() : "";
  if (!title || !category) {
    return { status: 400, dados: { error: "Titulo e categoria sao obrigatorios." } };
  }
  if (title === "falha") {
    return { status: 500, dados: { error: "Erro ao criar missao." } };
  }
  var temDias = corpo.mission_weekdays !== undefined && corpo.mission_weekdays !== null;
  var dias = validarDias(corpo.mission_weekdays);
  if (!dias.ok) return { status: 400, dados: { error: dias.erro } };
  if (temDias && title === "sem-migracao") {
    return { status: 503, dados: { error: "A escolha dos dias da missão ainda não está disponível. Crie a missão sem escolher os dias ou tente mais tarde." } };
  }
  if (temDias && title === "dias-servidor") {
    return { status: 400, dados: { error: MSG_DIAS_MINIMO } };
  }
  if (title === "lento") {
    await new Promise(function (resolver) {
      setTimeout(resolver, ESPERA_MISSAO_MS);
    });
  }
  var mission = novaMissao(usuarios[email], {
    title: title,
    category: category,
    daily_minimum: typeof corpo.daily_minimum === "string" ? corpo.daily_minimum : null,
    why_it_matters: typeof corpo.why_it_matters === "string" ? corpo.why_it_matters : null,
    proof_mode: typeof corpo.proof_mode === "string" && corpo.proof_mode ? corpo.proof_mode : "self_report",
    mode: "solo",
    status: "active",
    mission_weekdays: dias.valor
  });
  usuarios[email].missoes.unshift(mission);
  return {
    status: 201,
    dados: {
      mission: mission,
      matched: false,
      matchedWith: null,
      matchingEnabled: false,
      message: "Missao solo criada."
    }
  };
}

function inscrever(email, corpo) {
  var sub = corpo && corpo.subscription;
  if (!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
    return { status: 400, dados: { error: "Subscricao invalida." } };
  }
  usuarios[email].avisos.push({
    endpoint: sub.endpoint,
    keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }
  });
  return { status: 200, dados: { success: true, message: "Notificacoes ativadas." } };
}

async function salvarLembrete(email, corpo, cenario) {
  if (cenario === "lembrete-erro") {
    return { status: 500, dados: { error: "Não foi possível salvar o horário." } };
  }
  if (cenario === "lembrete-lento") {
    await new Promise(function (resolver) {
      setTimeout(resolver, ESPERA_MISSAO_MS);
    });
  }
  var hora = typeof corpo.reminder_time === "string" ? corpo.reminder_time : "";
  var fuso = typeof corpo.timezone === "string" ? corpo.timezone.trim() : "";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora) || !fuso) {
    return { status: 400, dados: { error: "Horário inválido." } };
  }
  usuarios[email].lembrete = { reminder_time: hora, timezone: fuso };
  return { status: 200, dados: { reminder_time: hora, timezone: fuso } };
}

var MSG_LIMITE_DIFICIL = "Você já usou os 4 dias difíceis desta missão.";
var MSG_SEGUIDOS_DIFICIL = "Não dá para ter mais de 2 dias difíceis seguidos.";
var MSG_MINIMO_DIFICIL = "Para marcar o dia difícil, confirme que fez o mínimo do contrato e tente de novo.";

function checkinDeResposta(id, email, dia, noteLimpa, querDificil, spec) {
  var checkin = {
    id: 1,
    mission_id: Number(id),
    user_id: usuarios[email].id,
    day_number: dia,
    completed: true,
    note: noteLimpa,
    created_at: new Date().toISOString()
  };
  if (querDificil && spec && spec.respostaColuna) checkin.is_difficult = true;
  else if (querDificil) checkin.difficult = true;
  return checkin;
}

function erroDeDificil(email, id, cenario, spec, dia) {
  var dias = [];
  function por(n) {
    if (!isFinite(n) || n === dia || dias.indexOf(n) !== -1) return;
    dias.push(n);
  }
  if (spec && Array.isArray(spec.dificeis) && !spec.omitirDificeis) {
    spec.dificeis.forEach(function (item) { por(Number(item)); });
  }
  var extra = cenario ? registroDoCenario[email + "|" + cenario] : null;
  if (extra && extra.difficult === true) por(Number(extra.day));
  if (!spec) {
    var lista = usuarios[email].checkins[String(id)] || [];
    lista.forEach(function (item) {
      if (item.difficult === true) por(Number(item.day));
    });
  }
  if (dias.length >= 4) return MSG_LIMITE_DIFICIL;
  if (dias.indexOf(dia - 1) !== -1 && dias.indexOf(dia - 2) !== -1) return MSG_SEGUIDOS_DIFICIL;
  return "";
}

function erroDeProva(proof, note) {
  var text = typeof note === "string" ? note.trim() : "";
  if (proof === "workout_proof" && text.length < 8) {
    return "Esta missao exige uma prova curta antes do check-in.";
  }
  if (proof === "study_note" && text.length < 12) {
    return "Esta missao de estudo exige uma nota curta com o que estudaste hoje.";
  }
  if (proof === "artifact_note" && text.length < 12) {
    return "Esta missao exige um registo curto do que produziste hoje.";
  }
  if (proof === "text_note" && text.length < 8) {
    return "Esta missao exige uma nota curta antes do check-in.";
  }
  return "";
}

var LIMITE_NOTA = 280;
var MSG_NOTA_LONGA = "A frase passou de 280 caracteres. Encurte um pouco e envie de novo.";

async function registrarCheckin(email, corpo, cenario) {
  var id = corpo && corpo.mission_id;
  if (!id) return { status: 400, dados: { error: "mission_id é obrigatório." } };
  var spec = cenario && CENARIOS[cenario] ? CENARIOS[cenario] : null;
  if (spec && spec.erroPost === 500) {
    return { status: 500, dados: { error: "Erro ao registar check-in." } };
  }
  if (spec && spec.erroPost === "prova") {
    return { status: 400, dados: { error: "Esta missao de estudo exige uma nota curta com o que estudaste hoje." } };
  }
  if (spec && spec.erroPost === "seguidos") {
    return { status: 400, dados: { error: MSG_SEGUIDOS_DIFICIL } };
  }
  if (spec && spec.erroPost === "quatro") {
    return { status: 400, dados: { error: MSG_LIMITE_DIFICIL } };
  }
  if (spec && spec.espera) {
    await new Promise(function (resolver) {
      setTimeout(resolver, ESPERA_MISSAO_MS);
    });
  }

  var pacote = cenario ? montarCenario(cenario, usuarios[email]) : null;
  var missao = pacote && pacote.mission ? pacote.mission : acharMissao(email, id);
  if (!missao || String(missao.id) !== String(id)) {
    return { status: 404, dados: { error: "Missão não encontrada." } };
  }
  if (missao.status !== "active") {
    return { status: 400, dados: { error: "Missão não está ativa." } };
  }
  var nota = typeof corpo.note === "string" ? corpo.note : "";
  /* Igual ao servidor: o dia difícil pede minimum_done: true (o toque
     «Fiz o mínimo») e não pede a prova escrita. O check-in comum pede. */
  var pedeDificil = corpo && corpo.difficult === true;
  if (pedeDificil && corpo.minimum_done !== true) {
    return { status: 400, dados: { error: MSG_MINIMO_DIFICIL } };
  }
  var crise = !!(spec && spec.crisePost);
  /* Como no servidor: mais de 280 caracteres reais dá 400, mas o filtro
     de crise vem antes (nota com crise não chega a este limite). */
  if (!crise && Array.from(nota).length > LIMITE_NOTA) {
    return { status: 400, dados: { error: MSG_NOTA_LONGA } };
  }
  /* Como no servidor: com crise, a prova escrita não é exigida. */
  var prova = (pedeDificil || crise) ? null : erroDeProva(missao.proof_mode, nota);
  if (prova) return { status: 400, dados: { error: prova } };
  var dia = numeroDoDia(missao.started_at);
  if (dia > missao.duration_days) {
    return { status: 400, dados: { error: "A missão já terminou." } };
  }
  /* Como o servidor (PR 16): num dia livre, comum ou difícil, nada é gravado. */
  if (!verificadorDe(missao)(dia)) {
    var livre = { error: MSG_DIA_LIVRE, free_day: true };
    if (crise) livre.crisis = true;
    return { status: 400, dados: livre };
  }
  var querDificil = corpo && corpo.difficult === true && !(spec && spec.ignoraDifficult);
  if (querDificil) {
    var bloqueio = erroDeDificil(email, id, cenario, spec, dia);
    if (bloqueio) return { status: 400, dados: { error: bloqueio } };
  }

  var already = false;
  if (spec && spec.postJaFeito) already = true;
  else if (pacote && pacote.streak && pacote.streak.today_done) already = true;
  else {
    var lista = usuarios[email].checkins[String(id)] || [];
    already = lista.some(function (item) {
      return Number(item.day) === dia && item.completed === true;
    });
  }

  /* Como no servidor: com crise, a nota não é guardada; sem o «sim» da
     pessoa (PR 27), também não. */
  var noteLimpa = !crise && nota.trim() && usuarios[email].notaConsent === true ? nota.trim() : null;
  if (!pacote) {
    if (!usuarios[email].checkins[String(id)]) usuarios[email].checkins[String(id)] = [];
    var guardados = usuarios[email].checkins[String(id)];
    var achei = false;
    guardados.forEach(function (item) {
      if (Number(item.day) === dia) {
        item.completed = true;
        item.note = noteLimpa;
        if (querDificil) item.difficult = true;
        achei = true;
      }
    });
    if (!achei) guardados.push({ day: dia, completed: true, note: noteLimpa, difficult: querDificil });
  }
  if (cenario) {
    registroDoCenario[email + "|" + cenario] = { day: dia, note: noteLimpa, difficult: querDificil };
  }

  var resposta = {
    checkin: checkinDeResposta(id, email, dia, noteLimpa, querDificil, spec),
    day: dia,
    already_done: already,
    note_saved: noteLimpa !== null,
    message: already ? ("Dia " + dia + " já estava registado!") : ("Dia " + dia + " registado! 🔥")
  };
  if (crise) {
    resposta.crisis = true;
    resposta.crisis_level = "alto";
  }
  return { status: 201, dados: resposta };
}

function contarFeitos(checkins) {
  var n = 0;
  (checkins || []).forEach(function (item) {
    if (item && item.completed === true) n += 1;
  });
  return n;
}

function grupoDoProgresso(progresso, id) {
  if (!progresso || !progresso.progress || id == null) return null;
  return progresso.progress[String(id)] || null;
}

function diasDoGrupo(progresso, id) {
  var grupo = grupoDoProgresso(progresso, id);
  if (!grupo) return 0;
  return contarFeitos(grupo.checkins);
}

function sequenciaAtual(checkins, dia) {
  var feitos = {};
  (checkins || []).forEach(function (item) {
    if (item && item.completed === true) feitos[item.day] = true;
  });
  var streak = 0;
  var d;
  for (d = dia; d >= 1; d--) {
    if (feitos[d]) streak += 1;
    else break;
  }
  return streak;
}

/* A mesma forma da rota de verdade. A chave null vira a string "null". */
function corpoDoPlacar(missao, progresso, email) {
  var usuario = usuarios[email];
  var diasDono = diasDoGrupo(progresso, missao.user_id);
  var diasPar = missao.partner_id ? diasDoGrupo(progresso, missao.partner_id) : 0;
  var scores = {};
  scores[missao.user_name == null ? "null" : String(missao.user_name)] = diasDono;
  scores[missao.partner_name == null ? "null" : String(missao.partner_name)] = diasPar;
  var meus = grupoDoProgresso(progresso, usuario.id);
  var leader = "Empate!";
  if (diasDono > diasPar) leader = missao.user_name;
  else if (diasPar > diasDono) leader = missao.partner_name;
  /* Pontos do Rival (PR 37): 10 por dia cumprido. */
  var points = {};
  Object.keys(scores).forEach(function (k) { points[k] = scores[k] * 10; });
  return {
    mission_id: missao.id,
    mode: missao.mode,
    scores: scores,
    points: points,
    points_per_day: 10,
    leader: leader,
    my_streak: sequenciaAtual(meus && meus.checkins, numeroDoDia(missao.started_at))
  };
}

function abandonarMissaoMock(email, id, cenario) {
  var pacote = cenario ? montarCenario(cenario, usuarios[email]) : null;
  var missao = null;
  if (pacote && pacote.mission && String(pacote.mission.id) === String(id)) missao = pacote.mission;
  else if (!pacote || pacote.vazio || pacote.erro) missao = acharMissao(email, id);
  if (pacote && pacote.mission && String(pacote.mission.id) !== String(id)) missao = null;
  if (!missao || String(missao.id) !== String(id) || missao.status !== "active") {
    return { status: 404, dados: { error: "Missao ativa nao encontrada." } };
  }
  var usuario = usuarios[email];
  var temPar = missao.partner_id && missao.mode !== "solo";
  if (!temPar) {
    if (missao.user_id !== usuario.id) {
      return { status: 403, dados: { error: "Nao autorizado para encerrar esta missao." } };
    }
    missao.status = "abandoned";
    missao.ends_at = new Date().toISOString();
    return { status: 200, dados: { success: true, message: "Missao solo encerrada." } };
  }
  if (missao.partner_id === usuario.id) {
    missao.partner_id = null;
    missao.partner_name = null;
    missao.mode = "solo";
  } else if (missao.user_id === usuario.id) {
    missao.user_id = missao.partner_id;
    missao.user_name = missao.partner_name;
    missao.partner_id = null;
    missao.partner_name = null;
    missao.mode = "solo";
  } else {
    return { status: 403, dados: { error: "Nao autorizado para encerrar esta missao." } };
  }
  return {
    status: 200,
    dados: { success: true, message: "Saíste da missão. A outra pessoa continua em solo." }
  };
}

function estenderMissao(email, id, corpo, cenario) {
  if (!corpo || Number(corpo.days) !== 36) {
    return { status: 400, dados: { error: "Dias inválidos." } };
  }
  if (cenario === "extend-erro") {
    return { status: 500, dados: { error: "Não foi possível abrir os próximos 36 dias." } };
  }
  var spec = cenario && CENARIOS[cenario] ? CENARIOS[cenario] : null;
  var pacote = spec ? montarCenario(cenario, usuarios[email]) : null;
  var missao = pacote && pacote.mission ? pacote.mission : acharMissao(email, id);
  if (!missao || String(missao.id) !== String(id)) {
    return { status: 404, dados: { error: "Missão não encontrada." } };
  }
  if (!pacote) {
    missao.duration_days = Number(missao.duration_days) + 36;
    var inicioMs = new Date(missao.started_at).getTime();
    if (!isNaN(inicioMs)) {
      missao.ends_at = new Date(inicioMs + missao.duration_days * MS_DIA).toISOString();
    }
    if (missao.status === "completed") missao.status = "active";
    return { status: 200, dados: { mission: missao, days: 36 } };
  }
  extensoes[email + "|" + cenario] = (extensoes[email + "|" + cenario] || 0) + 36;
  var deNovo = montarCenario(cenario, usuarios[email]);
  return { status: 200, dados: { mission: deNovo.mission, days: 36 } };
}

var bloqueiosPorPessoa = {};
var donoDoBloqueio = {};
var proximoIdBloqueio = 1001;

function criarBloqueio(email, username, createdAt) {
  var id = proximoIdBloqueio;
  proximoIdBloqueio += 1;
  donoDoBloqueio[String(id)] = email;
  return { block_id: id, username: username, created_at: createdAt };
}

function listaDeBloqueios(email) {
  if (!bloqueiosPorPessoa[email]) {
    bloqueiosPorPessoa[email] = [
      criarBloqueio(email, "Pessoa Leste", "2026-11-23T12:00:00.000Z"),
      criarBloqueio(email, "Pessoa Oeste", "2026-11-02T12:00:00.000Z")
    ];
  }
  return bloqueiosPorPessoa[email];
}

function publicoBloqueio(item) {
  return { block_id: item.block_id, username: item.username, created_at: item.created_at };
}

function copiaDeBloqueios(email) {
  return listaDeBloqueios(email).map(publicoBloqueio).sort(function (a, b) {
    return String(b.created_at).localeCompare(String(a.created_at));
  }).slice(0, 100);
}

function removerMeuBloqueio(email, id) {
  if (donoDoBloqueio[String(id)] !== email) return;
  var lista = bloqueiosPorPessoa[email] || [];
  bloqueiosPorPessoa[email] = lista.filter(function (item) {
    return String(item.block_id) !== String(id);
  });
  delete donoDoBloqueio[String(id)];
}

function esperarBloqueio(resultado) {
  return new Promise(function (resolver) {
    setTimeout(function () { resolver(resultado); }, 8000);
  });
}

/* Lista e desbloqueio. Só em localhost, 127.0.0.1 e [::1].
   Fora disso responde 404 e não mexe na lista. */
function responderBloqueios(req, url) {
  if (!pedidoDeDesenvolvimento(req)) {
    return { status: 404, dados: { error: "Não encontrado." } };
  }
  var acesso = autorizar(req);
  if (acesso.status !== 200) return negar(acesso);
  var cenario = nomeDoCenario(req);
  var email = acesso.email;
  if (req.method === "GET" && url === "/api/users/me/blocks") {
    if (cenario === "bloqueados-erro") return { status: 500, dados: { error: "Não foi possível abrir a lista." } };
    if (cenario === "bloqueados-503") return { status: 503, dados: { error: "Esta parte ainda não está disponível." } };
    if (cenario === "bloqueados-429") return { status: 429, dados: { error: "Você pediu a lista muitas vezes. Espere um pouco e tente de novo." } };
    if (cenario === "bloqueados-vazio") return { status: 200, dados: { blocks: [] } };
    var lista = { status: 200, dados: { blocks: copiaDeBloqueios(email) } };
    if (cenario === "bloqueados-lento") return esperarBloqueio(lista);
    return lista;
  }
  var apagar = url.match(/^\/api\/users\/me\/blocks\/([^/]+)$/);
  if (apagar && req.method === "DELETE") {
    var id = "";
    try { id = decodeURIComponent(apagar[1]); } catch (erroId) { id = ""; }
    if (!/^[1-9]\d{0,17}$/.test(id)) return { status: 400, dados: { error: "Identificador inválido." } };
    if (cenario === "desbloqueio-erro" || cenario === "bloqueados-erro") {
      return { status: 500, dados: { error: "Não foi possível desbloquear agora." } };
    }
    if (cenario === "desbloqueio-503" || cenario === "bloqueados-503") {
      return { status: 503, dados: { error: "O desbloqueio ainda não está disponível." } };
    }
    if (cenario === "desbloqueio-429" || cenario === "bloqueados-429") {
      return { status: 429, dados: { error: "Você tentou desbloquear muitas vezes. Espere um pouco e tente de novo." } };
    }
    if (cenario === "desbloqueio-lento") {
      return new Promise(function (resolver) {
        setTimeout(function () {
          removerMeuBloqueio(email, id);
          resolver({ status: 200, dados: { unblocked: true } });
        }, 8000);
      });
    }
    removerMeuBloqueio(email, id);
    return { status: 200, dados: { unblocked: true } };
  }
  return { status: 404, dados: { error: "Não encontrado." } };
}

function negar(acesso) {
  return { status: acesso.status, dados: acesso.dados };
}

function responderHoje(req, res, email) {
  var caminho = req.url.split("?")[0];
  var cenario = cenarioDe(req, email);
  var pacote = cenario ? montarCenario(cenario, usuarios[email]) : null;

  if (caminho === "/api/missions") {
    if (pacote && pacote.erro) {
      enviar(res, 500, { error: "Erro ao listar missoes." });
      return true;
    }
    if (pacote && pacote.vazio) {
      enviar(res, 200, []);
      return true;
    }
    if (pacote) {
      enviar(res, 200, [paraLista(pacote.mission)]);
      return true;
    }
    var lista = listarMissoes(email);
    enviar(res, lista.status, lista.dados);
    return true;
  }

  var missao = caminho.match(/^\/api\/missions\/(\d+)$/);
  if (missao) {
    if (pacote && pacote.erro) {
      enviar(res, 500, { error: "Erro ao obter missao." });
      return true;
    }
    if (pacote && pacote.vazio) {
      enviar(res, 404, { error: "Missao nao encontrada." });
      return true;
    }
    if (pacote) {
      if (String(pacote.mission.id) !== missao[1]) {
        enviar(res, 404, { error: "Missao nao encontrada." });
        return true;
      }
      enviar(res, 200, pacote.mission);
      return true;
    }
    var achada = acharMissao(email, missao[1]);
    if (!achada) {
      enviar(res, 404, { error: "Missao nao encontrada." });
      return true;
    }
    enviar(res, 200, achada);
    return true;
  }

  var sequencia = caminho.match(/^\/api\/checkins\/(\d+)\/streak$/);
  if (sequencia) {
    if (pacote && pacote.erro) {
      enviar(res, 500, { error: "Erro ao calcular sequência." });
      return true;
    }
    if (pacote && !pacote.vazio) {
      if (String(pacote.mission.id) !== sequencia[1]) {
        enviar(res, 404, { error: "Missão não encontrada." });
        return true;
      }
      enviar(res, 200, pacote.streak);
      return true;
    }
    var missaoSeq = acharMissao(email, sequencia[1]);
    if (!missaoSeq) {
      enviar(res, 404, { error: "Missão não encontrada." });
      return true;
    }
    var feitos = new Set();
    var dificeisGuardados = [];
    (usuarios[email].checkins[sequencia[1]] || []).forEach(function (item) {
      if (item.completed === true) feitos.add(Number(item.day));
      if (item.difficult === true) dificeisGuardados.push(Number(item.day));
    });
    var extraSeq = null;
    if (dificeisGuardados.length) {
      extraSeq = {
        dificeis: dificeisGuardados,
        restantes: Math.max(0, 4 - dificeisGuardados.length)
      };
    }
    var diaSeq = numeroDoDia(missaoSeq.started_at);
    enviar(res, 200, Object.assign(sequenciaDe(feitos, diaSeq, extraSeq), camposDosDias(missaoSeq, diaSeq)));
    return true;
  }

  var placar = caminho.match(/^\/api\/checkins\/(\d+)\/score$/);
  if (placar) {
    if (pacote && pacote.erro) {
      enviar(res, 500, { error: "Erro ao obter placar." });
      return true;
    }
    var missaoPlacar = pacote && pacote.mission ? pacote.mission : acharMissao(email, placar[1]);
    if (!missaoPlacar || String(missaoPlacar.id) !== placar[1]) {
      enviar(res, 404, { error: "Missão não encontrada." });
      return true;
    }
    var progressoPlacar = pacote && pacote.progress ? pacote.progress : progressoGuardado(email, placar[1]);
    enviar(res, 200, corpoDoPlacar(missaoPlacar, progressoPlacar, email));
    return true;
  }

  var progresso = caminho.match(/^\/api\/checkins\/(\d+)$/);
  if (progresso) {
    if (pacote && (pacote.erro || pacote.erroProgresso)) {
      enviar(res, 500, { error: "Erro ao obter progresso." });
      return true;
    }
    if (pacote && !pacote.vazio) {
      if (String(pacote.mission.id) !== progresso[1]) {
        enviar(res, 404, { error: "Missão não encontrada." });
        return true;
      }
      enviar(res, 200, pacote.progress);
      return true;
    }
    if (!acharMissao(email, progresso[1])) {
      enviar(res, 404, { error: "Missão não encontrada." });
      return true;
    }
    enviar(res, 200, progressoGuardado(email, progresso[1]));
    return true;
  }

  return false;
}

/* ---------- Comunidade, denúncia e área da equipe (PR 18 do servidor) ---------- */

var MSG_IDADE = "A comunidade é só para maiores de 18 anos. Confirme sua idade para entrar, ler, publicar ou denunciar.";
var MSG_SO_ADMIN = "Esta area esta disponivel apenas para o admin.";
var MOTIVOS_DENUNCIA = ["perigoso", "ofensa", "improprio", "spam", "outro"];
var EMAIL_ADMIN = "admin@exemplo.com";
var POST_DA_PESSOA = 50;
var COMUNIDADES = [
  { id: 1, slug: "ingles-diario", name: "Inglês todo dia", category: "aprendizagem" },
  { id: 2, slug: "academia-cedo", name: "Academia cedo", category: "fitness" }
];
/* Nomes de teste, não são pessoas reais. */
var POSTS_DE_TESTE = [
  { id: 11, community_id: 1, user_id: 901, username: "caderno_azul", content: "Hoje li duas páginas sem traduzir. A segunda foi mais fácil que a primeira.", horas: 3 },
  { id: 12, community_id: 1, user_id: 902, username: "leitura_lenta", content: "Dica que me ajudou: deixar o livro aberto em cima da mesa antes de dormir.", horas: 20 },
  { id: 13, community_id: 2, user_id: 903, username: "treino_cedo", content: "Fui às 7h. Só o mínimo, mas fui.", horas: 5 }
];
var denunciasFeitas = {};
var escondidosDaEquipe = null;

function escondidosIniciais() {
  var agora = Date.now();
  return [
    {
      id: 21, community_id: 1, community_slug: "ingles-diario", user_id: 904, username: "conta_teste_a",
      content: "Para estudar mais, fique sem comer o dia inteiro. Comigo funcionou.",
      created_at: new Date(agora - 6 * 3600000).toISOString(),
      hidden_at: new Date(agora - 2 * 3600000).toISOString(), hidden_reason: "perigoso",
      reports: [
        { reason: "perigoso", details: "Isso pode fazer mal a quem ler.", created_at: new Date(agora - 2 * 3600000).toISOString() }
      ],
      priority: "alta", repeat_reporter_alert: true, hidden_reason_label: "Conselho perigoso para a saúde"
    },
    {
      id: 22, community_id: 2, community_slug: "academia-cedo", user_id: 905, username: "conta_teste_b",
      content: "Compre o meu curso no link do perfil, desconto só hoje.",
      created_at: new Date(agora - 30 * 3600000).toISOString(),
      hidden_at: new Date(agora - 26 * 3600000).toISOString(), hidden_reason: "spam",
      reports: [
        { reason: "spam", details: null, created_at: new Date(agora - 28 * 3600000).toISOString() },
        { reason: "spam", details: "Propaganda.", created_at: new Date(agora - 27 * 3600000).toISOString() },
        { reason: "outro", details: null, created_at: new Date(agora - 26 * 3600000).toISOString() }
      ],
      priority: "normal", repeat_reporter_alert: false, hidden_reason_label: "Propaganda ou spam"
    }
  ];
}

function ehAdulto(email) {
  var usuario = usuarios[email];
  return !!usuario && usuario.adulto !== false && email !== "sem-idade@exemplo.com";
}

function corpoSemIdade() {
  return { error: MSG_IDADE, code: "adult_confirmation_required", adult_confirmation_required: true };
}

function comunidadePorSlug(slug) {
  for (var i = 0; i < COMUNIDADES.length; i++) {
    if (COMUNIDADES[i].slug === slug) return COMUNIDADES[i];
  }
  return null;
}

function postsDaComunidade(comunidade, email) {
  var usuario = usuarios[email];
  var agora = Date.now();
  var lista = [];
  /* O post 50 é de quem está logado. */
  var meu = {
    id: POST_DA_PESSOA, community_id: comunidade.id, user_id: usuario.id, username: usuario.username,
    content: "Meu dia 4: fiz o mínimo e anotei duas palavras novas.",
    created_at: new Date(agora - 3600000).toISOString(), hidden: false
  };
  if (email === "autor@exemplo.com") {
    meu.hidden = true;
    meu.hidden_reason = "perigoso";
    meu.hidden_reason_label = "Conselho perigoso para a saúde";
    meu.hidden_message = "Seu post foi escondido por enquanto, até a equipe conferir.";
  }
  lista.push(meu);
  POSTS_DE_TESTE.forEach(function (post) {
    if (post.community_id !== comunidade.id) return;
    lista.push({
      id: post.id, community_id: post.community_id, user_id: post.user_id, username: post.username,
      content: post.content, created_at: new Date(agora - post.horas * 3600000).toISOString(), hidden: false
    });
  });
  return lista;
}

function acharPost(comunidade, postId, email) {
  var lista = postsDaComunidade(comunidade, email);
  for (var i = 0; i < lista.length; i++) {
    if (String(lista[i].id) === String(postId)) return lista[i];
  }
  return null;
}

async function denunciarMock(email, slug, postId, corpo, cenario) {
  var motivo = corpo && corpo.reason;
  var crise = cenario === "denuncia-crise" || cenario === "denuncia-crise-nao-enviada";
  if (cenario === "denuncia-crise-nao-enviada") {
    return { status: 200, dados: { reported: false, crisis: true, crisis_level: "alto", message: "Sua denúncia não foi enviada. Se você está passando por um momento difícil, veja os contatos de ajuda abaixo." } };
  }
  if (MOTIVOS_DENUNCIA.indexOf(motivo) === -1) return { status: 400, dados: { error: "Escolha um dos motivos da lista e envie de novo." } };
  if (!crise && corpo.details != null) {
    if (typeof corpo.details !== "string") return { status: 400, dados: { error: "O comentário precisa ser um texto. Escreva de novo e envie." } };
    if (Array.from(corpo.details.trim()).length > 280) return { status: 400, dados: { error: "O comentário passou de 280 caracteres. Encurte um pouco e envie de novo." } };
  }
  if (cenario === "denuncia-indisponivel" || cenario === "comunidade-indisponivel") {
    return { status: 503, dados: { error: "A denúncia ainda não está disponível. Tente de novo mais tarde." } };
  }
  if (cenario === "denuncia-erro") return { status: 500, dados: { error: "Não deu para enviar a denúncia agora. Tente de novo daqui a pouco." } };
  if (cenario === "denuncia-lenta") {
    await new Promise(function (resolver) { setTimeout(resolver, ESPERA_LENTA_MS); });
  }
  var comunidade = comunidadePorSlug(slug);
  if (!comunidade) return { status: 404, dados: { error: "Comunidade não encontrada." } };
  var post = acharPost(comunidade, postId, email);
  if (!post) return { status: 404, dados: { error: "Post não encontrado. Ele pode ter sido apagado." } };
  if (String(post.user_id) === String(usuarios[email].id)) return { status: 400, dados: { error: "Você não pode denunciar o seu próprio post." } };
  var chave = email + "|" + post.id;
  if (denunciasFeitas[chave]) return { status: 409, dados: { error: "Você já denunciou este post. Uma denúncia por pessoa já basta, obrigado.", already_reported: true } };
  /* O comentário não é guardado neste mock (nem com crise). */
  denunciasFeitas[chave] = { reason: motivo };
  if (crise) {
    return { status: 201, dados: { reported: true, crisis: true, crisis_level: "alto", message: "Sua denúncia foi registrada, sem o texto que você escreveu. Se você está passando por um momento difícil, veja os contatos de ajuda abaixo." } };
  }
  return { status: 201, dados: { reported: true, message: "Obrigado. Sua denúncia foi registrada." } };
}

function equipeMock(email, metodo, caminho, cenario) {
  if (email !== EMAIL_ADMIN) return { status: 403, dados: { error: MSG_SO_ADMIN } };
  if (!escondidosDaEquipe) escondidosDaEquipe = escondidosIniciais();
  if (cenario === "equipe-indisponivel") {
    return { status: 503, dados: { error: "A moderação ainda não está disponível: falta aplicar a migração 005." } };
  }
  if (metodo === "GET" && caminho === "/api/communities/admin/hidden-posts") {
    return { status: 200, dados: { posts: cenario === "equipe-vazia" ? [] : escondidosDaEquipe.slice() } };
  }
  var restaurar = caminho.match(/^\/api\/communities\/admin\/posts\/(\d+)\/restore$/);
  var apagar = caminho.match(/^\/api\/communities\/admin\/posts\/(\d+)$/);
  var alvo = (metodo === "POST" && restaurar) ? restaurar[1] : ((metodo === "DELETE" && apagar) ? apagar[1] : "");
  if (!alvo) return { status: 404, dados: { error: "Não encontrado." } };
  if (cenario === "equipe-erro-acao") return { status: 500, dados: { error: "Não deu para concluir agora. Tente de novo daqui a pouco." } };
  var indice = -1;
  for (var i = 0; i < escondidosDaEquipe.length; i++) {
    if (String(escondidosDaEquipe[i].id) === alvo) indice = i;
  }
  if (indice === -1) {
    if (metodo === "POST" && alvo === "11") return { status: 409, dados: { error: "Este post não está escondido." } };
    return { status: 404, dados: { error: "Post não encontrado." } };
  }
  escondidosDaEquipe.splice(indice, 1);
  if (metodo === "DELETE") return { status: 200, dados: { deleted: true, post_id: Number(alvo) } };
  return { status: 200, dados: { restored: true, post_id: Number(alvo) } };
}

/* Rotas da comunidade e /api/users/me. Devolve null se o caminho não é daqui. */
async function responderComunidade(req, caminho, corpo) {
  if (caminho !== "/api/users/me" && caminho.indexOf("/api/communities") !== 0) return null;
  var acesso = autorizar(req);
  if (acesso.status !== 200) return negar(acesso);
  var email = acesso.email;
  var cenario = nomeDoCenario(req);
  var metodo = req.method;

  if (caminho === "/api/users/me" && metodo === "GET") {
    var usuario = usuarios[email];
    return { status: 200, dados: { user: { id: usuario.id, username: usuario.username, email: usuario.email, adult_confirmed: ehAdulto(email), legal: legalDe(usuario) } } };
  }
  /* As rotas de admin ficam antes do portão 18+, como no servidor. */
  if (caminho.indexOf("/api/communities/admin/") === 0) return equipeMock(email, metodo, caminho, cenario);

  if (!ehAdulto(email)) {
    if (cenario === "idade-crise" && metodo === "POST") {
      return { status: 200, dados: { saved: false, crisis: true, crisis_level: "alto", message: "Nada foi enviado. Se você está passando por um momento difícil, veja os contatos de ajuda abaixo.", code: "adult_confirmation_required" } };
    }
    return { status: 403, dados: corpoSemIdade() };
  }

  if (caminho === "/api/communities" && metodo === "GET") {
    if (cenario === "comunidade-erro") return { status: 500, dados: { error: "Erro ao listar comunidades." } };
    return { status: 200, dados: COMUNIDADES.map(function (c) { return { id: c.id, slug: c.slug, name: c.name, category: c.category }; }) };
  }
  var denuncia = caminho.match(/^\/api\/communities\/([a-z0-9-]+)\/posts\/(\d+)\/report$/);
  if (denuncia && metodo === "POST") return denunciarMock(email, denuncia[1], denuncia[2], corpo || {}, cenario);
  var aberta = caminho.match(/^\/api\/communities\/([a-z0-9-]+)$/);
  if (aberta && metodo === "GET") {
    if (cenario === "comunidade-indisponivel") return { status: 503, dados: { error: "A comunidade ainda não está disponível." } };
    if (cenario === "comunidade-erro") return { status: 500, dados: { error: "Erro ao obter comunidade." } };
    var comunidade = comunidadePorSlug(aberta[1]);
    if (!comunidade) return { status: 404, dados: { error: "Comunidade não encontrada." } };
    var fechada = cenario === "comunidade-fechada";
    var posts = (fechada || cenario === "comunidade-vazia") ? [] : postsDaComunidade(comunidade, email);
    return {
      status: 200,
      dados: {
        community: { id: comunidade.id, slug: comunidade.slug, name: comunidade.name, category: comunidade.category, is_member: true },
        ranking: [],
        posts: posts,
        access: { is_member: true, can_read_forum: !fechada, can_post_forum: false }
      }
    };
  }
  return { status: 404, dados: { error: "Não encontrado." } };
}

garantirUsuario("com-missao@exemplo.com", "pessoa");
usuarios["com-missao@exemplo.com"].missoes.push(novaMissao(usuarios["com-missao@exemplo.com"], {
  id: 1,
  title: "Ler uma página por dia",
  category: "aprendizagem",
  daily_minimum: "Uma página",
  why_it_matters: "Quero ler sem traduzir",
  proof_mode: "study_note",
  mode: "solo",
  status: "active"
}));

var servidor = http.createServer(function (req, res) {
  if (req.method === "OPTIONS") {
    enviar(res, 204, {});
    return;
  }

  var url = req.url.split("?")[0];
  if (url === "/api/invites" || url.indexOf("/api/invites/") === 0) {
    var leituraConvite = req.method === "POST" ? lerCorpo(req) : Promise.resolve({});
    leituraConvite.then(function (corpo) {
      return responderConvite(req, url, corpo);
    }).then(function (resultado) {
      enviar(res, resultado.status, resultado.dados);
    }).catch(function () {
      enviar(res, 400, { error: "Convite não encontrado. Confira o link." });
    });
    return;
  }
  if (url === "/api/messages" || url.indexOf("/api/messages/") === 0) {
    var leituraChat = req.method === "POST" ? lerCorpo(req) : Promise.resolve({});
    leituraChat.then(function (corpo) {
      return responderChat(req, url, corpo);
    }).then(function (resultado) {
      enviar(res, resultado.status, resultado.dados);
    }).catch(function () {
      enviar(res, 400, { error: "A mensagem precisa ser um texto. Escreva de novo e envie." });
    });
    return;
  }
  if (url === "/api/users/me/blocks" || url.indexOf("/api/users/me/blocks/") === 0) {
    Promise.resolve().then(function () {
      return responderBloqueios(req, url);
    }).then(function (resultado) {
      if (!resultado) resultado = { status: 404, dados: { error: "Não encontrado." } };
      enviar(res, resultado.status, resultado.dados);
    }).catch(function () {
      enviar(res, 500, { error: "Não foi possível abrir a lista." });
    });
    return;
  }
  if (url === "/api/users/me/note-consent" || url === "/api/users/me/notification-preferences" || (url === "/api/users/me" && req.method === "DELETE")) {
    var leituraDados = (req.method === "GET") ? Promise.resolve({}) : lerCorpo(req);
    leituraDados.then(function (corpo) {
      return responderDados(req, url, corpo);
    }).then(function (resultado) {
      enviar(res, resultado.status, resultado.dados);
    }).catch(function () {
      enviar(res, 400, { error: "Escolha não reconhecida. Toque de novo no interruptor.", code: "preferences_invalid" });
    });
    return;
  }
  if (url === "/api/users/me" || url.indexOf("/api/communities") === 0) {
    var leitura = (req.method === "POST" || req.method === "PUT") ? lerCorpo(req) : Promise.resolve({});
    leitura.then(function (corpo) {
      return responderComunidade(req, url, corpo);
    }).then(function (resultado) {
      if (!resultado) resultado = { status: 404, dados: { error: "Não encontrado." } };
      enviar(res, resultado.status, resultado.dados);
    }).catch(function () {
      enviar(res, 400, { error: "Escolha um dos motivos da lista e envie de novo." });
    });
    return;
  }
  if (req.method === "GET" && url === "/api/notifications/vapid-key") {
    enviar(res, 200, { publicKey: CHAVE_PUBLICA });
    return;
  }
  if (req.method === "GET" && (url === "/api/missions" || url.indexOf("/api/missions/") === 0 || url.indexOf("/api/checkins/") === 0)) {
    var acessoLista = autorizar(req);
    if (acessoLista.status !== 200) {
      enviar(res, acessoLista.status, acessoLista.dados);
      return;
    }
    if (responderHoje(req, res, acessoLista.email)) return;
    enviar(res, 404, { error: "Não encontrado." });
    return;
  }
  if (req.method !== "POST" && req.method !== "PUT") {
    enviar(res, 404, { error: "Não encontrado." });
    return;
  }

  lerCorpo(req).then(function (corpo) {
    if (url === "/api/users/login" && req.method === "POST") return login(corpo);
    if (url === "/api/users/register" && req.method === "POST") return cadastro(corpo);

    var acesso = autorizar(req);
    if (url === "/api/users/me/legal-acceptance" && req.method === "POST") {
      if (acesso.status !== 200) return negar(acesso);
      return aceitarTermosMock(acesso.email, corpo);
    }
    if (url === "/api/missions" && req.method === "POST") {
      if (acesso.status !== 200) return negar(acesso);
      return criarMissao(acesso.email, corpo);
    }
    var abandono = url.match(/^\/api\/missions\/(\d+)\/abandon$/);
    if (abandono && req.method === "POST") {
      if (acesso.status !== 200) return negar(acesso);
      return abandonarMissaoMock(acesso.email, abandono[1], cenarioDe(req, acesso.email));
    }
    if (url === "/api/checkins" && req.method === "POST") {
      if (acesso.status !== 200) return negar(acesso);
      return registrarCheckin(acesso.email, corpo, cenarioDe(req, acesso.email));
    }
    if (url === "/api/notifications/subscribe" && req.method === "POST") {
      if (acesso.status !== 200) return negar(acesso);
      return inscrever(acesso.email, corpo);
    }
    if (url === "/api/users/me/reminder" && req.method === "PUT") {
      if (!pedidoDeDesenvolvimento(req)) {
        return { status: 404, dados: { error: "Não encontrado." } };
      }
      if (acesso.status !== 200) return negar(acesso);
      return salvarLembrete(acesso.email, corpo, nomeDoCenario(req));
    }
    var estender = url.match(/^\/api\/missions\/(\d+)\/extend$/);
    if (estender && req.method === "POST") {
      if (!pedidoDeDesenvolvimento(req)) {
        return { status: 404, dados: { error: "Não encontrado." } };
      }
      if (acesso.status !== 200) return negar(acesso);
      return estenderMissao(acesso.email, estender[1], corpo, cenarioDe(req, acesso.email));
    }
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
