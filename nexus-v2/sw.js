/* Service worker simples do v2.
   Só guarda os arquivos desta pasta. Não mexe no cache do app antigo
   e não guarda pedidos da API (login, cadastro e missão precisam da rede). */
var CACHE = "nexus-v2-v19";
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
  "./ajustes.html",
  "./ajustes.css",
  "./ajustes.js",
  "./checkin.html",
  "./checkin.css",
  "./checkin.js",
  "./dia-dificil.html",
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
  "./login.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./fonts/figtree-400.woff2",
  "./fonts/figtree-500.woff2",
  "./fonts/figtree-600.woff2",
  "./fonts/figtree-700.woff2",
  "./fonts/figtree-400-italic.woff2"
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
      if (pedido.mode === "navigate") return caches.match("./offline.html");
      return new Response("", { status: 503, statusText: "Sem internet" });
    });
  }));
});
