/* Service worker simples do v2.
   Só guarda os arquivos desta pasta. Não mexe no cache do app antigo
   e não guarda pedidos da API (login, cadastro e missão precisam da rede). */
var CACHE = "nexus-v2-v26";
var ARQUIVOS = [
  "./",
  "./index.html",
  "./offline.html",
  "./onboarding.html",
  "./onboarding.css",
  "./onboarding.js",
  "./hoje.html",
  "./hoje.css",
  "./hoje.js",
  "./abas.css",
  "./abas.js",
  "./missao.html",
  "./missao.css",
  "./missao.js",
  "./ajustes.html",
  "./ajustes.css",
  "./ajustes.js",
  "./checkin.html",
  "./checkin.css",
  "./checkin.js",
  "./dia-dificil.html",
  "./dia-dificil.css",
  "./dia-dificil.js",
  "./grande-irmao.html",
  "./grande-irmao.css",
  "./grande-irmao.js",
  "./dia-30.html",
  "./dia-30.css",
  "./dia-30.js",
  "./crise.html",
  "./crise.css",
  "./recuperacao.html",
  "./tokens.css",
  "./base.css",
  "./login.css",
  "./api.js",
  "./nota-limite.js",
  "./dias-da-missao.js",
  "./comunidade-textos.js",
  "./comunidade.html",
  "./comunidade.css",
  "./comunidade.js",
  "./equipe.html",
  "./equipe.js",
  "./login.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./fonts/Figtree-Variable.woff2",
  "./fonts/Figtree-Variable-Italic.woff2"
];

self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) {
    return cache.addAll(ARQUIVOS);
  }));
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(caches.keys().then(function (chaves) {
    return Promise.all(chaves.map(function (chave) {
      if (chave.indexOf("nexus-v2-") === 0 && chave !== CACHE) {
        return caches.delete(chave);
      }
      return Promise.resolve();
    }));
  }));
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  var pedido = event.request;
  if (pedido.method !== "GET") return;

  var url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf("/api/") !== -1) return;

  event.respondWith(fetch(pedido).then(function (resposta) {
    if (resposta.ok) {
      var copia = resposta.clone();
      caches.open(CACHE).then(function (cache) {
        cache.put(pedido, copia);
      });
    }
    return resposta;
  }).catch(function () {
    return caches.match(pedido).then(function (guardado) {
      if (guardado) return guardado;
      /* A tela de crise abre sem internet mesmo com ?tema= ou ?cenario= na URL. */
      if (pedido.mode === "navigate" && /\/crise\.html$/.test(url.pathname)) {
        return caches.match("./crise.html").then(function (crise) {
          return crise || caches.match("./offline.html");
        });
      }
      if (pedido.mode === "navigate") return caches.match("./offline.html");
      return new Response("", { status: 503, statusText: "Sem internet" });
    });
  }));
});
