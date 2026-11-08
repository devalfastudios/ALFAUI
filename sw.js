/* ALFA OS — service worker (PWA).
   Стратегии:
   · index.html — «сеть, а при отсутствии сети — кэш» (обновления на GitHub Pages видны сразу после перезагрузки);
   · иконки, манифест — кэш + фоновое обновление;
   · шрифты и Leaflet (карты) — кэш + фоновое обновление, всё нужное скачивается при установке;
   · API, радио, тайлы карт, прокси браузера — напрямую в сеть (в кэш не попадают).
   Чтобы выпустить новую версию, достаточно изменить VERSION. */
const VERSION='0.5.0';
const CORE='alfa-os-core-'+VERSION, RT='alfa-os-rt';
const INDEX=new URL('index.html',self.registration.scope).href;
const CORE_ASSETS=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png','icon-maskable-512.png','apple-touch-icon.png'];
const FONT_CSS='https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0..1,0&family=Outfit:wght@300..700&family=Figtree:wght@400..700&display=swap';
const EXTRA=['https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css','https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'];
const HOSTS=['fonts.googleapis.com','fonts.gstatic.com','cdnjs.cloudflare.com'];

self.addEventListener('install',e=>{e.waitUntil((async()=>{
  const core=await caches.open(CORE);await core.addAll(CORE_ASSETS.map(u=>new Request(u,{cache:'reload'})));
  /* внешние ресурсы — по возможности: если их не удалось скачать, установка всё равно успешна */
  const rt=await caches.open(RT);
  await Promise.allSettled(EXTRA.map(async u=>{const r=await fetch(u);if(r.ok)await rt.put(u,r)}));
  try{const r=await fetch(FONT_CSS);if(r.ok){const css=await r.clone().text();await rt.put(FONT_CSS,r);
    const urls=[...css.matchAll(/url\((https:[^)]+)\)/g)].map(m=>m[1]);
    await Promise.allSettled(urls.map(async u=>{const x=await fetch(u);if(x.ok)await rt.put(u,x)}))}}catch(_){}
  await self.skipWaiting()})())});

self.addEventListener('activate',e=>{e.waitUntil((async()=>{
  for(const k of await caches.keys())if(k.startsWith('alfa-os-')&&k!==CORE&&k!==RT)await caches.delete(k);
  if(self.registration.navigationPreload)try{await self.registration.navigationPreload.disable()}catch(_){}
  await self.clients.claim()})())});

self.addEventListener('message',e=>{if(e.data==='SKIP_WAITING')self.skipWaiting()});

async function nav(req){
  const c=await caches.open(CORE);
  try{const ctl=new AbortController(),to=setTimeout(()=>ctl.abort(),4500);
    const res=await fetch(req,{signal:ctl.signal});clearTimeout(to);
    if(res.ok&&res.type==='basic')c.put(INDEX,res.clone());
    return res}
  catch(_){const m=(await c.match(INDEX,{ignoreSearch:true}))||(await c.match('./',{ignoreSearch:true}));
    return m||new Response('ALFA OS: нет сети и нет сохранённой копии. Откройте приложение один раз с интернетом.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}})}}

async function swr(e,name){
  const c=await caches.open(name),hit=await c.match(e.request,{ignoreVary:true});
  const net=fetch(e.request).then(res=>{if(res&&(res.ok||res.type==='opaque'))c.put(e.request,res.clone());return res}).catch(()=>null);
  e.waitUntil(net.then(()=>{}));
  return hit||(await net)||new Response('',{status:504})}

self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET'||r.headers.has('range'))return;   // потоковое аудио/видео не трогаем
  const u=new URL(r.url);
  if(r.mode==='navigate'&&u.origin===location.origin){e.respondWith(nav(r));return}
  if(u.origin===location.origin){e.respondWith(swr(e,CORE));return}
  if(HOSTS.includes(u.hostname)){e.respondWith(swr(e,RT));return}
});
