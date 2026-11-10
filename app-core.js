'use strict';
// 김제조 웍스 — 기본 도우미·인증·부팅  (v88에서 index.html 에서 분리)

const { createClient } = window.supabase;   // UMD 로 교체 (v88 파일 분리)

const STAGES = ['아이디어','자료조사','대본','촬영','편집','검수·승인','게시예정','게시완료'];
const stageKo = s => s === '촬영' ? '촬영/제작' : s;   // v85 화면에 보이는 이름만 (DB 값은 '촬영' 그대로)
// 생산 라인 칼럼 구성
//  stages : 이 칼럼에 모아 보여줄 단계들 (기존 데이터를 건드리지 않고 묶기만 한다)
//  drop   : 이 칼럼에 카드를 떨어뜨렸을 때 지정될 단계
//  wide   : 카드가 많은 칼럼은 2열로 넓게
const BOARD_COLS = [
  { name: '아이디어·자료조사', stages: ['아이디어','자료조사'], drop: '아이디어', wide: true },
  { name: '대본',   stages: ['대본'],   drop: '대본',   wide: true },
  { name: '촬영/제작', stages: ['촬영'],   drop: '촬영',   wide: true },
  { name: '편집',   stages: ['편집'],   drop: '편집',   wide: true },
  { name: '검수·승인', stages: ['검수·승인'], drop: '검수·승인' }
];
// v97 콘텐츠 스타일(복수 선택) — 채널과 다른 축이다. contents.styles(text[]) 에 담는다.
// DB 열이 아직 없을 수도 있어, 카드 객체에 styles 키가 있는지로 판정해 없으면 화면에 아예 안 띄운다.
const STYLES = ['오가닉','인터뷰','강의/페이퍼'];
const hasStyles = () => Array.isArray(cards) && cards.length > 0 && Object.prototype.hasOwnProperty.call(cards[0], 'styles');
const styleList = c => Array.isArray(c && c.styles) ? c.styles : [];
const IDEA = '아이디어';
const REVIEW = '검수·승인';
const PLANNED = '게시예정';
const DONE = '게시완료';
const DROP = '드랍';
const ROLES = {
  master:'마스터(대표)', admin:'부관리자', lead:'콘텐츠 총괄', company:'회사 담당자',
  academic:'학술 담당자', pd:'PD·편집', publisher:'게시 담당', partner:'외부 파트너'
};
const STATUS_KO = { pending:'승인 대기', approved:'활동중', rejected:'거절', suspended:'중지' };

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => (s ?? '').toString().replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

if (!window.SUPABASE_URL || window.SUPABASE_URL.includes('여기에')) {
  document.body.innerHTML = '<div style="max-width:520px;margin:80px auto;padding:28px;font-family:sans-serif;line-height:1.7">'
    + '<h2 style="color:#0B2A5B">config.js 를 아직 안 채웠습니다</h2>'
    + '<p>config.js 파일을 열어 Supabase 주소와 키를 붙여넣고 다시 올려주세요.</p></div>';
  throw new Error('config missing');
}
const sb = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

let me = null, profile = null, cards = [], team = [], moats = [], channels = [], todos = [], meetings = [], posts = [];
let onlyMine = false;
let bdView = 'kanban';
let stageFilter = new Set();
let channelFilter = new Set();
let ownerFilter = new Set();          // 생산 라인 담당자 필터
let bdQ = '';                         // v106 생산 라인 제목 검색어
let teamFilter = new Set();           // (v37부터 안 씀 — 라인 탭으로 대체)
// v37: 생산 라인을 웰니스박스·솔루션즈·기타로 완전히 나눔. 한 번에 한 라인만 보임(마지막 선택 기억)
let curLine = (() => { try { return localStorage.getItem('kj_line'); } catch (_) { return null; } })();
// v39: 게시 일정은 '전체'(세 라인 함께) 또는 라인 하나를 골라 봄 — 생산 라인 탭과 따로 기억(kj_scline), 기본 전체
let scLine = (() => { try { return localStorage.getItem('kj_scline') || 'all'; } catch (_) { return 'all'; } })();
const scLineOk = c => scLine === 'all' || teamTag(c) === scLine;
let scOwnerFilter = new Set();        // 게시 일정 담당자 필터
let scChannelFilter = new Set();      // 게시 일정 채널 필터
let scAccFilter = new Set();          // v99 게시 일정 계정 필터 (플랫폼|핸들) — 🤖 자동 일정에만 걸린다

