'use strict';
/* v110 (11-15) 신사업부 운영 모드
   - 김제조 웍스를 그냥 열면(누가 열든) '제한판': 🔐 운영관리 · 성과·정리 메뉴가 없다 (웰니스박스에 안 보이게)
   - 솔루션즈 웍스 「신사업부 운영」 안에 끼워 열 때만(?nb=1 + works.npksol.space 안) 전체 메뉴
   - 데이터 보안은 DB 권한(RLS)이 맡는다. 이 파일은 화면만 나눈다. */
window.KJ_NB = (function () {
  try {
    if (window.top === window) return false;
    if (!/[?&]nb=1/.test(location.search)) return false;
    var ao = location.ancestorOrigins;
    if (ao && ao.length) return /(^|\.)npksol\.space$/.test(new URL(ao[0]).hostname);
    return /npksol\.space/.test(document.referrer || '');
  } catch (e) { return false; }
})();
(function () {
  var NB_ONLY = ['video', 'insight'];
  var PARENT = 'https://works.npksol.space';
  function navBtn(v) { return document.querySelector('nav button[data-view="' + v + '"]'); }
  function setup() {
    if (!window.KJ_NB) {
      NB_ONLY.forEach(function (v) { var b = navBtn(v); if (b) b.classList.add('hide'); });
      try { if (NB_ONLY.indexOf(localStorage.getItem('kj_lastview')) >= 0) localStorage.removeItem('kj_lastview'); } catch (e) {}
      return;
    }
    document.documentElement.classList.add('kj-nb');
    var st = document.createElement('style');
    /* 11-15c 메뉴 이중 표시 없앰: 바깥(솔루션즈 웍스) 버튼 두 줄만 남기고 안쪽 머리줄·운영관리 제목/탭 줄은 숨김, 폭 제한 해제 */
    st.textContent = [
      'html.kj-nb header{display:none!important}',
      'html.kj-nb #vd-root>h3,html.kj-nb #vd-root .ops-tabs{display:none!important}',
      'html.kj-nb section.wrap{max-width:none!important;margin:0!important;padding:18px 22px 60px!important}',
      'html.kj-nb body{background:#fff}',
      '@media (max-width:720px){html.kj-nb section.wrap{padding:12px 12px 50px!important}}'
    ].join('\n');
    document.head.appendChild(st);
    function say() {
      var on = document.querySelector('nav button.on'); var v = on ? on.dataset.view : '';
      var t = document.querySelector('.ops-tabs button.on'); var ops = t ? t.dataset.opstab : '';
      try { parent.postMessage({ kjnb: 'at', v: v, ops: v === 'video' ? ops : '' }, PARENT); } catch (e) {}
    }
    function goOps(t) {
      try { localStorage.setItem('kj_opstab', t); } catch (e) {}
      var b = navBtn('video'); if (!b) return;
      if (!b.classList.contains('on')) b.click();
      var n = 0; (function tryTab() {
        var x = document.querySelector('.ops-tabs button[data-opstab="' + t + '"]');
        if (x) { if (!x.classList.contains('on')) x.click(); setTimeout(say, 50); return; }
        if (++n < 40) setTimeout(tryTab, 100);
      })();
    }
    addEventListener('message', function (e) {
      if (e.origin !== PARENT || !e.data || !e.data.kjnb) return;
      var d = e.data;
      if (d.kjnb === 'view') { var b = navBtn(d.v); if (b && !b.classList.contains('hide')) b.click(); setTimeout(say, 50); }
      else if (d.kjnb === 'ops') goOps(d.t);
      else if (d.kjnb === 'ask') say();
    });
    document.addEventListener('click', function () { setTimeout(say, 80); }, true);
    var mo = new MutationObserver(function () { clearTimeout(mo.t); mo.t = setTimeout(say, 120); });
    mo.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['class'] });
    say();
    /* 11-15b 자동 로그인: 김제조 로그인이 없으면 바깥(솔루션즈 웍스)에 1회용 토큰을 받아 와서 들어간다 */
    var tries = 0;
    function needLogin() {
      if (typeof sb === 'undefined') { if (++tries < 100) setTimeout(needLogin, 100); return; }
      sb.auth.getSession().then(function (r) {
        if (r && r.data && r.data.session) return;
        var n = 0; try { n = +sessionStorage.getItem('kj_nb_sso') || 0; } catch (e) {}
        if (n >= 3) return;                                   // 세 번 실패하면 그냥 로그인 화면
        try { parent.postMessage({ kjnb: 'need-login' }, PARENT); } catch (e) {}
      });
    }
    addEventListener('message', function (e) {
      if (e.origin !== PARENT || !e.data || e.data.kjnb !== 'sso' || !e.data.th || typeof sb === 'undefined') return;
      try { sessionStorage.setItem('kj_nb_sso', (+sessionStorage.getItem('kj_nb_sso') || 0) + 1); } catch (x) {}
      sb.auth.verifyOtp({ token_hash: e.data.th, type: 'magiclink' }).then(function (r) {
        if (r && r.error) { try { parent.postMessage({ kjnb: 'sso-fail', msg: r.error.message }, PARENT); } catch (x) {} return; }
        try { sessionStorage.removeItem('kj_nb_sso'); } catch (x) {}
        location.reload();
      });
    });
    needLogin();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup); else setup();
})();
