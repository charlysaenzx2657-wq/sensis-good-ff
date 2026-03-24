const VERSION = 'v3.2';
const CACHE = 'sensis-' + VERSION;

self.addEventListener('install', function(e){
  self.skipWaiting();
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(k){ return k !== CACHE; })
            .map(function(k){ return caches.delete(k); })
      );
    }).then(function(){
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(e){
  // Siempre buscar la version mas reciente de la red primero
  e.respondWith(
    fetch(e.request).then(function(response){
      // Guardar copia en cache
      var copy = response.clone();
      caches.open(CACHE).then(function(cache){
        cache.put(e.request, copy);
      });
      return response;
    }).catch(function(){
      // Si no hay red, usar cache
      return caches.match(e.request);
    })
  );
});
