// v107 김제조 웍스 서비스워커 (11-11 Claude)
// GitHub Pages 캐시가 10분 고정이라, 10분 지나면 앱 파일 12개를 매번 다시 확인했다.
// ?v= 가 붙은 js/css 와 CDN(폰트·supabase-js)만 '저장본 먼저 띄우고, 뒤에서 새로 받아 저장'한다.
// 그래서 같은 ?v= 로 파일을 고쳐 올려도 다음 번 열 때는 새 파일이 뜬다(최대 한 번 늦음). index.html·config.js·데이터는 건드리지 않는다.
// 끄려면: 이 파일을 self.registration.unregister() 만 하는 내용으로 바꿔 올린다.
const C = 'kj-static-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  const mine = u.origin === self.location.origin && /\.(js|css)$/.test(u.pathname) && u.searchParams.has('v');
  const cdn = u.hostname === 'cdn.jsdelivr.net';
  if (!mine && !cdn) return;
  e.respondWith(caches.open(C).then(async c => {
    const hit = await c.match(req);
    const net = fetch(req).then(async r => {
      if (r && r.ok && r.type !== 'opaque') {
        if (mine) {   // 같은 파일의 옛 버전은 지운다
          for (const k of await c.keys()) { const ku = new URL(k.url); if (ku.pathname === u.pathname && ku.search !== u.search) await c.delete(k); }
        }
        await c.put(req, r.clone());
      }
      return r;
    }).catch(() => hit);
    if (hit) { e.waitUntil(net); return hit; }
    return net;
  }));
});
