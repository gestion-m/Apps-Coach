var C="micoach-v1";
self.addEventListener("install",function(){self.skipWaiting()});
self.addEventListener("activate",function(e){e.waitUntil(clients.claim())});
self.addEventListener("fetch",function(e){
  var r=e.request,u=new URL(r.url);
  if(r.method!=="GET"||(u.origin!==location.origin&&u.hostname!=="cdn.jsdelivr.net"))return;
  e.respondWith(fetch(r).then(function(x){var c=x.clone();caches.open(C).then(function(k){k.put(r,c)});return x}).catch(function(){return caches.match(r).then(function(m){return m||caches.match("./")})}));
});