const isAdmin  = () => profile && (profile.role === 'master' || profile.role === 'admin');
const isMaster = () => profile && profile.role === 'master';

/* ---------------- 인증 ---------------- */
const AUTH_HINTS = [
  ['Invalid login credentials', '이메일 또는 비밀번호가 맞지 않습니다.'],
  ['Email not confirmed', '이 계정이 아직 확인 처리되지 않았습니다. Supabase → Authentication → Users 에서 확인 처리하세요.'],
  ['Email logins are disabled', 'Supabase 에서 이메일 로그인이 꺼져 있습니다. Authentication → Sign In / Providers → Email 을 켜세요.'],
  ['Email signups are disabled', 'Supabase 에서 이메일 가입이 꺼져 있습니다. Allow new users to sign up 을 켜세요.'],
  ['Signups not allowed', 'Supabase 에서 신규 가입이 꺼져 있습니다.'],
  ['rate limit', 'Supabase 내장 메일 한도에 걸렸습니다. Confirm email 을 끄면 메일 없이 진행됩니다.'],
  ['Password should be', '비밀번호가 너무 짧습니다. 8자 이상으로 다시 시도해 주세요.'],
  ['User already registered', '이미 신청된 이메일입니다. 로그인 탭에서 로그인하세요.'],
  ['Failed to fetch', '서버에 연결하지 못했습니다. config.js 의 Supabase 주소를 확인해 주세요.']
];
function authHint(msg){
  const m = (msg || '').toString();
  for (const [k, ko] of AUTH_HINTS)
    if (m.toLowerCase().includes(k.toLowerCase())) return ko + '\n(원문: ' + m + ')';
  return m;
}
function cleanErr(m){ return (m || '').replace(/^.*?:\s*/, '').trim() || m; }

$('#tab-login').onclick = () => switchAuth(true);
$('#tab-signup').onclick = () => switchAuth(false);
function switchAuth(login){
  $('#tab-login').classList.toggle('on', login);
  $('#tab-signup').classList.toggle('on', !login);
  $('#form-login').classList.toggle('hide', !login);
  $('#form-signup').classList.toggle('hide', login);
  $('#auth-msg').innerHTML = '';
}
function authMsg(t, kind='err'){ $('#auth-msg').innerHTML = `<div class="msg ${kind}">${esc(t)}</div>`; }

$('#form-login').onsubmit = async e => {
  e.preventDefault();
  const { error } = await sb.auth.signInWithPassword({
    email: $('#li-email').value.trim(), password: $('#li-pw').value });
  if (error) return authMsg(authHint(error.message));
  boot();
};

$('#form-signup').onsubmit = async e => {
  e.preventDefault();
  const { error } = await sb.auth.signUp({
    email: $('#su-email').value.trim(), password: $('#su-pw').value,
    options: { data: {
      name: $('#su-name').value.trim(), company: $('#su-company').value.trim(),
      role_title: $('#su-title').value.trim() }}
  });
  if (error) return authMsg(authHint(error.message));
  authMsg('신청을 보냈습니다. 관리자 승인을 기다려 주세요.', 'ok');
  $('#form-signup').reset();
};

$('#btn-me').onclick = () => openMyAccount();

$('#btn-logout').onclick = $('#pending-logout').onclick = async () => {
  await sb.auth.signOut(); location.reload();
};

/* ---------------- 부팅 ---------------- */
async function boot(){
  // ?post=주소 로 들어오면 로그인 없이 글만 보여준다
  const slug = new URLSearchParams(location.search).get('post');
  if (slug) {
    $('#screen-auth').classList.add('hide');
    await showPublicPost(slug);
    return;
  }

  const { data:{ session } } = await sb.auth.getSession();
  if (!session) return show('auth');
  me = session.user;

  const { data } = await sb.from('profiles').select('*').eq('id', me.id).maybeSingle();
  profile = data;

  if (!profile || profile.status !== 'approved') {
    if (profile?.status === 'rejected' || profile?.status === 'suspended')
      $('#pending-text').innerHTML = '이 계정은 현재 접근이 중지된 상태입니다.<br>관리자에게 문의해 주세요.';
    return show('pending');
  }

  $('#me-name').textContent = profile.name || profile.email;
  $('#me-role').textContent = ROLES[profile.role] || profile.role;
  $$('.admin-only').forEach(el => el.classList.toggle('hide', !isAdmin()));
  show('app');
  restoreLastView();                    // v106 마지막에 본 탭으로 시작
  await refresh();
  const sk = document.getElementById('boot-skel'); if (sk) sk.remove();   // v106 스켈레톤 걷기
  wireV106();
  openFromUrl();
}

