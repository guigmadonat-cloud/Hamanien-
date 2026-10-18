const C="hamanien-v2";
const SHELL=["./","index.html","app.js","fb.js","manifest.webmanifest","icon-192.png","icon-512.png","apple-touch-icon.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const r=e.request;if(r.method!=="GET")return;
  const u=new URL(r.url);
  const ok=u.origin===location.origin||/(gstatic\.com|googleapis\.com\/css|cdnjs\.cloudflare\.com)/.test(u.host+u.pathname);
  if(!ok||/firestore\.googleapis|identitytoolkit|securetoken/.test(u.host))return;
  e.respondWith(fetch(r,{cache:"no-cache"}).then(res=>{const c=res.clone();caches.open(C).then(x=>x.put(r,c)).catch(()=>{});return res}).catch(()=>caches.match(r).then(m=>m||caches.match("index.html"))))});
