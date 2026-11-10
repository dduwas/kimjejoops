'use strict';
// 김제조 웍스 — 필터·대본 다운로드·콘텐츠 후보·분석 대상·형식  (v88에서 index.html 에서 분리)
/* ---------------- 필터 ---------------- */
$$('.bd-view').forEach(b => b.onclick = () => {
  $$('.bd-view').forEach(x => x.classList.remove('on'));
  b.classList.add('on'); bdView = b.dataset.bv; renderBoard();
});

$('#chip-mine').onclick = () => {
  onlyMine = !onlyMine;
  $('#chip-mine').classList.toggle('on', onlyMine);
  renderBoard();
};

// 담당자·채널 칩을 공통 규격으로 그린다
function buildChips(boxSel, clearSel, items, filterSet, onDone){
  const box = $(boxSel); if (!box) return;
  const keys = items.map(i => i.key);
  [...filterSet].forEach(k => { if (!keys.includes(k)) filterSet.delete(k); });

  box.innerHTML = items.length
    ? items.map(i => `<button class="chip ch ${filterSet.has(i.key)?'on':''}" data-key="${esc(i.key)}">${esc(i.label)}</button>`).join('')
    : '<span class="u-sm2">표시할 항목이 없습니다</span>';

  const clearBtn = $(clearSel);
  const sync = () => clearBtn && clearBtn.classList.toggle('hide', filterSet.size === 0);

  [...box.querySelectorAll('.chip')].forEach(b => b.onclick = () => {
    const k = b.dataset.key;
    filterSet.has(k) ? filterSet.delete(k) : filterSet.add(k);
    b.classList.toggle('on', filterSet.has(k));
    sync(); onDone();
  });
  sync();
  if (clearBtn) clearBtn.onclick = () => {
    filterSet.clear();
    [...box.querySelectorAll('.chip')].forEach(b => b.classList.remove('on'));
    sync(); onDone();
  };
}

// 담당자 목록 — 실제로 카드에 배정된 사람만 노출한다
function ownerItems(pool){
  const seen = new Map();
  pool.forEach(c => (c.owner_ids || []).forEach(id => {
    seen.set(id, (seen.get(id) || 0) + 1);
  }));
  const list = [...seen.entries()]
    .map(([id, n]) => ({ key: id, label: `${nameOf(id)} ${n}`, n }))
    .sort((a,b) => b.n - a.n);
  if (pool.some(c => !(c.owner_ids || []).length))
    list.push({ key: '__none__', label: '담당 미정', n: 0 });
  return list;
}

function matchOwner(c, set){
  if (!set.size) return true;
  const ids = c.owner_ids || [];
  if (set.has('__none__') && !ids.length) return true;
  return ids.some(id => set.has(id));
}

function matchChannel(c, set){
  if (!set.size) return true;
  return (c.channels || []).some(ch => set.has(ch));
}

function buildOwnerChips(){
  if (document.getElementById('view-board').classList.contains('hide')) return;   // v106 안 보이는 화면은 그리지 않는다
  const pool = cards.filter(c => c.stage !== PLANNED && c.stage !== DONE && c.stage !== DROP && teamTag(c) === lineOf());
  buildChips('#owner-chips', '#owner-clear', ownerItems(pool), ownerFilter, renderBoard);
  buildLineTabs();
}

function lineOf(){
  if (!TEAM_TAGS.includes(curLine)) curLine = (me && teamByOwners([me.id])) || '솔';
  return curLine;
}
// v38: 같은 라인 탭을 생산 라인·게시 일정·성과·정리에 모두 둔다. 고른 라인은 세 화면 공통
function buildLineTabs(){
  lineOf();
  const live = c => c.stage !== PLANNED && c.stage !== DONE && c.stage !== DROP;
  const HINT = { board: '카드를 다른 라인 탭에 끌어다 놓으면 단계는 그대로 두고 그 라인으로 옮겨집니다 (우클릭 → 라인 옮기기도 가능)',
    sc: '전체 = 세 라인을 함께(일정마다 웰·솔·기타 표시). 라인을 고르면 그 라인만. 캘린더 일정을 라인 탭에 끌어 놓으면 그 라인으로 옮겨집니다',
    ins: '성과·정리 필요 카드도 고른 라인만 봅니다' };
  $$('#line-tabs, .linetabs[data-ltview]').forEach(box => {
    const v = box.dataset.ltview || 'board';
    const sel = v === 'sc' ? scLine : curLine;
    box.innerHTML = (v === 'sc' ? `<button class="ltab ltab-e ${scLine === 'all' ? 'on' : ''}" data-line="all"><b>전체</b> 보기</button>` : '')
      + TEAM_TAGS.map(t => `<button class="ltab ltab-${teamCls(t)} ${t === sel ? 'on' : ''}" data-line="${t}"><b>${TEAM_LABEL[t]}</b> 라인<span>${cards.filter(c => live(c) && teamTag(c) === t).length}</span></button>`).join('')
      + `<span class="lhint">${HINT[v]}</span>`;
    box.querySelectorAll('[data-line]').forEach(b => {
      if (v === 'sc') {
        b.onclick = () => { if (b.dataset.line === scLine) return; scLine = b.dataset.line; try { localStorage.setItem('kj_scline', scLine); } catch (_) {} scOwnerFilter.clear(); buildScheduleChips(); buildLineTabs(); renderSchedule(); };
        if (b.dataset.line === 'all') return;
        b.ondragover = e => { e.preventDefault(); b.classList.add('drop'); };
        b.ondragleave = () => b.classList.remove('drop');
        b.ondrop = async e => { e.preventDefault(); b.classList.remove('drop'); await moveLine(e.dataTransfer.getData('text/plain'), b.dataset.line); };
        return;
      }
      b.onclick = () => { if (b.dataset.line === curLine) return; curLine = b.dataset.line; try { localStorage.setItem('kj_line', curLine); } catch (_) {} ownerFilter.clear(); scOwnerFilter.clear(); buildOwnerChips(); buildScheduleChips(); renderBoard(); renderSchedule(); renderInsight(); };
      b.ondragover = e => { if (b.dataset.line === curLine) return; e.preventDefault(); b.classList.add('drop'); };
      b.ondragleave = () => b.classList.remove('drop');
      b.ondrop = async e => { e.preventDefault(); b.classList.remove('drop'); await moveLine(e.dataTransfer.getData('text/plain'), b.dataset.line); };
    });
  });
}
/* ---------- v40 대본 초안 docx (양식: 1022 촬영 최종 대본) ---------- */
let scPick = null;   // 고르는 중이면 Set(카드 id)
const ymd = () => { const d = new Date(); return String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); };
const safeName = s => String(s || '').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
async function scriptDownload(list, label){
  if (!list.length) return uiAlert('대본을 만들 카드가 없습니다.');
  if (!window.KJScript) return uiAlert('대본 도구를 불러오지 못했습니다. 새로고침 후 다시 해 주세요.');
  const name = list.length === 1 ? `${ymd()}_${safeName(list[0].title)}_대본.docx` : `${ymd()}_${label || TEAM_LABEL[lineOf()] + ' 라인'}_대본초안_${list.length}개.docx`;
  try { poToast('대본 파일 만드는 중…', 1500); await window.KJScript.download(list, name); poToast(`다운로드: ${name}`, 3500); }
  catch (err) { uiAlert('대본 파일을 만들지 못했습니다: ' + (err.message || err)); }
}
function scBarCount(){ const n = scPick ? scPick.size : 0; $('#sc-bar-n').textContent = n ? `${n}개 골랐습니다` : '카드를 눌러 고르세요'; }
function scPickMode(on){
  scPick = on ? new Set() : null;
  $('#sc-bar').classList.toggle('hide', !on); $('#line').classList.toggle('scmode', !!on); $('#btn-sc-pick').classList.toggle('on', !!on);
  if (on && bdView !== 'kanban') { $$('.bd-view').forEach(x => x.classList.toggle('on', x.dataset.bv === 'kanban')); bdView = 'kanban'; }
  renderBoard(); if (on) scBarCount();
}
const scAllList = (order = ['대본', '촬영']) => { return visible().filter(c => order.includes(c.stage)).sort((a, b) => order.indexOf(a.stage) - order.indexOf(b.stage) || (a.shoot_date || '9999').localeCompare(b.shoot_date || '9999')); };
$('#btn-sc-pick').onclick = () => scPickMode(!scPick);
$('#sc-bar-x').onclick = () => scPickMode(false);
$$('[data-scpickst]').forEach(b => b.onclick = () => { if (b.dataset.scpickst === 'clear') scPick.clear(); else scAllList([b.dataset.scpickst]).forEach(c => scPick.add(c.id)); renderBoard(); scBarCount(); });
$('#sc-bar-go').onclick = async () => { if (!scPick || !scPick.size) return uiAlert('카드를 먼저 골라 주세요.'); const order = cards.filter(c => scPick.has(c.id)); await scriptDownload(order, TEAM_LABEL[lineOf()] + ' 선택'); };
$('#sc-bar-ai').onclick = () => { if (!scPick || !scPick.size) return uiAlert('카드를 먼저 골라 주세요.'); aiScriptBulk(cards.filter(c => scPick.has(c.id))); };
$$('[data-scsave]').forEach(b => b.onclick = () => {   // v41 칸(탭)별 저장: 대본 칸 / 촬영 칸 / 둘 다
  const st = b.dataset.scsave.split(','); const list = scAllList(st); const nm = st.join('·');
  if (!list.length) return uiAlert(`${TEAM_LABEL[lineOf()]} 라인의 ${nm} 칸에 카드가 없습니다.`);
  scriptDownload(list, `${TEAM_LABEL[lineOf()]} 라인 ${st.length > 1 ? '전체' : nm + ' 칸'}`);
});