let show = function(which){
  $('#screen-auth').classList.toggle('hide', which !== 'auth');
  $('#screen-pending').classList.toggle('hide', which !== 'pending');
  $('#screen-app').classList.toggle('hide', which !== 'app');
};

/* v107 ── 카드 저장 때마다 contents 전체(약 40만 자)를 다시 받던 것을 "바뀐 카드만" 받게 바꿨다.
   contents.updated_at 은 DB 트리거가 매 수정마다 갱신한다(11-11 확인). 삭제는 id 목록으로 잡는다.
   안전장치: 5분마다·첫 로딩·이상 감지 시에는 예전처럼 전체를 받는다. */
let _cAt = null, _cFullAt = 0, _rvAt = 0, _poAt = 0;
function _cMax(list){ let m = ''; for (const r of list) if ((r.updated_at || '') > m) m = r.updated_at; return m || null; }
async function loadContents(){
  const full = async () => {
    const r = await sb.from('contents').select('*').order('updated_at', { ascending:false });
    if (!r.error) { _cAt = _cMax(r.data || []); _cFullAt = Date.now(); }
    return r.data || [];
  };
  if (!_cAt || !cards.length || Date.now() - _cFullAt > 300000) return full();
  try {
    const since = new Date(new Date(_cAt).getTime() - 120000).toISOString();
    const [chg, ids] = await Promise.all([
      sb.from('contents').select('*').gte('updated_at', since),
      sb.from('contents').select('id')
    ]);
    if (chg.error || ids.error) return full();
    const alive = new Set((ids.data || []).map(x => x.id));
    const map = new Map();
    cards.forEach(c => { if (alive.has(c.id)) map.set(c.id, c); });
    (chg.data || []).forEach(c => map.set(c.id, c));
    if (map.size !== alive.size) return full();
    const list = [...map.values()].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
    const mx = _cMax(chg.data || []); if (mx && mx > _cAt) _cAt = mx;
    return list;
  } catch (e) { return full(); }
}
async function refresh(){
  const reviewOn = !$('#view-review').classList.contains('hide');
  const postsOn = !$('#view-posts').classList.contains('hide');
  const [c, p, m, ch, td, mt, po] = await Promise.all([
    loadContents(),
    sb.from('profiles').select('*').order('created_at', { ascending:false }),
    sb.from('moats').select('*').order('sort_order', { ascending:true }),
    sb.from('channels').select('*').order('sort_order', { ascending:true }),
    sb.from('todos').select('*').order('created_at', { ascending:false }),
    sb.from('meetings').select('*').order('met_on', { ascending:false }),
    // v107 글(posts) 본문(약 15만 자)은 글 화면을 보고 있거나 5분이 지났을 때만 다시 받는다
    (postsOn || !_poAt || Date.now() - _poAt > 300000) ? sb.from('posts').select('*').order('updated_at', { ascending:false }) : null
  ]);
  cards = c; team = p.data || []; moats = m.data || []; channels = ch.data || [];
  todos = td.data || []; meetings = mt.data || [];
  if (po && !po.error) { posts = po.data || []; _poAt = Date.now(); }
  // v107 검수 파일 목록(약 13만 자)은 검수 화면을 보고 있을 때만, 아니면 탭을 열 때 받는다
  const jobs = [loadSettings()];
  if (reviewOn || !_rvAt) { jobs.push(loadReview()); _rvAt = Date.now(); }
  await Promise.all(jobs);
  render();
}

$$('nav button').forEach(b => b.onclick = async () => {
  if (window.__drawerGuard) {
    await window.__drawerGuard();
    if ($('#drawer-root').innerHTML) return;   // 계속 편집을 골랐으면 그대로 둔다
  }
  $$('nav button').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  ['board','schedule','insight','posts','todo','meetings','review','video','drops','formats','push','cands','team','settings'].forEach(v =>
    $('#view-' + v).classList.toggle('hide', v !== b.dataset.view));
  navSync(b.dataset.view);
  try { localStorage.setItem('kj_lastview', b.dataset.view); } catch (e) {}   // v106
  if (b.dataset.view === 'review' && Date.now() - _rvAt > 15000) { await loadReview(); _rvAt = Date.now(); }   // v107
  if (b.dataset.view === 'posts' && Date.now() - _poAt > 15000) { const r = await sb.from('posts').select('*').order('updated_at', { ascending:false }); if (!r.error) { posts = r.data || []; _poAt = Date.now(); } }   // v107
  render();
});