/* Reference video playback stays inside Works. No downloads or background jobs. */
function kjReferenceSource(raw) {
  let u;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.toLowerCase();
  if (['instagram.com', 'www.instagram.com'].includes(host)) {
    const m = u.pathname.match(/^\/(?:reel|reels|p|tv)\/([\w-]+)\/?$/);
    return m ? { kind: 'iframe', src: `https://www.instagram.com/p/${m[1]}/embed/`, provider: 'Instagram' } : null;
  }
  let id;
  if (host === 'youtu.be') id = u.pathname.slice(1);
  if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'www.youtube-nocookie.com'].includes(host)) {
    id = u.pathname === '/watch' ? u.searchParams.get('v') : (u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]+)\/?$/) || [])[1];
  }
  if (id && /^[\w-]{11}$/.test(id)) return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1`, provider: 'YouTube' };
  if (/\.(?:mp4|webm|mov)$/i.test(u.pathname)) return { kind: 'video', src: u.href, provider: '영상' };
  return null;
}
/* v98 인스타 레퍼런스 — 팝업 안에서 바로 재생하는 원래 방식으로 되돌렸다(대표 요청 11-04).
   인스타에 로그인된 브라우저에서는 임베드가 잘 뜬다. 로그아웃 상태에서는 빈 화면이 나오므로,
   재생 화면 바로 아래에 「인스타에서 열기」 버튼과, 접어 둔 그림·글(우리가 수집 때 저장해 둔 것)을 같이 붙인다. */
const IG_SC = u => { const m = String(u || '').match(/\/(?:reel|reels|p|tv)\/([\w-]+)/); return m ? m[1] : null; };
async function kjIgFallback(raw, screen){
  const box = document.createElement('div'); box.className = 'kj-ig-side';
  box.innerHTML = '<div class="kj-ig-btns"><a class="kj-ig-go" href="' + esc(raw) + '" target="_blank" rel="noopener">인스타그램에서 열기 ↗</a>'
    + '<button class="chip sm" data-ref-copy>주소 복사</button></div>';
  screen.appendChild(box);
  const cp = box.querySelector('[data-ref-copy]');
  if (cp) cp.onclick = async () => { cp.textContent = (await copyText(raw)) ? '복사함 ✓' : '복사 실패'; setTimeout(() => { cp.textContent = '주소 복사'; }, 2000); };
  const sc = IG_SC(raw); if (!sc) return;
  let info = null;
  try { const { data } = await sb.from('kj_candidates').select('thumb,account,caption').eq('shortcode', sc).limit(1); info = (data || [])[0] || null; } catch (e) {}
  if (!info || (!info.thumb && !info.caption)) return;
  const cap = String(info.caption || '').trim();
  const d = document.createElement('details'); d.className = 'kj-ig-more';
  d.innerHTML = '<summary>위 화면이 비어 있으면 — 그림·글로 보기</summary>'
    + (info.account ? '<div class="kj-ig-acct">' + esc(info.account) + '</div>' : '')
    + (info.thumb ? '<img src="' + esc(info.thumb) + '" alt="레퍼런스 미리보기">' : '')
    + (cap ? '<p class="kj-ig-cap">' + esc(cap.slice(0, 900)) + (cap.length > 900 ? '…' : '') + '</p>' : '');
  box.insertBefore(d, box.firstChild);
}
function kjOpenProductionReference(raw, title = '레퍼런스 영상') {
  const source = kjReferenceSource(raw);
  const previous = document.activeElement;
  document.querySelector('#kj-reference-player')?.close();
  const dialog = document.createElement('dialog');
  dialog.id = 'kj-reference-player'; dialog.className = 'kj-ref-player';
  dialog.setAttribute('aria-labelledby', 'kj-ref-title');
  dialog.innerHTML = `<div class="kj-ref-head"><b id="kj-ref-title">${esc(title || '레퍼런스 영상')}</b><button class="chip sm" data-ref-close autofocus aria-label="영상 닫기">닫기 ✕</button></div><div class="kj-ref-screen"></div><p class="kj-ref-note"></p>`;
  const screen = dialog.querySelector('.kj-ref-screen'), note = dialog.querySelector('.kj-ref-note');
  if (source) {
    const media = document.createElement(source.kind);
    media.src = source.src;
    if (source.kind === 'video') {
      media.controls = true; media.playsInline = true; media.autoplay = true;
      media.addEventListener('error', () => { note.textContent = '영상을 불러오지 못했습니다. 원본 주소의 만료·접근 권한을 확인해 주세요.'; });
    } else {
      media.title = `${source.provider} 레퍼런스 영상`;
      media.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
      media.allowFullscreen = true;
      media.referrerPolicy = 'strict-origin-when-cross-origin';
      media.addEventListener('error', () => { note.textContent = '서비스에서 미리보기를 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.'; });
    }
    screen.appendChild(media);
    if (source.provider === 'Instagram') kjIgFallback(raw, screen);   // v98 아래에 열기 버튼·그림 접어서 같이
    note.textContent = source.provider === 'Instagram'
      ? '영상 안의 ▶를 눌러 재생하세요. 비공개·삭제·임베드 제한·로그인 요구 영상은 Instagram 정책상 여기서 재생되지 않을 수 있습니다.'
      : '이 화면에서 재생됩니다. 원본 제공자가 임베드를 제한한 영상은 재생되지 않을 수 있습니다.';
  } else {
    screen.textContent = '이 레퍼런스는 영상 미리보기를 지원하지 않습니다.';
    try { const u = new URL(raw); if (['https:', 'http:'].includes(u.protocol)) { const link = document.createElement('a'); link.href = u.href; link.target = '_blank'; link.rel = 'noopener'; link.textContent = '원본 사이트 열기'; note.appendChild(link); } } catch {} 
  }
  dialog.querySelector('[data-ref-close]').onclick = () => dialog.close();
  dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
  dialog.addEventListener('close', () => {
    const video = dialog.querySelector('video'); if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
    dialog.querySelector('iframe')?.remove(); dialog.remove();
    if (previous?.isConnected) previous.focus();
  }, { once: true });
  document.body.appendChild(dialog); dialog.showModal();
}

function kjReferenceMarkup(raw, title = '레퍼런스 영상') {
  const source = kjReferenceSource(raw);
  if (!source) return '<span class="kj-ref-inline kj-ref-unavailable">이 링크는 화면 안 재생을 지원하지 않습니다.</span>';
  const label = esc(title || '레퍼런스 영상');
  const media = source.kind === 'video'
    ? '<video controls playsinline preload="none" src="' + esc(source.src) + '" aria-label="' + label + '"></video>'
    : '<iframe loading="lazy" title="' + label + '" src="' + esc(source.src) + '" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>';
  const go = source.provider === 'Instagram'   // v98 비어 보이면 바로 열 수 있게
    ? '<a class="kj-ig-go" href="' + esc(raw) + '" target="_blank" rel="noopener">인스타그램에서 열기 ↗</a>' : '';
  return '<span class="kj-ref-inline">' + media + go + '<small>영상 안의 ▶로 바로 재생 · 비공개·삭제·임베드 제한 영상은 재생되지 않을 수 있습니다.</small></span>';
}

/* ---------- v53 📥 콘텐츠 후보 (생산 라인 앞단, 10-25 대표 요청) ----------
   인스타연구소(메인 계정 인스타 그룹 DM, 인스타팀)에 공유한 레퍼런스 릴스 → n8n 45가 20분마다 kj_candidates에 카드로 저장(미리보기·썸네일 포함).
   여기서 담당팀(웰니스박스/솔루션즈/기타)을 골라 생산 라인(아이디어)으로 넘기거나, 🏭 대본 양산(운영관리)으로 보내거나, 드랍(되살리기 가능)·삭제(숨김, 다시 수집되지 않음). */
let CANDS = [], cdLoaded = false, cdBusy = false, cdTab = 'new', cdErrAt = 0;
/* v66: DM방별 탭. 출처는 ext_key의 접두사로 구분한다 — 'newbiz:…' = 솔루션즈 신사업부 DM방,
   그 밖(iglab:…·manual:… ·빈값) = 인스타연구소 DM방. n8n 45가 방에 맞는 접두사를 찍어 저장한다. */
const CD_ROOMS = [['iglab', '웰니스박스', '인스타연구소 DM방'], ['newbiz', '신사업부', '솔루션즈 신사업부 DM방']];
let cdRoom = 'iglab';
try { const r0 = localStorage.getItem('kj_cdroom'); if (r0 && CD_ROOMS.some(x => x[0] === r0)) cdRoom = r0; } catch (e) {}
const cdRoomOf = c => { const k = String(c.ext_key || ''), i = k.indexOf(':'); return (i > 0 && k.slice(0, i) === 'newbiz') ? 'newbiz' : 'iglab'; };
const cdRoomRow = r => CD_ROOMS.find(x => x[0] === r) || CD_ROOMS[0];
async function loadCands(){
  const { data, error } = await sb.from('kj_candidates').select('*').neq('status', 'deleted').order('shared_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(600);
  if (error) { cdErrAt = Date.now(); return error; }
  CANDS = data || []; cdLoaded = true; cdBadge(); return null;
}
function cdBadge(){ const b = document.getElementById('cd-badge'); if (!b) return; const n = CANDS.filter(c => c.status === 'new').length; b.textContent = n; b.classList.toggle('hide', !n); }
const cdDate = s => { if (!s) return ''; const d = new Date(s); return (d.getMonth() + 1) + '/' + d.getDate(); };
function cdCard(c){
  const t = c.title || (c.caption || '').split('\n').find(x => x.trim()) || '미리보기 준비 중 (최대 20분)';
  const acts = c.status === 'new'
    ? `<div class="cd-mv"><span>생산 라인으로</span><button class="chip sm" data-cdmv="웰">웰니스박스</button><button class="chip sm" data-cdmv="솔">솔루션즈</button><button class="chip sm" data-cdmv="기타">롱폼/퀵릴스/캐러셀</button><button class="chip sm" data-cdmv="외">외국어</button></div>
       <div class="cd-act"><button class="chip sm" data-cdmass>🏭 대본 양산</button><button class="chip sm" data-cddrop>드랍</button><button class="chip sm cd-del" data-cddel>삭제</button></div>`
    : c.status === 'moved' ? `<div class="cd-done">✅ 생산 라인(${esc(TEAM_LABEL[c.team_tag] || c.team_tag || '')})으로 넘김 · ${cdDate(c.decided_at)}</div>`
    : `<div class="cd-act"><button class="chip sm" data-cdback>되살리기</button><button class="chip sm cd-del" data-cddel>삭제</button></div>`;
  return `<div class="cd-card" data-cdid="${c.id}">
    ${kjReferenceMarkup(c.url, t)}
    <div class="cd-b">${pushBadge(pushHit(c.title, c.caption, c.account))}<div class="cd-acc">${esc(c.account || '인스타그램')}</div>
      <div class="cd-ti">${esc(t)}</div>
      ${c.caption ? `<div class="cd-cap">${esc(c.caption.slice(0, 220))}</div>` : ''}
      ${c.note ? `<div class="cd-note">💬 ${esc(c.note)}</div>` : ''}
      <div class="cd-meta">${c.src === 'manual' ? '직접 추가' : '공유 @' + esc(c.shared_by || '?')} · ${cdDate(c.shared_at || c.created_at)}</div>
      ${acts}</div></div>`;
}
async function cdSet(c, patch){
  const { data, error } = await sb.from('kj_candidates').update({ ...patch, decided_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', c.id).select('id');
  if (error || !data || !data.length) { uiAlert(error ? cleanErr(error.message) : '저장되지 않았습니다(권한 확인).'); return false; }
  Object.assign(c, patch); return true;
}
async function cdMove(c, team){
  // v93 미리보기가 아직 안 온 후보도 카드 제목이 겹치지 않게 — 계정이나 코드를 붙인다
  const fb = '인스타 레퍼런스' + (c.account ? ' · ' + c.account : c.shortcode ? ' · ' + c.shortcode : '');
  const title = (c.title || (c.caption || '').split('\n').find(x => x.trim()) || fb).replace(/\s+/g, ' ').trim().slice(0, 60);
  const { data, error } = await sb.from('contents').insert({ title, stage: IDEA, team_tag: team, reference_url: c.url,
    next_action: `콘텐츠 후보(${cdRoomRow(cdRoomOf(c))[2]})에서 넘어옴 · ${c.account || ''}${c.note ? ' · 메모: ' + c.note : ''}`.slice(0, 500) }).select('id').single();
  if (error) return uiAlert(cleanErr(error.message));
  if (await cdSet(c, { status: 'moved', team_tag: team, content_id: data.id })) { await refresh(); poToast(`생산 라인(${TEAM_LABEL[team]}) 아이디어로 넘겼습니다.`); }
}
async function renderCands(){
  if (!cdLoaded) { if (cdBusy || Date.now() - cdErrAt < 30000) return; cdBusy = true; const e = await loadCands(); cdBusy = false; if (e) return; }
  const v = document.getElementById('view-cands'); if (!v || v.classList.contains('hide')) return;
  await loadPush();
  const inRoom = CANDS.filter(c => cdRoomOf(c) === cdRoom);
  const cnt = s => inRoom.filter(c => c.status === s).length;
  const rooms = document.getElementById('cd-rooms');
  if (rooms) {
    rooms.innerHTML = CD_ROOMS.map(([k, l]) => { const n = CANDS.filter(c => cdRoomOf(c) === k && c.status === 'new').length;
      return `<button class="chip ch ${k === cdRoom ? 'on' : ''}" data-cdroom="${k}">${l}${n ? ' <b>' + n + '</b>' : ''}</button>`; }).join('');
    rooms.querySelectorAll('[data-cdroom]').forEach(b => b.onclick = () => { cdRoom = b.dataset.cdroom;
      try { localStorage.setItem('kj_cdroom', cdRoom); } catch (e) {} renderCands(); });
  }
  const rh = document.getElementById('cd-room-h'); if (rh) rh.textContent = cdRoomRow(cdRoom)[2] + '에 공유된 레퍼런스입니다.';
  const chips = document.getElementById('cd-chips');
  chips.innerHTML = [['new', '새 후보'], ['moved', '넘김'], ['dropped', '드랍']].map(([k, l]) => `<button class="chip ${k === cdTab ? 'on' : ''}" data-cdtab="${k}">${l} ${cnt(k)}</button>`).join('') + '<button class="chip" id="cd-reload" title="새로 불러오기">↻</button>';
  chips.querySelectorAll('[data-cdtab]').forEach(b => b.onclick = () => { cdTab = b.dataset.cdtab; renderCands(); });
  chips.querySelector('#cd-reload').onclick = async () => { cdLoaded = false; await renderCands(); };
  const list = inRoom.filter(c => c.status === cdTab);
  const box = document.getElementById('cd-list');
  box.innerHTML = list.length ? `<div class="cd-grid">${list.map(cdCard).join('')}</div>` : `<p class="lede" style="margin-top:14px">${cdTab === 'new' ? '새 후보가 없습니다. ' + cdRoomRow(cdRoom)[2] + '에 릴스를 공유하면 20분 안에 여기 들어옵니다.' : '없습니다.'}</p>`;
  const get = el => CANDS.find(c => c.id === el.closest('[data-cdid]').dataset.cdid);
  box.querySelectorAll('[data-cdmv]').forEach(b => b.onclick = async () => { b.disabled = true; await cdMove(get(b), b.dataset.cdmv); cdBadge(); renderCands(); });
  box.querySelectorAll('[data-cdmass]').forEach(b => b.onclick = () => { const c = get(b); kjMassModal([{ cand_id: c.id, label: c.title || c.account || '후보' }]); });
  box.querySelectorAll('[data-cddrop]').forEach(b => b.onclick = async () => { if (await cdSet(get(b), { status: 'dropped' })) { cdBadge(); renderCands(); } });
  box.querySelectorAll('[data-cdback]').forEach(b => b.onclick = async () => { if (await cdSet(get(b), { status: 'new' })) { cdBadge(); renderCands(); } });
  box.querySelectorAll('[data-cddel]').forEach(b => b.onclick = async () => { const c = get(b); if (!await uiConfirm('이 후보를 지웁니다.\n목록에서 사라지고 다시 수집되지 않습니다.', { ok: '지우기', danger: true })) return; if (await cdSet(c, { status: 'deleted' })) { CANDS = CANDS.filter(x => x !== c); cdBadge(); renderCands(); } });
}
$('#cd-add') && ($('#cd-add').onclick = async () => {
  const u = $('#cd-url').value.trim().split('?')[0]; if (!/^https?:\/\//.test(u)) return uiAlert('릴스·게시물 링크를 넣어 주세요.');
  const sc = (u.match(/\/(?:reel|reels|p|tv)\/([\w-]+)/) || [])[1] || null;
  const { error } = await sb.from('kj_candidates').insert({ src: 'manual', url: u, shortcode: sc, ext_key: cdRoom + ':' + (sc || 'manual:' + u), shared_at: new Date().toISOString() });
  if (error) return uiAlert(/duplicate|unique/i.test(error.message) ? '이미 후보에 있는 링크입니다.' : cleanErr(error.message));
  $('#cd-url').value = ''; cdLoaded = false; cdTab = 'new'; await renderCands(); poToast(`${cdRoomRow(cdRoom)[1]} 후보에 넣었습니다. 미리보기는 20분 안에 채워집니다.`);
});


/* ---------- v54 🔎 분석 대상 · 🏭 대본 양산 (운영관리 탭, 10-26 대표 요청) ----------
   분석 대상: kj_targets 최근 게시물 조회수를 n8n 46이 인스타 공식 API로 수집(kj_tposts). v80: 출처(sources) 표시·필터 제거
     → 계정 평소(중앙값) 대비 2.5배↑·2만↑ 또는 30만↑ = 🔥 터진 영상 → AI가 주제·형식·훅·김제조 각도 태깅
   대본 양산: 고른 영상·콘텐츠 후보·링크 → 형식(kj_formats) + 김제조 대본 스킬로 초안 N개(kj-anal 함수) → 하나 골라 생산 라인(대본 단계)으로 */
let anTab = 'hot', anSel = new Set(), anDays = 90, anFmt = '', anSort = 'score', anData = null, msTimer = null, anPush = false;
let anTSel = new Set(), anTSort = 'followers', anTDesc = true;   // v80 계정 탭: 다중 선택 + 정렬
const kjFnUrl = () => String(window.SUPABASE_URL).replace(/\/+$/, '') + '/functions/v1/kj-anal';
async function kjFn(body){
  const { data: { session } } = await sb.auth.getSession();
  const r = await fetch(kjFnUrl(), { method: 'POST', headers: { Authorization: 'Bearer ' + session.access_token, apikey: window.SUPABASE_ANON_KEY, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return r.json().catch(() => ({ error: '응답 오류 ' + r.status }));
}
async function loadAnal(){
  const [t, p, th] = await Promise.all([
    sb.from('kj_targets').select('*').order('influence', { ascending: false, nullsFirst: false }),
    sb.from('kj_tposts').select('id,handle,caption,permalink,posted_at,views,likes,comments,ratio,hot,topic,hook,kj_angle,fmt_guess,status,content_id,product_type,thumb,created_at,ai_at,decided_at').order('views', { ascending: false, nullsFirst: false }).limit(1500),
    sb.from('kj_tposts').select('id,handle,caption,permalink,posted_at,views,likes,comments,ratio,hot,topic,hook,kj_angle,fmt_guess,status,content_id,product_type,thumb,created_at,ai_at,decided_at').like('product_type', 'THREADS%').order('posted_at', { ascending: false, nullsFirst: false }).limit(900)]);
  const isThr = x => /^THREADS/.test(x.product_type || '');
  anData = { targets: t.data || [], posts: (p.data || []).filter(x => !isThr(x)), threads: th.data || [], err: t.error || p.error };
}
const anScore = p => (p.ratio || 1) * Math.log10(Math.max(10, p.views || 10)) * (pushHit(p.topic, p.caption, p.hook, p.kj_angle) ? 2 : 1);   // v71: 밀기 소재는 추천순에서 위로
function anCard(p, tg){
  const sel = anSel.has(p.id);
  return `<div class="an-card ${sel ? 'sel' : ''} ${p.status === 'starred' ? 'star' : ''}" data-anid="${esc(p.id)}">
    ${kjReferenceMarkup(p.permalink, p.topic || p.handle)}<div class="an-acc">조회 ${opsN(p.views)}${p.ratio ? ` · 평소의 ${p.ratio}배` : ''}</div>
    <div class="an-b">${pushBadge(pushHit(p.topic, p.caption, p.hook, p.kj_angle))}<div class="an-acc">@${esc(p.handle)}${tg && tg.followers ? ' · ' + opsN(tg.followers) : ''}${p.posted_at ? ' · ' + (new Date(p.posted_at).getMonth() + 1) + '/' + new Date(p.posted_at).getDate() : ''}</div>
      ${p.topic ? `<div class="an-ti">${esc(p.topic)}${p.fmt_guess ? ` <span class="an-fmt">${esc(p.fmt_guess)}</span>` : ''}</div>` : ''}
      ${p.hook ? `<div class="an-hook">“${esc(p.hook)}”</div>` : `<div class="an-cap">${esc((p.caption || '').slice(0, 110))}</div>`}
      ${p.kj_angle ? `<div class="an-angle">💡 ${esc(p.kj_angle)}</div>` : ''}
      <div class="an-act">${p.status === 'mass' ? '<span class="an-st">🏭 양산 중</span>' : p.status === 'line' ? '<span class="an-st">✅ 생산 라인</span>' : `<label class="an-chk"><input type="checkbox" data-ansel ${sel ? 'checked' : ''}> 선택</label>
        <button class="chip sm" data-anmass>🏭 양산</button><button class="chip sm" data-anstar>${p.status === 'starred' ? '★' : '☆'}</button>
        <button class="chip sm" data-anline="웰" title="웰니스박스 라인 아이디어로">→웰니스</button><button class="chip sm" data-anline="솔" title="솔루션즈 라인 아이디어로">→솔루션즈</button><button class="chip sm" data-anline="기타" title="롱폼/퀵릴스/캐러셀 라인 아이디어로">→롱폼</button><button class="chip sm" data-anline="외" title="외국어 라인 아이디어로">→외국어</button><button class="chip sm cd-del" data-androp>드랍</button><button class="chip sm cd-del" data-anacc="${esc(p.handle)}" title="이 계정을 분석 대상에서 지웁니다 (그 계정 영상 전부)">@계정 삭제</button>`}</div></div></div>`;
}
async function renderOpsAnal(body){
  if (!anData) { body.innerHTML = '<p class="lede">불러오는 중…</p>'; await loadAnal(); }
  await loadPush();
  const { targets, posts } = anData; const T = new Map(targets.map(t => [t.handle, t]));
  const fetched = targets.filter(t => t.last_fetch && !t.fetch_error).length, errs = targets.filter(t => t.fetch_error).length;
  const since = anDays ? Date.now() - anDays * 86400000 : 0;
  let list = posts.filter(p => p.status !== 'dropped' && (!since || !p.posted_at || new Date(p.posted_at).getTime() >= since));
  if (anTab === 'hot') list = list.filter(p => p.hot);
  if (anFmt) list = list.filter(p => p.fmt_guess === anFmt);
  if (anPush) list = list.filter(p => pushHit(p.topic, p.caption, p.hook, p.kj_angle));
  list.sort(anSort === 'views' ? (a, b) => (b.views || 0) - (a.views || 0) : anSort === 'new' ? (a, b) => String(b.posted_at).localeCompare(String(a.posted_at)) : (a, b) => anScore(b) - anScore(a));
  const fmts = [...new Set(posts.filter(p => p.hot && p.fmt_guess).map(p => p.fmt_guess))];
  const chip = (attr, v, cur, l) => `<button class="chip sm ${String(v) === String(cur) ? 'on' : ''}" ${attr}="${esc(String(v))}">${esc(l)}</button>`;
  body.innerHTML = `<div class="an-head"><b>분석 대상 ${targets.length}계정</b> · 수집 ${fetched}${errs ? ` · 오류 ${errs}` : ''} · 영상 ${posts.length} · 🔥 ${posts.filter(p => p.hot).length}
      <button class="chip sm" id="an-re">↻</button><button class="chip sm" id="an-addjump">＋ 계정 추가·삭제</button>${posts.some(p => p.hot && !p.ai_at) ? '<button class="chip sm" id="an-tag">🤖 AI 분류 지금</button>' : ''}</div>
    ${!fetched ? `<div class="an-wait">🔌 <b>조회수 수집 연결 대기</b> — 인스타 공식 API(Facebook 로그인) 토큰이 연결되면 1시간마다 20계정씩 최근 게시물·조회수를 모읍니다. 계정 목록은 준비됐습니다(아래 '👥 계정').</div>` : ''}
    <div class="an-tabs">${chip('data-antab', 'hot', anTab, '🔥 추천')}${chip('data-antab', 'all', anTab, '📊 전체 영상')}${chip('data-antab', 'thr', anTab, '🧵 쓰레드 ' + (anData.threads || []).filter(x => x.product_type === 'THREADS').length)}${chip('data-antab', 'targets', anTab, '👥 계정 ' + targets.length)}</div>
    <div id="an-body"></div>`;
  body.querySelector('#an-re').onclick = async () => { anData = null; renderOpsAnal(body); };
  body.querySelector('#an-addjump').onclick = () => { anTab = 'targets'; renderOpsAnal(body); setTimeout(() => { const i = body.querySelector('#an-h'); if (i) i.focus(); }, 60); };
  const tb = body.querySelector('#an-tag'); if (tb) tb.onclick = async () => { tb.disabled = true; tb.textContent = '분류 중…'; const j = await kjFn({ action: 'tag_now' }); if (j.error) uiAlert(j.error); anData = null; renderOpsAnal(body); };
  body.querySelectorAll('[data-antab]').forEach(b => b.onclick = () => { anTab = b.dataset.antab; renderOpsAnal(body); });
  const ab = body.querySelector('#an-body');
  if (anTab === 'thr') return renderAnThreads(ab, body);
  if (anTab === 'targets') return renderAnTargets(ab, body);
  ab.innerHTML = `<div class="an-filters"><span>기간</span>${[[30, '30일'], [90, '90일'], [0, '전체']].map(([v, l]) => chip('data-andays', v, anDays, l)).join('')}
      <span>정렬</span>${chip('data-ansort', 'score', anSort, '추천순')}${chip('data-ansort', 'views', anSort, '조회수')}${chip('data-ansort', 'new', anSort, '최신')}
      ${pushLive().length ? `<span>밀기</span><button class="chip sm ${anPush ? 'on' : ''}" id="an-pushf">🎯 ${pushLive().map(p => esc(p.name)).join('·')}만</button>` : ''}
      ${fmts.length ? `<br><span>형식</span>${chip('data-anfmt', '', anFmt, '전체')}${fmts.map(f => chip('data-anfmt', f, anFmt, f)).join('')}` : ''}</div>
    ${anTab === 'hot' ? '<p class="an-note">🔥 = 그 계정 평소(최근 영상 중앙값) 대비 2.5배 이상이면서 2만 회 이상, 또는 30만 회 이상. 추천순 = 배수 × 조회수 규모.</p>' : ''}
    <div class="an-grid">${list.slice(0, 240).map(p => anCard(p, T.get(p.handle))).join('') || '<p class="lede">아직 없습니다.</p>'}</div>
    <div class="an-bar ${anSel.size ? '' : 'hide'}" id="an-bar"><b>${anSel.size}개 선택</b><button class="btn sm" id="an-go">🏭 대본 양산으로</button><button class="chip sm" id="an-clr">선택 해제</button></div>`;
  const re = () => renderOpsAnal(body);
  ab.querySelectorAll('[data-andays]').forEach(b => b.onclick = () => { anDays = +b.dataset.andays; re(); });
  ab.querySelectorAll('[data-ansort]').forEach(b => b.onclick = () => { anSort = b.dataset.ansort; re(); });
  ab.querySelectorAll('[data-anfmt]').forEach(b => b.onclick = () => { anFmt = b.dataset.anfmt; re(); });
  const pf = ab.querySelector('#an-pushf'); if (pf) pf.onclick = () => { anPush = !anPush; re(); };
  const P = el => posts.find(p => p.id === el.closest('[data-anid]').dataset.anid);
  const upd = async (p, patch) => { const { data, error } = await sb.from('kj_tposts').update({ ...patch, decided_at: new Date().toISOString() }).eq('id', p.id).select('id'); if (error || !data?.length) { uiAlert(error ? cleanErr(error.message) : '저장 안 됨'); return false; } Object.assign(p, patch); return true; };
  ab.querySelectorAll('[data-ansel]').forEach(c => c.onchange = () => { const p = P(c); c.checked ? anSel.add(p.id) : anSel.delete(p.id); re(); });
  ab.querySelectorAll('[data-anstar]').forEach(b => b.onclick = async () => { const p = P(b); if (await upd(p, { status: p.status === 'starred' ? 'new' : 'starred' })) re(); });
  ab.querySelectorAll('[data-androp]').forEach(b => b.onclick = async () => { const p = P(b); if (await upd(p, { status: 'dropped' })) { anSel.delete(p.id); re(); } });
  ab.querySelectorAll('[data-anacc]').forEach(b => b.onclick = () => anDelete([b.dataset.anacc], body));
  ab.querySelectorAll('[data-anmass]').forEach(b => b.onclick = () => kjMassModal([{ post_id: P(b).id, label: '@' + P(b).handle + ' ' + (P(b).topic || '') }]));
  ab.querySelectorAll('[data-anline]').forEach(b => b.onclick = async () => {
    const p = P(b); const team = b.dataset.anline; if (!TEAM_LABEL[team] || b.disabled) return; ab.querySelectorAll('[data-anid="' + p.id + '"] [data-anline]').forEach(x => x.disabled = true);
    const title = (p.topic ? p.topic + ' — ' : '') + ((p.caption || '').split('\n').find(x => x.trim()) || '@' + p.handle);
    const { data, error } = await sb.from('contents').insert({ title: title.replace(/\s+/g, ' ').slice(0, 60), stage: IDEA, team_tag: team, reference_url: p.permalink,
      next_action: `🔎 분석 대상(@${p.handle}, 조회 ${opsN(p.views)}${p.ratio ? ', 평소의 ' + p.ratio + '배' : ''})에서 넘어옴${p.kj_angle ? ' · 각도: ' + p.kj_angle : ''}`.slice(0, 500) }).select('id').single();
    if (error) return uiAlert(cleanErr(error.message));
    await upd(p, { status: 'line', content_id: data.id }); await refresh(); poToast(`생산 라인(${TEAM_LABEL[team]}) 아이디어로 넘겼습니다.`); re(); });
  const go = ab.querySelector('#an-go'); if (go) go.onclick = () => kjMassModal([...anSel].map(id => { const p = posts.find(x => x.id === id); return { post_id: id, label: '@' + (p ? p.handle + ' ' + (p.topic || '') : id) }; }), () => { anSel.clear(); });
  const clr = ab.querySelector('#an-clr'); if (clr) clr.onclick = () => { anSel.clear(); re(); };
}
/* v87 🧵 쓰레드 — 분석 대상 계정이 같은 아이디로 쓰는 쓰레드를 모아 벤치마크 재료로 쓴다.
   AI 컴퓨터의 수집기(D:\AI\Automations\kj_threads)가 쓰레드 공개 프로필을 읽어 kj_tposts 에 넣는다.
   product_type='THREADS_PROFILE' = 계정 한 줄(likes 칸에 쓰레드 팔로워), 'THREADS' = 글 한 개. */
let anThrSort = 'new', anThrAcc = '';
function renderAnThreads(ab, body){
  const all = anData.threads || [];
  const accs = all.filter(x => x.product_type === 'THREADS_PROFILE');
  const folOf = new Map(accs.map(a => [a.handle, a.likes || 0]));
  let posts = all.filter(x => x.product_type === 'THREADS' && x.status !== 'dropped');
  if (anThrAcc) posts = posts.filter(p => p.handle === anThrAcc);
  posts = posts.slice().sort(anThrSort === 'fol'
    ? (a, b) => (folOf.get(b.handle) || 0) - (folOf.get(a.handle) || 0)
    : (a, b) => String(b.posted_at || '').localeCompare(String(a.posted_at || '')));
  const star = posts.filter(p => p.status === 'starred').length;
  const chip = (attr, v, cur, l) => `<button class="chip sm ${String(v) === String(cur) ? 'on' : ''}" ${attr}="${esc(String(v))}">${esc(l)}</button>`;
  const top = accs.slice().sort((a, b) => (b.likes || 0) - (a.likes || 0));
  ab.innerHTML = `<p class="an-note">분석 대상(한국어 운영) 계정 중 <b>같은 아이디로 쓰레드를 하는 ${accs.length}곳</b>입니다. 남이 쓴 글을 <b>★ 벤치마크</b>로 담아 두면, 그 틀·호흡을 본떠 말투와 단어만 바꾼 우리 쓰레드 초안을 만들 때 재료로 씁니다. (※ 남의 문장을 그대로 쓰지 않습니다)</p>
    <div class="an-filters"><span>정렬</span>${chip('data-athrs', 'new', anThrSort, '최신')}${chip('data-athrs', 'fol', anThrSort, '팔로워 많은 곳')}
      <span>계정</span>${chip('data-athra', '', anThrAcc, '전체 ' + posts.length)}${top.filter(a => all.some(x => x.product_type === 'THREADS' && x.handle === a.handle)).slice(0, 14).map(a => chip('data-athra', a.handle, anThrAcc, '@' + a.handle)).join('')}</div>
    ${star ? `<p class="an-note">★ 벤치마크로 담은 글 <b>${star}개</b>. 쓰레드 초안을 만들 때 이 글들의 구성을 참고합니다.</p>` : ''}
    <div class="thr-grid">${posts.slice(0, 200).map(p => `<div class="thr-card ${p.status === 'starred' ? 'star' : ''}" data-thrid="${esc(p.id)}">
      <div class="thr-h"><a href="${esc(p.permalink)}" target="_blank" rel="noopener">@${esc(p.handle)}</a>
        <span>${folOf.get(p.handle) ? opsN(folOf.get(p.handle)) : '-'}${p.posted_at ? ' · ' + String(p.posted_at).slice(0, 10) : ''}</span></div>
      <div class="thr-t">${esc(p.caption || '')}</div>
      <div class="thr-b"><button class="chip sm" data-thrstar>${p.status === 'starred' ? '★ 담음' : '☆ 벤치마크'}</button>
        <button class="chip sm" data-thrcopy>복사</button>
        <a class="chip sm" href="${esc(p.permalink)}" target="_blank" rel="noopener">원문</a>
        <button class="chip sm cd-del" data-thrdrop>숨김</button></div></div>`).join('') || '<p class="lede">아직 모은 글이 없습니다.</p>'}</div>
    <details style="margin-top:14px"><summary>쓰레드를 하는 계정 ${accs.length}곳 (팔로워순)</summary>
      <div class="tbl-wrap"><table class="an-tbl"><tr><th>계정</th><th>쓰레드 팔로워</th><th>모은 글</th><th></th></tr>
      ${top.map(a => `<tr><td>@${esc(a.handle)}</td><td>${a.likes ? opsN(a.likes) : '-'}</td><td>${all.filter(x => x.product_type === 'THREADS' && x.handle === a.handle).length}</td>
        <td><a class="chip sm" href="${esc(a.permalink)}" target="_blank" rel="noopener">열기</a></td></tr>`).join('')}</table></div></details>`;
  const re = () => renderAnThreads(ab, body);
  ab.querySelectorAll('[data-athrs]').forEach(b => b.onclick = () => { anThrSort = b.dataset.athrs; re(); });
  ab.querySelectorAll('[data-athra]').forEach(b => b.onclick = () => { anThrAcc = b.dataset.athra; re(); });
  const P = el => all.find(x => x.id === el.closest('[data-thrid]').dataset.thrid);
  const set = async (p, patch) => { const { error } = await sb.from('kj_tposts').update(patch).eq('id', p.id); if (error) { uiAlert(cleanErr(error.message)); return false; } Object.assign(p, patch); return true; };
  ab.querySelectorAll('[data-thrstar]').forEach(b => b.onclick = async () => { const p = P(b); if (await set(p, { status: p.status === 'starred' ? 'new' : 'starred' })) re(); });
  ab.querySelectorAll('[data-thrdrop]').forEach(b => b.onclick = async () => { const p = P(b); if (await set(p, { status: 'dropped' })) re(); });
  ab.querySelectorAll('[data-thrcopy]').forEach(b => b.onclick = async () => { const p = P(b); try { await navigator.clipboard.writeText(p.caption || ''); poToast('복사했습니다.'); } catch (e) { uiAlert('복사가 막혔습니다. 글을 직접 긁어 주세요.'); } });
}

// v80 분석 대상 계정 — 출처 제거, 여러 개 한 번에 삭제, 열 눌러 정렬
async function anDelete(handles, body){
  const hs = [...new Set(handles)].filter(Boolean);
  if (!hs.length) return;
  const msg = hs.length === 1
    ? '@' + hs[0] + ' 을(를) 분석 대상에서 지울까요?\n모아 둔 그 계정 영상도 같이 지워집니다. (수집만 멈추려면 「사용」 체크를 끄세요)'
    : hs.length + '개 계정을 분석 대상에서 지울까요?\n' + hs.slice(0, 8).map(h => '@' + h).join(', ') + (hs.length > 8 ? ' 외 ' + (hs.length - 8) + '개' : '') + '\n모아 둔 그 계정 영상도 같이 지워집니다.';
  if (!await uiConfirm(msg)) return;
  await sb.from('kj_tposts').delete().in('handle', hs);
  const { error } = await sb.from('kj_targets').delete().in('handle', hs);
  if (error) return uiAlert(cleanErr(error.message));
  anTSel.clear(); anData = null; renderOpsAnal(body);
  poToast(hs.length + '개 계정을 지웠습니다.', 4000);
}
// v82 수집 오류를 읽을 수 있는 말로
function anErr(e){
  const s = String(e || '');
  if (/2207013|Invalid user id/.test(s)) return { s: '읽기 불가', t: '인스타가 이 아이디를 찾지 못합니다. 아이디가 바뀌었거나 없어진 계정이거나, 비즈니스·크리에이터가 아닌 개인 계정입니다. 둘 다 조회수를 모을 수 없습니다.' };
  if (/rate limit|throttl|\(#4\)|#613/i.test(s)) return { s: '한도 초과', t: '인스타 API 호출 한도에 걸렸습니다. 다음 수집 때 다시 시도합니다.' };
  if (/token|OAuthException|#190/i.test(s)) return { s: '연결 오류', t: '인스타 연결(토큰) 문제입니다. ' + s.slice(0, 160) };
  return { s: '오류', t: s };
}
function renderAnTargets(ab, body){
  const K = { handle: t => String(t.handle || ''), followers: t => (t.followers || (t.influence ? t.influence * 10000 : 0) || 0),
              views: t => (t.median_views || 0), hot: t => (t.hot_n || 0), fetch: t => (t.last_fetch ? new Date(t.last_fetch).getTime() : 0) };
  const f = K[anTSort] || K.followers;
  const ts = anData.targets.slice().sort((x, y) => { const a = f(x), b = f(y); const r = typeof a === 'string' ? a.localeCompare(b) : (a - b); return anTDesc ? -r : r; });
  const th = (k, l) => `<th data-antsort="${k}" style="cursor:pointer;white-space:nowrap">${l}${anTSort === k ? (anTDesc ? ' ▼' : ' ▲') : ''}</th>`;
  const n = anTSel.size;
  const bad = ts.filter(t => t.fetch_error && anErr(t.fetch_error).s === '읽기 불가');
  ab.innerHTML = `<div class="an-filters"><input id="an-h" placeholder="@계정 추가 — 여러 개는 쉼표·줄바꿈, 인스타 링크도 됩니다" style="min-width:320px;flex:1"><input id="an-hm" placeholder="메모(선택)" style="max-width:200px"><button class="btn sm" id="an-hadd">＋ 추가</button></div>
    <p class="an-note">비즈니스·크리에이터 계정만 조회수 수집이 됩니다. <b>사용</b>을 끄면 수집에서만 빠지고 모아 둔 영상은 남습니다. <b>삭제</b>는 계정과 그 계정 영상까지 지웁니다. 제목 줄(팔로워·평소 조회 등)을 누르면 정렬됩니다.${bad.length ? ` <b style="color:var(--bad)">읽기 불가 ${bad.length}개</b> — 아이디가 바뀌었거나 개인 계정이라 조회수를 영영 못 모읍니다. 아래 버튼으로 한 번에 골라 지우세요.` : ''}</p>
    <div class="an-filters"><label class="an-chk"><input type="checkbox" id="an-tall" ${n && n === ts.length ? 'checked' : ''}> 전체 선택</label>
      ${bad.length ? `<button class="chip sm" id="an-tbad">읽기 불가 ${bad.length}개 선택</button>` : ''}
      ${n ? `<button class="btn sm danger" id="an-tdel">선택한 ${n}개 삭제</button><button class="chip sm" id="an-tclr">선택 해제</button>` : '<span class="rv-sub">왼쪽 칸을 체크하면 여러 개를 한 번에 지울 수 있습니다</span>'}</div>
    <div class="tbl-wrap"><table class="an-tbl"><tr><th></th>${th('handle', '계정')}${th('followers', '팔로워')}${th('views', '평소 조회')}${th('hot', '🔥')}${th('fetch', '수집')}<th>사용</th><th></th></tr>
    ${ts.map(t => `<tr class="${t.active ? '' : 'off'}"><td><input type="checkbox" data-antsel="${esc(t.handle)}" ${anTSel.has(t.handle) ? 'checked' : ''}></td>
      <td><a href="https://www.instagram.com/${esc(t.handle)}/" target="_blank" rel="noopener">@${esc(t.handle)}</a>${t.name ? ' ' + esc(t.name) : ''}${t.lang === 'en' ? ' 🌐' : ''}${t.info ? `<div class="an-info">${esc(t.info)}</div>` : ''}</td>
      <td>${t.followers ? opsN(t.followers) : (t.influence ? t.influence + '만*' : '-')}</td><td>${t.median_views ? opsN(t.median_views) : '-'}</td><td>${t.hot_n || ''}</td>
      <td>${t.fetch_error ? `<span title="${esc(anErr(t.fetch_error).t)}" style="color:var(--bad)">${anErr(t.fetch_error).s}</span>` : t.last_fetch ? (new Date(t.last_fetch).getMonth() + 1) + '/' + new Date(t.last_fetch).getDate() : '대기'}</td>
      <td><input type="checkbox" data-anact="${esc(t.handle)}" ${t.active ? 'checked' : ''}></td>
      <td><button class="chip sm cd-del" data-andel="${esc(t.handle)}" title="계정과 그 계정 영상까지 지웁니다">삭제</button></td></tr>`).join('')}</table></div>
    <p class="an-note">* 팔로워 칸의 '만*'은 26.09 조사 당시 영향력 수치입니다.</p>`;
  const re = () => renderAnTargets(ab, body);
  ab.querySelectorAll('[data-antsort]').forEach(h => h.onclick = () => { const k = h.dataset.antsort; if (anTSort === k) anTDesc = !anTDesc; else { anTSort = k; anTDesc = k !== 'handle'; } re(); });
  ab.querySelectorAll('[data-antsel]').forEach(c => c.onchange = () => { c.checked ? anTSel.add(c.dataset.antsel) : anTSel.delete(c.dataset.antsel); re(); });
  const all = ab.querySelector('#an-tall');
  if (all) all.onchange = () => { anTSel.clear(); if (all.checked) ts.forEach(t => anTSel.add(t.handle)); re(); };
  const dsel = ab.querySelector('#an-tdel'); if (dsel) dsel.onclick = () => anDelete([...anTSel], body);
  const cclr = ab.querySelector('#an-tclr'); if (cclr) cclr.onclick = () => { anTSel.clear(); re(); };
  const cbad = ab.querySelector('#an-tbad'); if (cbad) cbad.onclick = () => { bad.forEach(t => anTSel.add(t.handle)); re(); };
  ab.querySelectorAll('[data-anact]').forEach(c => c.onchange = async () => { const { error } = await sb.from('kj_targets').update({ active: c.checked }).eq('handle', c.dataset.anact); if (error) uiAlert(cleanErr(error.message)); else anData.targets.find(t => t.handle === c.dataset.anact).active = c.checked; });
  ab.querySelectorAll('[data-andel]').forEach(b => b.onclick = () => anDelete([b.dataset.andel], body));
  const anAdd = async () => {
    const raw = $('#an-h').value;
    const hs = [...new Set(raw.split(/[\s,·]+/).map(x => x.trim().replace(/^@/, '').replace(/^https?:\/\//, '').replace(/.*instagram\.com\//, '').replace(/[/?#].*$/, '').toLowerCase()).filter(x => /^[a-z0-9._]{2,30}$/.test(x)))];
    if (!hs.length) return uiAlert('계정 아이디를 적어 주세요. 여러 개면 쉼표나 줄바꿈으로 나눠 적으면 됩니다.');
    const have = new Set(anData.targets.map(t => t.handle));
    const neu = hs.filter(h => !have.has(h));
    if (!neu.length) return uiAlert('이미 모두 들어 있는 계정입니다.');
    const memo = $('#an-hm').value.trim() || null;
    const { error } = await sb.from('kj_targets').insert(neu.map(h => ({ handle: h, info: memo })));
    if (error) return uiAlert(cleanErr(error.message));
    $('#an-h').value = ''; $('#an-hm').value = '';
    anData = null; renderOpsAnal(body);
    poToast(neu.length + '개 추가(' + neu.slice(0, 3).map(h => '@' + h).join(', ') + (neu.length > 3 ? ' 외' : '') + '). 다음 수집 때 조회수를 모읍니다.' + (hs.length > neu.length ? ' 이미 있던 ' + (hs.length - neu.length) + '개는 건너뜀.' : ''));
  };
  ab.querySelector('#an-hadd').onclick = anAdd;
  ab.querySelector('#an-h').onkeydown = e => { if (e.key === 'Enter') anAdd(); };
}
async function kjMassModal(items, after){
  const { data: fm } = await sb.from('kj_formats').select('id, grp, name').order('sort');
  const grps = [...new Set((fm || []).map(f => f.grp))];
  const bg = document.createElement('div'); bg.className = 'aiw-bg';
  bg.innerHTML = `<div class="aiw"><h3>🏭 대본 양산 — ${items.length}개</h3>
    <div class="sub">고른 레퍼런스마다 김제조 말투 대본 초안을 여러 개 씁니다. 결과는 운영관리 › 🏭 대본 양산 탭에서 골라 생산 라인으로 넘깁니다.</div>
    <div class="ms-items">${items.map(i => `<span>${esc(i.label || i.url || '')}</span>`).join('')}</div>
    <label>형식</label><select id="ms-fmt"><option value="">레퍼런스 구조 그대로 (형식 자유)</option>${grps.map(g => `<optgroup label="${esc(g)}">${fm.filter(f => f.grp === g).map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('')}</optgroup>`).join('')}</select>
    <label>레퍼런스마다 초안 수</label><select id="ms-n"><option>1</option><option selected>2</option><option>3</option><option>4</option></select>
    <label>담당팀 (말투 예시를 이 팀 대본에서 가져옴)</label><select id="ms-team"><option value="솔">솔루션즈</option><option value="웰">웰니스박스</option><option value="기타">롱폼/퀵릴스/캐러셀</option><option value="외">외국어</option></select>
    <label>추가 지시 (선택)</label><input id="ms-note" placeholder="예: 40초 이내, 숫자 근거 1개 이상, 마지막에 댓글 유도 질문">
    <div class="row"><button class="btn sm" id="ms-go">🏭 양산 시작</button><button class="chip" id="ms-x">닫기</button><span id="ms-st" class="u-sm2"></span></div></div>`;
  document.body.appendChild(bg);
  const $b = s => bg.querySelector(s); const close = () => bg.remove();
  $b('#ms-x').onclick = close; bg.onclick = e => { if (e.target === bg) close(); };
  $b('#ms-go').onclick = async () => {
    $b('#ms-go').disabled = true; $b('#ms-st').textContent = '보내는 중…';
    const j = await kjFn({ action: 'mass_queue', items: items.map(({ label, ...x }) => x), format_id: $b('#ms-fmt').value || null, n: +$b('#ms-n').value, team: $b('#ms-team').value, note: $b('#ms-note').value });
    if (j.error) { $b('#ms-go').disabled = false; $b('#ms-st').textContent = ''; return uiAlert(j.error); }
    close(); if (after) after(); if (anData) anData = null;
    poToast(`${j.queued}건 양산 시작. 1건에 30~90초 — 🏭 대본 양산 탭에서 확인하세요.`, 4000);
    try { opsTab = 'mass'; localStorage.setItem('kj_opstab', 'mass'); } catch (e) {}
    if (!$('#view-video').classList.contains('hide')) renderVideo();
  };
}
async function renderOpsMass(body){
  const { data: jobs, error } = await sb.from('kj_mass_jobs').select('*').neq('status', 'dropped').order('created_at', { ascending: false }).limit(60);
  if (error) { body.innerHTML = `<div class="msg">⚠ ${esc(error.message)}</div>`; return; }
  const ST = { queued: '대기', writing: '✍️ 쓰는 중', done: '✅ 초안 완료', error: '⚠ 오류', moved: '➡ 생산 라인' };
  body.innerHTML = `<div class="ms-new"><b>새로 양산</b> <span class="an-note">링크·글을 한 줄에 하나씩 (인스타·유튜브 링크, 또는 아이디어 문장)</span>
      <textarea id="ms-lines" rows="3" placeholder="https://www.instagram.com/reel/...&#10;마그네슘 종류별 흡수율 비교"></textarea>
      <div class="row"><button class="btn sm" id="ms-fromtext">🏭 이걸로 양산</button><button class="chip sm" id="ms-fromcand">📥 콘텐츠 후보에서 고르기</button><button class="chip sm" id="ms-fromanal">🔎 분석 대상 추천에서 고르기</button></div></div>
    <div class="ms-list">${(jobs || []).map(j => `<div class="ms-job st-${j.status}" data-msid="${j.id}">
      <div class="ms-h"><b>${esc(j.ref_title || j.ref_url || '레퍼런스')}</b> <span class="ms-st">${ST[j.status] || j.status}</span>
        <span class="an-note">${esc(j.format_label || '형식 자유')} · ${TEAM_LABEL[j.team_tag] || ''} · ${new Date(j.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}${j.ref_views ? ' · 원본 ' + opsN(j.ref_views) + '회' : ''}</span>
        
        <span class="u-push"></span>${['error', 'done'].includes(j.status) ? '<button class="chip sm" data-msretry>다시 쓰기</button>' : ''}${j.status !== 'moved' ? '<button class="chip sm cd-del" data-msdrop>드랍</button>' : ''}</div>
      ${j.ref_url ? kjReferenceMarkup(j.ref_url, j.ref_title) : ''}
      ${j.status === 'error' ? `<div class="msg">⚠ ${esc(j.error || '')}</div>` : ''}
      ${(j.drafts || []).length ? `<div class="ms-drafts">${j.drafts.map((d, i) => `<details ${i === 0 && j.status === 'done' ? 'open' : ''} class="${j.chosen === i ? 'chosen' : ''}"><summary><b>초안 ${i + 1}</b> ${esc(d.title || '')}${d.hook ? ` — <i>${esc(d.hook)}</i>` : ''}${j.chosen === i ? ' ✅' : ''}</summary>
        <table><tr><th style="width:40%">장면</th><th>대사/자막</th></tr>${(d.rows || []).map(r => `<tr><td>${esc(r.scene)}</td><td>${esc(r.line)}</td></tr>`).join('')}</table>
        ${d.notes ? `<div class="an-note">메모: ${esc(d.notes)}</div>` : ''}
        ${j.status === 'done' ? `<div class="row"><span class="an-note">생산 라인(대본 단계)으로:</span><button class="chip sm" data-msline="${i}" data-team="웰">웰니스박스</button><button class="chip sm" data-msline="${i}" data-team="솔">솔루션즈</button><button class="chip sm" data-msline="${i}" data-team="기타">롱폼/퀵릴스/캐러셀</button><button class="chip sm" data-msline="${i}" data-team="외">외국어</button></div>` : ''}</details>`).join('')}</div>` : ''}
    </div>`).join('') || '<p class="lede">아직 양산한 대본이 없습니다.</p>'}</div>`;
  const J = el => (jobs || []).find(j => j.id === el.closest('[data-msid]').dataset.msid);
  body.querySelectorAll('[data-msline]').forEach(b => b.onclick = async () => { b.disabled = true; const r = await kjFn({ action: 'mass_line', id: J(b).id, idx: +b.dataset.msline, team: b.dataset.team });
    if (r.error) { b.disabled = false; return uiAlert(r.error); } await refresh(); poToast(`생산 라인(${TEAM_LABEL[b.dataset.team]}) '대본' 단계에 카드로 넣었습니다.`); renderOpsMass(body); });
  body.querySelectorAll('[data-msretry]').forEach(b => b.onclick = async () => { await kjFn({ action: 'mass_retry', id: J(b).id }); setTimeout(() => renderOpsMass(body), 800); });
  body.querySelectorAll('[data-msdrop]').forEach(b => b.onclick = async () => { await sb.from('kj_mass_jobs').update({ status: 'dropped', updated_at: new Date().toISOString() }).eq('id', J(b).id); renderOpsMass(body); });
  body.querySelector('#ms-fromtext').onclick = () => { const ls = body.querySelector('#ms-lines').value.split('\n').map(s => s.trim()).filter(Boolean); if (!ls.length) return;
    kjMassModal(ls.map(l => /^https?:\/\//.test(l) ? { url: l.split('?')[0], label: l.slice(0, 60) } : { text: l, title: l.slice(0, 60), label: l.slice(0, 60) })); };
  body.querySelector('#ms-fromanal').onclick = () => { opsTab = 'anal'; try { localStorage.setItem('kj_opstab', 'anal'); } catch (e) {} renderVideo(); };
  body.querySelector('#ms-fromcand').onclick = async () => {
    const { data: cs } = await sb.from('kj_candidates').select('id, account, title, thumb, url, ext_key').eq('status', 'new').order('shared_at', { ascending: false }).limit(80);
    const bg = document.createElement('div'); bg.className = 'aiw-bg';
    bg.innerHTML = `<div class="aiw"><h3>📥 콘텐츠 후보에서 고르기</h3><div class="ms-pick">${(cs || []).map(c => `<label><input type="checkbox" value="${c.id}">${kjReferenceMarkup(c.url, c.title)}<span>${esc(c.title || '(미리보기 준비 중)')}<br><small>${esc(c.account || '')} · ${cdRoomRow(cdRoomOf(c))[1]}</small></span></label>`).join('') || '<p class="lede">새 후보가 없습니다.</p>'}</div>
      <div class="row"><button class="btn sm" id="pk-go">다음</button><button class="chip" id="pk-x">닫기</button></div></div>`;
    document.body.appendChild(bg); const close = () => bg.remove(); bg.querySelector('#pk-x').onclick = close;

    bg.querySelector('#pk-go').onclick = () => { const ids = [...bg.querySelectorAll('input:checked')].map(i => i.value); if (!ids.length) return; close();
      kjMassModal(ids.map(id => { const c = cs.find(x => x.id === id); return { cand_id: id, label: c.title || c.account || '후보' }; })); };
  };
  clearTimeout(msTimer);
  if ((jobs || []).some(j => ['queued', 'writing'].includes(j.status))) msTimer = setTimeout(() => { if (opsTab === 'mass' && !$('#view-video').classList.contains('hide') && document.body.contains(body)) renderOpsMass(body); }, 6000);
}


/* ---------- v52 🧩 형식 — 릴스 형식 분류 (10-25 대표 요청) ----------
   kj_formats 표(Supabase) + storage 'formats' 버킷(예시 캡처). 처음 내용은 숏폼 대본 스킬 §3·0807 회의·260907 레퍼런스 분석·숏폼기준점 v1.0에서 정리. */
let FMT = [], fmtLoaded = false, fmtGrp = '', fmtQ = '', fmtBusy = false;
const FMT_BUCKET = () => String(window.SUPABASE_URL).replace(/\/+$/, '') + '/storage/v1/object/public/formats/';
const fmtYt = u => { const m = String(u || '').match(/(?:youtu\.be\/|[?&]v=|shorts\/)([\w-]{11})/); return m ? m[1] : null; };
async function loadFormats(){ const { data, error } = await sb.from('kj_formats').select('*').order('sort').order('created_at'); if (!error) { FMT = data || []; fmtLoaded = true; } return error; }
function fmtCard(f){
  const imgs = [...(f.images || []), ...(f.examples || []).filter(x => x.img).map(x => ({ url: x.img, cap: x.title, link: x.url }))].slice(0, 3);
  const flow = (f.flow || '').split(/\s*→\s*/).filter(Boolean);
  const kv = (k, v) => v ? `<div class="fmt-kv"><span class="fmt-k">${k}</span>${esc(v)}</div>` : '';
  return `<div class="fmt-card">
    ${imgs.length ? `<div class="fmt-imgs">${imgs.map(i => `<a href="${esc(i.link || i.url)}" target="_blank" rel="noopener" title="${esc(i.cap || '')}"><img loading="lazy" src="${esc(i.url)}" alt=""></a>`).join('')}</div>` : `<div class="fmt-noimg">${esc(f.name.slice(0, 1))}</div>`}
    <div class="fmt-b"><div class="fmt-h"><h5>${esc(f.name)}</h5><button class="chip sm" data-fmted="${f.id}">수정</button></div>
      ${f.summary ? `<div class="fmt-sum">${esc(f.summary)}</div>` : ''}
      ${flow.length ? `<div class="fmt-flow">${flow.map((x, i) => (i ? '<i>→</i>' : '') + `<span>${esc(x)}</span>`).join('')}</div>` : ''}
      ${kv('훅', f.hook)}${kv('언제', f.use_when)}${kv('주의', f.caution)}
      ${(f.examples || []).length ? `<div class="fmt-ex"><span class="fmt-k">예시</span>${f.examples.map(x => `<a href="${esc(x.url || '#')}" target="_blank" rel="noopener">${x.platform === 'youtube' ? '▶' : '◎'} ${esc(x.title || x.url)}${x.views ? ` <b>${fmtN(x.views)}</b>` : ''}</a>`).join('')}</div>` : ''}
      ${f.source ? `<div class="fmt-src">출처: ${esc(f.source)}</div>` : ''}
    </div></div>`;
}
async function renderFormats(){
  const v = document.getElementById('view-formats'); if (!v || v.classList.contains('hide')) return;
  const box = document.getElementById('fmt-list'), chips = document.getElementById('fmt-chips');
  if (!fmtLoaded) { if (fmtBusy) return; fmtBusy = true; box.innerHTML = '<p class="lede">불러오는 중…</p>'; const e = await loadFormats(); fmtBusy = false; if (e) { box.innerHTML = `<div class="msg">⚠ ${esc(e.message)}</div>`; return; } }
  const grps = [...new Set(FMT.map(f => f.grp))];
  chips.innerHTML = [['', '전체 ' + FMT.length], ...grps.map(g => [g, g + ' ' + FMT.filter(f => f.grp === g).length])].map(([g, l]) => `<button class="chip ${g === fmtGrp ? 'on' : ''}" data-fmtg="${esc(g)}">${esc(l)}</button>`).join('');
  chips.querySelectorAll('[data-fmtg]').forEach(b => b.onclick = () => { fmtGrp = b.dataset.fmtg; renderFormats(); });
  const q = fmtQ.trim().toLowerCase();
  const hit = f => !q || [f.name, f.summary, f.flow, f.hook, f.use_when, f.caution, ...(f.examples || []).map(x => x.title)].join(' ').toLowerCase().includes(q);
  box.innerHTML = grps.filter(g => !fmtGrp || g === fmtGrp).map(g => { const l = FMT.filter(f => f.grp === g && hit(f)); return l.length ? `<div class="fmt-grp"><h4>${esc(g)} <span>${l.length}</span></h4><div class="fmt-grid">${l.map(fmtCard).join('')}</div></div>` : ''; }).join('') || '<p class="lede">맞는 형식이 없습니다.</p>';
  box.querySelectorAll('[data-fmted]').forEach(b => b.onclick = () => fmtEdit(FMT.find(f => f.id === b.dataset.fmted)));
}
function fmtEdit(f){
  const isNew = !f; f = f || { grp: fmtGrp || '', name: '', examples: [], images: [] };
  let imgs = [...(f.images || [])];
  const grps = [...new Set(FMT.map(x => x.grp))];
  const exTxt = (f.examples || []).map(x => [x.url || '', x.title || '', x.views || ''].join(' | ')).join('\n');
  const bg = document.createElement('div'); bg.className = 'aiw-bg';
  bg.innerHTML = `<div class="aiw"><h3>🧩 ${isNew ? '형식 추가' : '형식 수정 — ' + esc(f.name)}</h3>
    <label>분류</label><input id="fe-grp" list="fe-grps" value="${esc(f.grp)}" placeholder="예: 성과 검증 포맷"><datalist id="fe-grps">${grps.map(g => `<option value="${esc(g)}">`).join('')}</datalist>
    <label>이름</label><input id="fe-name" value="${esc(f.name)}" placeholder="예: A vs B 판정형">
    <label>한 줄 설명</label><textarea id="fe-sum" rows="2">${esc(f.summary || '')}</textarea>
    <label>흐름 <span class="aiw-hint">단계를 → 로 이어 쓰기</span></label><input id="fe-flow" value="${esc(f.flow || '')}" placeholder="질문 → 답 → 이유 → 적용">
    <label>훅 예시</label><input id="fe-hook" value="${esc(f.hook || '')}">
    <label>언제 쓰나</label><input id="fe-use" value="${esc(f.use_when || '')}">
    <label>주의</label><input id="fe-cau" value="${esc(f.caution || '')}">
    <label>예시 영상 <span class="aiw-hint">한 줄에 하나: 링크 | 제목 | 조회수 (유튜브는 썸네일 자동)</span></label><textarea id="fe-ex" rows="4">${esc(exTxt)}</textarea>
    <label>캡처·그림 <span class="aiw-hint">릴스 화면 캡처나 구성 그림을 올리세요 (카드 위쪽에 보임)</span></label>
    <div class="fe-imgs" id="fe-imgs"></div><input type="file" id="fe-file" accept="image/*" multiple>
    <label>출처</label><input id="fe-src" value="${esc(f.source || '')}">
    <div class="row"><button class="btn sm" id="fe-save">저장</button><button class="chip" id="fe-x">닫기</button>${isNew ? '' : '<button class="chip" id="fe-del" style="margin-left:auto;color:var(--bad)">삭제</button>'}<span id="fe-st" class="u-sm2"></span></div></div>`;
  document.body.appendChild(bg);
  const $b = s => bg.querySelector(s), st = $b('#fe-st');
  const drawImgs = () => { $b('#fe-imgs').innerHTML = imgs.map((i, k) => `<span><img src="${esc(i.url)}"><button type="button" data-rm="${k}">✕</button></span>`).join(''); bg.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { imgs.splice(+b.dataset.rm, 1); drawImgs(); }); };
  drawImgs();
  const close = () => bg.remove(); $b('#fe-x').onclick = close; bg.onclick = e => { if (e.target === bg) close(); };
  $b('#fe-file').onchange = async e => {
    for (const file of e.target.files) {
      st.textContent = '올리는 중… ' + file.name;
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const path = 'up/' + crypto.randomUUID() + '.' + ext;
      const { error } = await sb.storage.from('formats').upload(path, file, { contentType: file.type || 'image/jpeg' });
      if (error) { st.textContent = ''; return uiAlert('사진 올리기 실패: ' + cleanErr(error.message)); }
      imgs.push({ url: FMT_BUCKET() + path, cap: file.name });
    }
    st.textContent = ''; e.target.value = ''; drawImgs();
  };
  $b('#fe-save').onclick = async () => {
    const name = $b('#fe-name').value.trim(), grp = $b('#fe-grp').value.trim();
    if (!name || !grp) return uiAlert('분류와 이름을 적어 주세요.');
    const old = new Map((f.examples || []).map(x => [x.url, x]));
    const examples = $b('#fe-ex').value.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const [url, title, views] = l.split('|').map(x => (x || '').trim()); const o = old.get(url) || {}; const yt = fmtYt(url);
      return { ...o, url, title: title || o.title || url, views: views ? +String(views).replace(/[^\d]/g, '') || null : (o.views || null), platform: yt ? 'youtube' : (/instagram\.com/.test(url) ? 'instagram' : (o.platform || 'web')), img: o.img || (yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : null) };
    });
    const row = { grp, name, summary: $b('#fe-sum').value.trim(), flow: $b('#fe-flow').value.trim(), hook: $b('#fe-hook').value.trim(), use_when: $b('#fe-use').value.trim(), caution: $b('#fe-cau').value.trim(), source: $b('#fe-src').value.trim(), examples, images: imgs, updated_at: new Date().toISOString() };
    if (isNew) row.sort = Math.max(0, ...FMT.filter(x => x.grp === grp).map(x => x.sort || 0)) + 1;
    const q = isNew ? sb.from('kj_formats').insert(row).select('id') : sb.from('kj_formats').update(row).eq('id', f.id).select('id');
    const { data, error } = await q;
    if (error) return uiAlert(cleanErr(error.message));
    if (!data || !data.length) return uiAlert('저장되지 않았습니다(권한 확인 필요).');
    close(); fmtLoaded = false; await renderFormats(); poToast(isNew ? '형식을 추가했습니다.' : '형식을 저장했습니다.');
  };
  const del = $b('#fe-del');
  if (del) del.onclick = async () => {
    if (!await uiConfirm(`'${f.name}' 형식을 지웁니다.`, { ok: '지우기', danger: true })) return;
    const { data, error } = await sb.from('kj_formats').delete().eq('id', f.id).select('id');
    if (error || !data || !data.length) return uiAlert('삭제는 관리자만 할 수 있습니다.');
    close(); fmtLoaded = false; await renderFormats(); poToast('형식을 지웠습니다.');
  };
}

  $('#fmt-add') && ($('#fmt-add').onclick = () => fmtEdit(null));
  $('#fmt-q') && ($('#fmt-q').oninput = e => { fmtQ = e.target.value; renderFormats(); });