/* v106 ── 필터 줄 접기. 생산 라인·게시 일정이 같은 방식으로 돈다. */
function filterBox(boxId, btnId, nId, key, count){
  const box = document.getElementById(boxId), btn = document.getElementById(btnId);
  if (!box || !btn) return;
  let open = false; try { open = localStorage.getItem(key) === '1'; } catch (e) {}
  const paint = () => {
    box.classList.toggle('hide', !open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    const n = count(), b = document.getElementById(nId);
    if (b) { b.textContent = n; b.classList.toggle('hide', !n); }
  };
  btn.onclick = () => { open = !open; try { localStorage.setItem(key, open ? '1' : '0'); } catch (e) {} paint(); };
  box.__paint = paint;
  paint();
}
function paintFilterCounts(){
  ['bd-filters','sc-filters'].forEach(id => { const b = document.getElementById(id); if (b && b.__paint) b.__paint(); });
}

/* v106 ── 지금 보고 있는 것을 주소에 남긴다. 링크를 그대로 넘기면 같은 화면이 열린다. */
let hashBusy = false;
function syncHash(){
  if (hashBusy) return;
  const on = document.querySelector('nav button.on');
  const p = new URLSearchParams();
  if (on) p.set('v', on.dataset.view);
  if (curLine) p.set('line', curLine);
  if (onlyMine) p.set('mine', '1');
  if (bdView !== 'kanban') p.set('bv', bdView);
  if (bdQ) p.set('q', bdQ);
  if (stageFilter.size)   p.set('st',  [...stageFilter].join('|'));
  if (ownerFilter.size)   p.set('own', [...ownerFilter].join('|'));
  if (channelFilter.size) p.set('ch',  [...channelFilter].join('|'));
  try { history.replaceState(null, '', location.pathname + location.search + (p.toString() ? '#' + p : '')); } catch (e) {}
}
function applyHash(){
  const h = location.hash.slice(1); if (!h) return null;
  const p = new URLSearchParams(h);
  hashBusy = true;
  if (p.get('line')) curLine = p.get('line');
  onlyMine = p.get('mine') === '1';
  if (p.get('bv')) bdView = p.get('bv');
  bdQ = p.get('q') || '';
  const fill = (s, v) => { s.clear(); (v ? v.split('|') : []).forEach(x => s.add(x)); };
  fill(stageFilter,   p.get('st'));
  fill(ownerFilter,   p.get('own'));
  fill(channelFilter, p.get('ch'));
  hashBusy = false;
  return p.get('v');
}

/* v106 지난번에 보던 탭으로 열어 준다. 없거나 권한이 없으면 생산 라인. */
function restoreLastView(){
  let v = applyHash();                                         // 주소에 적힌 게 먼저
  if (!v) { try { v = localStorage.getItem('kj_lastview'); } catch (e) {} }
  try { localStorage.removeItem('kjnavlast'); } catch (e) {}   // v102 탭 묶음이 쓰던 죽은 키
  if (!v) return;
  const b = document.querySelector(`nav button[data-view="${v}"]`);
  if (!b || b.classList.contains('hide')) return;
  $$('nav button').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  ['board','schedule','insight','posts','todo','meetings','review','video','drops','formats','push','cands','team','settings']
    .forEach(x => $('#view-' + x).classList.toggle('hide', x !== v));
  navSync(v, true);
}

/* v105 메뉴 복구 — v102 탭 묶음(navg)을 걷어냈다. 상위 탭 12개를 다시 한 줄에 모두 둔다.
   navSync 는 app-board.js 등에서도 부르므로 이름은 남기고, 접힘 흔적만 지우는 일만 한다. */
function navSync(view, quiet) {
  try {
    document.querySelectorAll('nav button.gout').forEach(x => x.classList.remove('gout'));
    const nav = document.querySelector('nav');
    if (nav) nav.classList.remove('gout', 'onesub');
    const hint = document.querySelector('.hsub-hint');
    if (hint) { hint.textContent = ''; hint.classList.add('hide'); }
  } catch (e) {}
}

/* v106 ── 검색칸 · 필터 접기 · 단축키를 한 번에 붙인다 (부팅 끝에 한 번 부른다) */
function wireV106(){
  // 생산 라인 제목 검색
  const q = document.getElementById('bd-q');
  if (q) {
    q.value = bdQ;
    let t = null;
    q.oninput = () => { clearTimeout(t); t = setTimeout(() => { bdQ = q.value.trim(); renderBoard(); }, 180); };
    q.onkeydown = e => { if (e.key === 'Escape') { q.value = ''; bdQ = ''; renderBoard(); q.blur(); } };
  }
  filterBox('bd-filters', 'bd-filter-toggle', 'bd-filter-n', 'kj_bdfilters',
            () => stageFilter.size + ownerFilter.size + channelFilter.size);
  filterBox('sc-filters', 'sc-filter-toggle', 'sc-filter-n', 'kj_scfilters',
            () => scOwnerFilter.size + scChannelFilter.size + scAccFilter.size);

  // 📝 대본 묶음 메뉴
  const mb = document.getElementById('sc-menu-btn'), mn = document.getElementById('sc-menu');
  if (mb && mn) {
    const close = () => { mn.classList.add('hide'); mb.setAttribute('aria-expanded', 'false'); };
    mb.onclick = e => { e.stopPropagation();
      const open = mn.classList.toggle('hide') === false;
      mb.setAttribute('aria-expanded', open ? 'true' : 'false'); };
    mn.onclick = () => setTimeout(close, 0);
    document.addEventListener('click', e => { if (!mn.contains(e.target) && e.target !== mb) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  }

  // 단축키 — 글 쓰는 중이거나 창이 떠 있으면 안 듣는다
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
    if (document.querySelector('.uim-back') || $('#drawer-root').innerHTML) return;
    if (e.key === '/') {
      e.preventDefault();
      const b = document.querySelector('nav button[data-view="board"]');
      if (b && !document.querySelector('nav button.on[data-view="board"]')) b.click();
      setTimeout(() => { const i = document.getElementById('bd-q'); if (i) i.focus(); }, 60);
      return;
    }
    if (e.key === 'n' || e.key === 'N') {
      const nb = document.getElementById('btn-new');
      if (nb && !$('#view-board').classList.contains('hide')) { e.preventDefault(); nb.click(); }
      return;
    }
    if (/^[1-9]$/.test(e.key)) {
      const list = $$('nav button').filter(x => !x.classList.contains('hide'));
      const b = list[+e.key - 1];
      if (b) { e.preventDefault(); b.click(); }
    }
  });
}

/* v100 폰에서 표가 화면을 통째로 밀지 않게 — 표를 .tblwrap 으로 감싸 표만 좌우로 움직이고,
   720px 이하에서는 칸마다 머리글을 붙여 카드로 접는다(CSS). 화면 코드를 하나씩 고치는 대신
   다 그려진 뒤 한 번 훑는 방식이라 앞으로 새로 만드는 표에도 그대로 적용된다. */
(function () {
  function headRow(t) { return t.querySelector('thead tr') || [...t.rows].find(r => r.querySelector('th')) || null; }
  function stamp(t) {
    const hr = headRow(t); if (!hr) return;
    const labels = [...hr.children].map(c => (c.textContent || '').replace(/\s+/g, ' ').trim());
    if (!labels.some(x => x)) return;
    hr.classList.add('tfold-h');
    [...t.rows].forEach(r => {
      if (r === hr) return;
      let i = 0;
      [...r.children].forEach(c => {
        if (c.tagName === 'TD' && !c.hasAttribute('data-l')) c.setAttribute('data-l', labels[i] || '');
        i += (parseInt(c.getAttribute('colspan'), 10) || 1);
      });
    });
    t.classList.add('tfold');
  }
  function sweep() {
    document.querySelectorAll('table').forEach(t => {
      if (!t.closest('.tblwrap') && !t.closest('.tbl-wrap') && !t.classList.contains('no-fold')) {
        const w = document.createElement('div'); w.className = 'tblwrap';
        t.parentNode.insertBefore(w, t); w.appendChild(t);
      }
      stamp(t);
    });
  }
  const run = () => { try { sweep(); } catch (e) {} };
  run();
  let timer = null;
  try {
    new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(run, 60); })
      .observe(document.body, { childList: true, subtree: true });
  } catch (e) {}
})();

/* v101 브라우저 기본 팝업(alert·confirm·prompt) 대신 쓰는 화면 안 알림·확인창.
   폰에서 기본 팝업은 화면 한가운데를 덮고 손가락 위치가 안 맞는다. 알림은 아래쪽 토스트로,
   확인·입력은 웍스 안 창으로 띄운다. 되돌릴 수 있는 일은 애초에 묻지 않고 바로 하고 「되돌리기」를 준다. */
const UI_BAD = /오류|실패|없습니다|못[ ]?|할 수 없|안 됩니다|잘못|초과|필요합니다/;
function uiToast(msg, opt) {
  const o = opt || {};
  const old = document.querySelector('.po-toast'); if (old) old.remove();
  const el = document.createElement('div');
  el.className = 'po-toast' + (o.bad ? ' bad' : '');
  const sp = document.createElement('span'); sp.textContent = String(msg == null ? '' : msg); el.appendChild(sp);
  if (o.action) {
    const b = document.createElement('button'); b.className = 'po-undo'; b.textContent = o.action.label;
    b.onclick = () => { el.remove(); o.action.run(); };
    el.appendChild(b);
  }
  document.body.appendChild(el);
  const t = setTimeout(() => el.remove(), o.ms || (o.action ? 9000 : o.bad ? 5000 : 3200));
  el.onclick = e => { if (e.target === el || e.target === sp) { clearTimeout(t); el.remove(); } };
  return el;
}
function uiAlert(msg, ms) { return uiToast(msg, { bad: UI_BAD.test(String(msg || '')), ms }); }
function uiErr(msg, ms) { return uiToast(msg, { bad: true, ms }); }

function uiModal(build) {
  return new Promise(resolve => {
    const back = document.createElement('div'); back.className = 'uim-back';
    const box = document.createElement('div'); box.className = 'uim';
    back.appendChild(box);
    let done = false;
    const close = v => { if (done) return; done = true; document.removeEventListener('keydown', key, true); back.remove(); resolve(v); };
    const key = e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(null); }
      if (e.key === 'Enter' && !e.shiftKey && box.dataset.enter === 'ok') { e.preventDefault(); box.querySelector('.uim-yes').click(); }
    };
    document.addEventListener('keydown', key, true);
    back.onclick = e => { if (e.target === back) close(null); };
    build(box, close);
    document.body.appendChild(back);
    const f = box.querySelector('input,textarea') || box.querySelector('.uim-yes');
    if (f) setTimeout(() => { try { f.focus(); if (f.select) f.select(); } catch (e) {} }, 30);
  });
}
/* 확인창 — 되돌릴 수 없는 일에만 쓴다. opt: {ok,cancel,danger,title} */
function uiConfirm(msg, opt) {
  const o = opt || {};
  return uiModal((box, close) => {
    box.dataset.enter = 'ok';
    const t = document.createElement('div'); t.className = 'uim-msg'; t.textContent = String(msg == null ? '' : msg);
    const row = document.createElement('div'); row.className = 'uim-btns';
    const no = document.createElement('button'); no.className = 'btn ghost uim-no'; no.textContent = o.cancel || '취소';
    const ok = document.createElement('button'); ok.className = 'btn uim-yes' + (o.danger ? ' danger' : ''); ok.textContent = o.ok || '확인';
    no.onclick = () => close(false); ok.onclick = () => close(true);
    row.appendChild(no); row.appendChild(ok);
    box.appendChild(t); box.appendChild(row);
  }).then(v => v === true);
}
/* 입력창 — prompt 대신. 취소하면 null */
function uiPrompt(msg, def, opt) {
  const o = opt || {};
  return uiModal((box, close) => {
    box.dataset.enter = 'ok';
    const t = document.createElement('div'); t.className = 'uim-msg'; t.textContent = String(msg == null ? '' : msg);
    const inp = document.createElement('input'); inp.className = 'uim-input'; inp.type = 'text';
    inp.value = def == null ? '' : String(def); if (o.placeholder) inp.placeholder = o.placeholder;
    const row = document.createElement('div'); row.className = 'uim-btns';
    const no = document.createElement('button'); no.className = 'btn ghost uim-no'; no.textContent = '취소';
    const ok = document.createElement('button'); ok.className = 'btn uim-yes'; ok.textContent = o.ok || '확인';
    no.onclick = () => close(null); ok.onclick = () => close(inp.value);
    row.appendChild(no); row.appendChild(ok);
    box.appendChild(t); box.appendChild(inp); box.appendChild(row);
  });
}

setTimeout(() => { try { const on = document.querySelector('nav button.on'); navSync(on ? on.dataset.view : 'board'); } catch (e) {} }, 0);
