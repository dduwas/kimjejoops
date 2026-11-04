'use strict';
// 김제조 웍스 — 생산 라인 렌더·밀기 소재·성과 요약  (v88에서 index.html 에서 분리)
/* ---------------- 렌더 ---------------- */
/* ---------------- v71 🎯 밀기 소재 (kj_push_topics) ----------------
   밀고 싶은 소재를 적어 두면 ① 분석 대상·콘텐츠 후보에 🎯 배지·필터 ② 쓰레드·캐러셀 초안 프롬프트(ops-threads pushBlock)에 세기만큼 반영된다. */
let PUSH = [], pushLoaded = false;
const PUSH_W = { 1: '가볍게', 2: '보통', 3: '세게' };
async function loadPush(force){
  if (pushLoaded && !force) return;
  const { data } = await sb.from('kj_push_topics').select('*').order('active', { ascending: false }).order('created_at', { ascending: false });
  PUSH = data || []; pushLoaded = true;
}
const pushLive = () => { const t = new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10); return PUSH.filter(p => p.active && (!p.until || String(p.until) >= t)); };
const pushWords = p => [p.name].concat(p.keywords || []).map(w => String(w || '').trim().toLowerCase()).filter(w => w.length > 1);
function pushHit(...texts){
  const s = texts.filter(Boolean).join(' ').toLowerCase();
  if (!s) return null;
  for (const p of pushLive()) if (pushWords(p).some(w => s.includes(w))) return p;
  return null;
}
const pushBadge = p => p ? `<span class="pt-badge" title="밀기 소재: ${esc(p.name)}${p.angle ? ' — ' + esc(p.angle) : ''}">🎯 ${esc(p.name)}</span>` : '';
async function renderPush(){
  const v = document.getElementById('view-push'); if (!v || v.classList.contains('hide')) return;
  await loadPush(true);
  const box = document.getElementById('pt-list');
  box.innerHTML = PUSH.length ? PUSH.map(p => `<div class="cm-card ${p.active ? '' : 'off'}" data-ptid="${p.id}">
      <div class="row" style="gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px">
        <input data-ptname value="${esc(p.name)}" style="font-weight:800;font-size:15px;max-width:200px">
        <label class="rv-sub">세기 <select data-ptw>${[3, 2, 1].map(w => `<option value="${w}" ${(+p.weight || 2) === w ? 'selected' : ''}>${PUSH_W[w]}</option>`).join('')}</select></label>
        <label class="rv-sub">언제까지 <input type="date" data-ptu value="${p.until || ''}"></label>
        <label class="rv-sub"><input type="checkbox" data-pta ${p.active ? 'checked' : ''}> 켜짐</label>
        <div class="sep"></div><button class="chip sm cd-del" data-ptdel>삭제</button>
      </div>
      <label class="rv-sub">같이 볼 말 — 쉼표로 (제목·캡션에 이 말이 있으면 🎯로 잡습니다)</label>
      <input data-ptk value="${esc((p.keywords || []).join(', '))}" placeholder="예: 크레아틴, creatine, 근손실, 근력">
      <label class="rv-sub">김제조 각도 — 왜 미는지·어떻게 풀지 한 줄 (AI가 이 각도로 씁니다)</label>
      <input data-ptg value="${esc(p.angle || '')}" placeholder="예: 운동하는 사람만 먹는 걸로 아는데, 나이 들수록 더 챙길 이유가 있다는 쪽으로">
    </div>`).join('') : '<p class="lede">아직 등록한 소재가 없습니다. <b>＋ 소재 추가</b>로 시작하세요.</p>';
  box.querySelectorAll('[data-ptid]').forEach(card => {
    const id = card.dataset.ptid;
    const save = async patch => { const { error } = await sb.from('kj_push_topics').update(patch).eq('id', id); if (error) uiAlert(cleanErr(error.message)); else { Object.assign(PUSH.find(x => x.id === id) || {}, patch); poToast('저장했습니다.', 1200); } };
    card.querySelector('[data-ptname]').onchange = e => { const n = e.target.value.trim(); if (n) save({ name: n }); };
    card.querySelector('[data-ptw]').onchange = e => save({ weight: +e.target.value });
    card.querySelector('[data-ptu]').onchange = e => save({ until: e.target.value || null });
    card.querySelector('[data-pta]').onchange = e => { save({ active: e.target.checked }); card.classList.toggle('off', !e.target.checked); };
    card.querySelector('[data-ptk]').onchange = e => save({ keywords: e.target.value.split(/[,·]/).map(x => x.trim()).filter(Boolean) });
    card.querySelector('[data-ptg]').onchange = e => save({ angle: e.target.value.trim() || null });
    card.querySelector('[data-ptdel]').onclick = async () => {
      if (!await uiConfirm('"' + (PUSH.find(x => x.id === id) || {}).name + '" 을(를) 밀기 소재에서 지웁니다.\n잠시 쉬게 하려면 「켜짐」 체크만 끄면 됩니다.', { ok: '지우기', danger: true })) return;
      const { error } = await sb.from('kj_push_topics').delete().eq('id', id);
      if (error) return uiAlert(cleanErr(error.message));
      await loadPush(true); renderPush();
    };
  });
  const add = document.getElementById('pt-add');
  add.onclick = async () => {
    const n = await uiPrompt('밀고 싶은 소재 이름 (예: K뷰티, 크레아틴)', '');
    if (!n || !n.trim()) return;
    const { error } = await sb.from('kj_push_topics').insert({ name: n.trim(), created_by: me.id });
    if (error) return uiAlert(/duplicate|unique/i.test(error.message) ? '이미 있는 소재입니다.' : cleanErr(error.message));
    await loadPush(true); renderPush();
  };
}

function render(){ renderCands(); renderFormats(); renderPush(); renderReview(); renderVideo(); buildChannelChips(); buildOwnerChips(); buildScheduleChips(); renderBoard(); renderSchedule(); renderInsight(); renderPosts(); renderTodos(); renderMeetings(); renderDrops(); renderTeam(); renderSettings(); try { navBadges(); } catch (e) {} }   // v102 묶음 배지도 같이

/* ---------------- 공용 숫자 도우미 ---------------- */
const num  = v => (v === null || v === undefined || v === '') ? null : Number(v);
const fmtN = v => num(v) === null ? '—' : Number(v).toLocaleString();

const moatOf = label => moats.find(m => m.label === label);
const nameOf = id => team.find(t => t.id === id)?.name || team.find(t => t.id === id)?.email || '알 수 없음';
function ownerNames(ids){
  const list = (ids || []).map(nameOf);
  if (!list.length) return '담당 미정';
  return list.length <= 2 ? list.join(', ') : `${list[0]} 외 ${list.length-1}명`;
}

// v33: 웰(웰니스박스 촬영, 김호준 담당) / 솔(김주성·채진병·강민형 담당) / 기타 — contents.team_tag, 비어 있으면 담당자로 추정
const TEAM_TAGS = ['웰', '솔', '기타', '외'];   // v70: 외 = 외국어(글로벌 계정용) 라인
function teamTag(c){
  if ((c.channels || []).some(ch => /롱폼|퀵릴스|카루셀|캐러셀/.test(ch))) return '기타'; // v83: 롱폼·퀵릴스·캐러셀 카드는 모두 '롱폼/퀵릴스/캐러셀' 라인
  if (c.team_tag) return c.team_tag;
  const names = (c.owner_ids || []).map(nameOf).join(' ');
  if (/김호준|유현일/.test(names) || /\[웰/.test(c.title || '')) return '웰';
  if (/김주성|채진병|강민형/.test(names)) return '솔';
  return '기타';
}
// v34: 화면 이름은 '담당팀' — 웰니스박스(웰) / 솔루션즈(솔) / 기타. 담당자를 고르면 자동으로 정해지고, 직접 바꿀 수 있다
const TEAM_LABEL = { '웰': '웰니스박스', '솔': '솔루션즈', '기타': '롱폼/퀵릴스/캐러셀', '외': '외국어' };
const teamCls = t => t === '웰' ? 'w' : t === '솔' ? 's' : t === '외' ? 'g' : 'e';
const teamByOwners = ids => { const n = (ids || []).map(nameOf).join(' '); return /김호준|유현일/.test(n) ? '웰' : /김주성|채진병|강민형/.test(n) ? '솔' : null; };
const tagHTML = c => { const t = teamTag(c); return `<span class="ttag ttag-${teamCls(t)}" title="담당팀: ${TEAM_LABEL[t] || t}">${t}</span>`; };

/* v92 한 번 클릭 드랍 — 확인창 없이 바로 드랍하고, 토스트의 「되돌리기」로 즉시 되돌린다.
   영구 삭제가 아니라 드랍 게시판으로 보내는 것이므로 되돌릴 수 있다. */
function poUndo(t, fn){
  const old = document.querySelector('.po-toast'); if (old) old.remove();
  const el = document.createElement('div'); el.className = 'po-toast';
  el.innerHTML = `<span>${esc(t)}</span><button class="po-undo">되돌리기</button>`;
  document.body.appendChild(el);
  const kill = setTimeout(() => el.remove(), 9000);
  el.querySelector('.po-undo').onclick = async () => { clearTimeout(kill); el.remove(); await fn(); };
}
async function dropNow(id){
  const c = cards.find(x => x.id === id); if (!c || c.stage === DROP) return;
  const was = c.stage, name = c.title || '카드';
  const { error } = await sb.from('contents').update({ stage: DROP, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return uiAlert(cleanErr(error.message));
  await refresh();
  poUndo('드랍: ' + name.slice(0, 28) + ' · 드랍 게시판에 보관됩니다', async () => {
    const { error: e2 } = await sb.from('contents').update({ stage: was, updated_at: new Date().toISOString() }).eq('id', id);
    if (e2) return uiAlert(cleanErr(e2.message));
    await refresh(); poToast('되돌렸습니다.', 2000);
  });
}

function cardHTML(c){
  const badges = [];
  (c.channels || []).slice(0,3).forEach(ch => badges.push(`<span class="badge">${esc(ch)}</span>`));
  styleList(c).forEach(s => badges.push(`<span class="badge b-style">${esc(s)}</span>`));   // v97 스타일
  if (c.cta_keyword) badges.push(`<span class="badge b-cta">CTA ${esc(c.cta_keyword)}</span>`);
  if (c.cta_post_id) { const lp = posts.find(p => p.id === c.cta_post_id); if (lp) badges.push(`<span class="badge b-lead" title="CTA로 보내는 글 열람 수">🔗 ${lp.view_count || 0}</span>`); }

  const doneBtn = c.stage === REVIEW ? `<div class="cardbtns">
      <button class="cardbtn" data-pub="${c.id}">게시 승인</button>
      <button class="cardbtn alt" data-done="${c.id}">게시 완료</button>
    </div>` : '';

  /* v94 카드 정리 — 삭제는 오른쪽 위 아이콘으로 빼고, 담당·날짜·링크를 한 줄로 합쳤다 */
  return `<div class="card" draggable="true" data-id="${c.id}">
    <button class="cddel" data-cddrop="${c.id}" aria-label="이 카드 드랍" title="한 번 눌러 바로 드랍합니다. 토스트의 「되돌리기」나 드랍 게시판에서 되돌릴 수 있습니다">🗑</button>
    <h4>${tagHTML(c)}${esc(c.title)}</h4>
    <div class="badges">${badges.join('')}</div>
    ${c.next_action ? `<div class="next">${esc(c.next_action)}</div>` : ''}
    <div class="cardfoot"><span>${esc(ownerNames(c.owner_ids))}</span>
      ${c.publish_date ? `<span>게시 ${c.publish_date.slice(5)}</span>` : ''}
      <span class="sp"></span>
    ${(c.publish_url || c.reference_url) ? `<span class="cardlinks">
      ${c.publish_url ? `<a href="${esc(c.publish_url)}" target="_blank" rel="noopener" data-nolink="1" data-production-ref data-ref-title="${esc(c.title || '게시물')}" title="여기서 바로 재생 (Ctrl+클릭하면 새 탭)">▶ 게시물</a>` : ''}
      ${c.reference_url ? `<a href="${esc(c.reference_url)}" target="_blank" rel="noopener" data-nolink="1" data-production-ref data-ref-title="${esc(c.title || '레퍼런스 영상')}" title="여기서 바로 재생 (Ctrl+클릭하면 새 탭)">▶ 레퍼런스</a>` : ''}
    </span>` : ''}</div>
    ${doneBtn}
    <div class="cardmv"><button class="mvtoggle" data-mvt="${c.id}" title="단계와 생산 라인을 버튼으로 옮깁니다">⇄ 단계·라인</button></div></div>`;
}

// 단계가 어느 칼럼에 속하는지
function colNameOf(stage){
  const col = BOARD_COLS.find(c => c.stages.includes(stage));
  return col ? col.name : stage;
}

function buildStageChips(){
  const pool = cards.filter(c => c.stage !== PLANNED && c.stage !== DONE && c.stage !== DROP);
  const items = BOARD_COLS.map(col => ({
    key: col.name,
    label: `${col.name} ${pool.filter(c => col.stages.includes(c.stage)).length}`
  }));
  buildChips('#stage-chips', '#stage-clear', items, stageFilter, renderBoard);
}

function renderBoard(){
  const list = visible();
  const inLine = cards.filter(c => teamTag(c) === lineOf());
  const live = inLine.filter(c => c.stage !== PLANNED && c.stage !== DONE && c.stage !== DROP).length;
  const bits = [`${TEAM_LABEL[curLine]} 라인 제작 중 ${live}개`];
  if (onlyMine || channelFilter.size || ownerFilter.size || stageFilter.size)
    bits.push(`보이는 카드 ${list.length}개`);
  bits.push(`게시 예정 ${inLine.filter(c => c.stage === PLANNED).length}개`);
  bits.push(`게시 완료 ${inLine.filter(c => c.stage === DONE).length}개`);
  const dropped = inLine.filter(c => c.stage === DROP).length;
  if (dropped) bits.push(`드랍 ${dropped}개`);
  $('#board-count').textContent = bits.join(' · ');

  // 보기 전환 — 게시판일 때만 단계 필터를 보여준다
  $('#line').classList.toggle('hide', bdView !== 'kanban');
  $('#board-table').classList.toggle('hide', bdView !== 'table');
  $('#stage-bar').classList.toggle('hide', bdView !== 'table');
  buildStageChips();

  if (bdView === 'table') return renderBoardTable(list);

  $('#line').innerHTML = BOARD_COLS.map((col, i) => {
    const items = list.filter(c => col.stages.includes(c.stage));
    return `<div class="col ${col.wide ? 'wide' : ''}" data-drop="${esc(col.drop)}" data-stages="${esc(col.stages.join('|'))}">
      <div class="colhead">
        <span class="colnum">${String(i+1).padStart(2,'0')}</span>
        <span class="colname">${esc(col.name)}</span>
        <span class="colcount">${items.length}</span>
        ${scPick && items.length ? `<button class="colpick ${items.every(c => scPick.has(c.id)) ? 'on' : ''}" data-colpick="${i}" title="이 칸 카드를 모두 고르기/빼기">☑ 칸 전체</button>` : ''}
      </div>
      <div class="colbody">${items.map(cardHTML).join('') || '<div style="font-size:12px;color:var(--muted);padding:8px 3px">비어 있음</div>'}</div>
    </div>`;
  }).join('');

  $$('#line [data-nolink]').forEach(a => a.onclick = e => e.stopPropagation());
  $$('#line .card').forEach(el => {
    el.onclick = e => {
      if (e.target.closest('[data-nolink]')) return;
      if (scPick) { scPick.has(el.dataset.id) ? scPick.delete(el.dataset.id) : scPick.add(el.dataset.id); el.classList.toggle('sel'); scBarCount(); return; }   // v40 대본 고르기
      openCard(cards.find(c => c.id === el.dataset.id));
    };
    if (scPick && scPick.has(el.dataset.id)) el.classList.add('sel');
    el.ondragstart = e => e.dataTransfer.setData('text/plain', el.dataset.id);
  });
  $$('#line [data-colpick]').forEach(b => {   // v41 고르기 화면: 칸(탭)별 전체 선택
    b.onclick = () => { const col = BOARD_COLS[+b.dataset.colpick]; const ids = list.filter(c => col.stages.includes(c.stage)).map(c => c.id);
      const all = ids.every(id => scPick.has(id)); ids.forEach(id => all ? scPick.delete(id) : scPick.add(id)); renderBoard(); scBarCount(); };
  });

  // v84 카드의 「⇄ 단계·라인」 — 누르면 그 카드 밑에 버튼이 펼쳐진다 (카드가 많아 미리 그리지 않고 누를 때 만든다)
  $$('#line [data-mvt]').forEach(b => b.onclick = e => {
    e.stopPropagation();
    const el = b.closest('.card'); const c = cards.find(x => x.id === b.dataset.mvt); if (!el || !c) return;
    const had = el.querySelector('.mvpanel');
    $$('#line .mvpanel').forEach(p => p.remove());
    $$('#line .mvtoggle').forEach(x => x.classList.remove('on'));
    if (had) return;
    b.classList.add('on');
    const p = document.createElement('div'); p.className = 'mvpanel';
    p.innerHTML = `<div class="mvh">단계</div><div class="mvrow">${[...STAGES, DROP].map(s => `<button data-mvs="${esc(s)}" class="${c.stage === s ? 'on' : ''}${s === DROP ? ' warn' : ''}">${esc(stageKo(s))}</button>`).join('')}</div>`
      + `<div class="mvh">생산 라인</div><div class="mvrow">${TEAM_TAGS.map(t => `<button data-mvl="${esc(t)}" class="${teamTag(c) === t ? 'on' : ''}">${esc(TEAM_LABEL[t] || t)}</button>`).join('')}</div>`;
    el.querySelector('.cardmv').appendChild(p);
    p.onclick = ev => ev.stopPropagation();
    p.querySelectorAll('[data-mvs]').forEach(x => x.onclick = async ev => {
      ev.stopPropagation(); const s = x.dataset.mvs;
      if (s === c.stage) return;
      if (s === DROP) return dropNow(c.id);
      await moveStage(c.id, s);
    });
    p.querySelectorAll('[data-mvl]').forEach(x => x.onclick = async ev => {
      ev.stopPropagation(); if (teamTag(c) === x.dataset.mvl) return;
      await moveLine(c.id, x.dataset.mvl);
    });
  });

  $$('#line [data-cddrop]').forEach(b => b.onclick = async e => {
    e.stopPropagation();
    await dropNow(b.dataset.cddrop);
  });

  $$('#line [data-pub]').forEach(b => b.onclick = async e => {
    e.stopPropagation();
    await moveStage(b.dataset.pub, PLANNED);
  });
  $$('#line [data-done]').forEach(b => b.onclick = async e => {
    e.stopPropagation();
    await moveStage(b.dataset.done, DONE);
  });

  $$('#line .col').forEach(col => {
    col.ondragover = e => { e.preventDefault(); col.classList.add('drop'); };
    col.ondragleave = () => col.classList.remove('drop');
    col.ondrop = async e => {
      e.preventDefault(); col.classList.remove('drop');
      const id = e.dataTransfer.getData('text/plain');
      const card = cards.find(x => x.id === id);
      if (!card) return;
      // 같은 칼럼 안에서 옮긴 경우 단계를 건드리지 않는다
      if ((col.dataset.stages || '').split('|').includes(card.stage)) return;
      await moveStage(id, col.dataset.drop);
    };
  });
}

/* ---------- 성과 요약 + 정리 필요 카드 (v29) ---------- */
function renderInsight(){
  const box = $('#kj-ins'); if (!box) return;
  const now = Date.now(), DAY = 864e5;
  const open = (k) => { try { return localStorage.getItem('kjins:' + k) !== '0'; } catch (_) { return true; } };
  // 성과: 최근 30일 게시완료 + 조회수 있음
  const recent = cards.filter(c => teamTag(c) === lineOf() && c.stage === DONE && c.views && c.publish_date && now - new Date(c.publish_date) <= 30 * DAY);
  const src = c => /instagram/.test(c.publish_url || '') ? '인스타' : (/youtu/.test(c.publish_url || '') ? '유튜브' : '');
  const rate = c => c.views ? ((c.saves || 0) / c.views * 100) : 0;
  const top = [...recent].sort((a, b) => b.views - a.views).slice(0, 3);
  const low = [...recent].sort((a, b) => a.views - b.views).slice(0, 3);
  const avgV = recent.length ? Math.round(recent.reduce((s, c) => s + c.views, 0) / recent.length) : 0;
  const row = (c, rep) => `<tr><td class="ttl" data-insopen="${c.id}" title="${esc(c.title)}">${esc(c.title)}</td><td>${src(c)}</td>
    <td class="num">${fmtN(c.views)}</td><td class="num">${c.saves != null ? fmtN(c.saves) : '—'}</td><td class="num">${c.saves != null ? rate(c).toFixed(1) + '%' : '—'}</td>
    <td>${rep ? `<button class="mini-b" data-insrep="${c.id}" title="같은 틀로 다음 편 아이디어 카드 만들기">같은 틀로 +</button>` : ''}</td></tr>`;
  const perf = `<details data-ins="perf" ${open('perf') ? 'open' : ''}><summary>📊 ${TEAM_LABEL[curLine]} 라인 최근 30일 성과 — ${recent.length}개 · 평균 조회 ${fmtN(avgV)}</summary>
    ${recent.length ? `<table><tr><th>콘텐츠</th><th>채널</th><th class="num">조회</th><th class="num">저장</th><th class="num">저장률</th><th></th></tr>
    <tr><th>잘 된 콘텐츠</th><th></th><th></th><th></th><th></th><th></th></tr>${top.map(c => row(c, true)).join('')}
    <tr><th>아쉬운 콘텐츠</th><th></th><th></th><th></th><th></th><th></th></tr>${low.map(c => row(c, false)).join('')}</table>
    <p class="note" style="margin-top:6px">매일 아침 6:30 인스타·유튜브 게시물을 카드와 자동으로 짝지어 링크·조회·저장·공유를 채웁니다.</p>`
    : '<p class="note">최근 30일 성과가 아직 없습니다. 매일 아침 자동으로 채워집니다.</p>'}</details>`;
  // 정리 필요: 14일 넘게 안 움직인 제작 중·게시예정 카드
  const stale = cards.filter(c => teamTag(c) === lineOf() && c.stage !== DONE && c.stage !== DROP && c.updated_at && now - new Date(c.updated_at) > 14 * DAY)
    .sort((a, b) => (a.updated_at || '').localeCompare(b.updated_at || ''));
  const groups = {};
  stale.forEach(c => { const k = (c.owner_ids || []).length ? ownerNames([c.owner_ids[0]]) : '담당 미정'; (groups[k] = groups[k] || []).push(c); });
  const srow = c => `<tr data-insrow="${c.id}" title="우클릭: 게시완료·단계 이동·삭제"><td class="ttl" data-insopen="${c.id}" title="${esc(c.title)}">${esc(c.title)}</td><td>${esc(c.stage)}</td>
    <td class="num">${Math.floor((now - new Date(c.updated_at)) / DAY)}일</td>
    <td class="u-nowrap"><button class="mini-b" data-inskeep="${c.id}" title="계속 진행 — 오늘 날짜로 갱신">계속</button><input type="date" class="mini-b" data-insdate="${c.id}" title="게시예정일 지정" style="padding:1px 3px"><button class="mini-b" data-insdrop="${c.id}">드랍</button></td></tr>`;
  const clean = `<details data-ins="stale" ${open('stale') ? 'open' : ''}><summary>🧹 ${TEAM_LABEL[curLine]} 라인 정리 필요 — 14일 넘게 안 움직인 카드 ${stale.length}개</summary>
    ${stale.length ? Object.entries(groups).sort((a, b) => b[1].length - a[1].length).map(([k, list]) => `<div class="owner">${esc(k)} · ${list.length}개</div>
      <table>${list.slice(0, 15).map(srow).join('')}</table>${list.length > 15 ? `<p class="note">… 외 ${list.length - 15}개</p>` : ''}`).join('')
    : '<p class="note">모두 잘 움직이고 있습니다.</p>'}</details>`;
  box.innerHTML = perf + clean;

  $$('#kj-ins details[data-ins]').forEach(d => d.ontoggle = () => { try { localStorage.setItem('kjins:' + d.dataset.ins, d.open ? '1' : '0'); } catch (_) {} });
  $$('#kj-ins [data-insopen]').forEach(el => el.onclick = () => openCard(cards.find(c => c.id === el.dataset.insopen)));
  const touch = async (id, extra) => {
    const { error } = await sb.from('contents').update({ ...(extra || {}), updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return uiAlert(cleanErr(error.message));
    await refresh();
  };
  $$('#kj-ins [data-inskeep]').forEach(b => b.onclick = () => touch(b.dataset.inskeep));
  $$('#kj-ins [data-insdate]').forEach(i => i.onchange = () => i.value && touch(i.dataset.insdate, { publish_date: i.value }));
  $$('#kj-ins [data-insdrop]').forEach(b => b.onclick = () => {
    dropNow(b.dataset.insdrop);
  });
  $$('#kj-ins [data-insrep]').forEach(b => b.onclick = async () => {
    const c = cards.find(x => x.id === b.dataset.insrep); if (!c) return;
    const { error } = await sb.from('contents').insert({ title: '[같은 틀] ' + c.title, stage: IDEA, channels: c.channels || [], moat: c.moat || null,
      reference_url: c.publish_url || null, next_action: `잘 된 형식(조회 ${fmtN(c.views)}) 그대로 다음 주제 정하기`, created_by: me.id, team_tag: teamTag(c) });
    if (error) return uiAlert(cleanErr(error.message));
    await refresh(); uiAlert('아이디어 칸에 "같은 틀" 카드를 만들었습니다.');
  });
}

// 생산 라인 — 게시판 보기
function renderBoardTable(list){
  const stageIdx = st => BOARD_COLS.findIndex(c => c.stages.includes(st));
  const rows = [...list].sort((a,b) =>
    (stageIdx(a.stage) - stageIdx(b.stage)) ||
    (a.publish_date || '9999').localeCompare(b.publish_date || '9999') ||
    (b.updated_at || '').localeCompare(a.updated_at || ''));

  if (!rows.length) {
    $('#board-table').innerHTML = '<div class="empty">해당하는 콘텐츠가 없습니다.</div>';
    return;
  }

  // 단계별로 소제목을 넣어 구분한다
  let html = '', lastCol = null;
  rows.forEach(c => {
    const colName = colNameOf(c.stage);
    if (colName !== lastCol) {
      if (lastCol !== null) html += '</table>';
      const n = rows.filter(x => colNameOf(x.stage) === colName).length;
      html += `<div class="sect" style="margin-top:${lastCol===null?0:28}px">${esc(colName)} <span style="color:var(--muted);font-weight:600">${n}개</span></div>
        <table>
        <tr><th>콘텐츠</th><th>단계</th><th>채널</th><th>담당</th><th>다음 액션</th><th>게시예정</th><th></th></tr>`;
      lastCol = colName;
    }
    html += `<tr>
      <td data-open="${c.id}" style="cursor:pointer">${tagHTML(c)}<b>${esc(c.title)}</b>
        ${c.key_message ? `<br><span class="u-sm">${esc(c.key_message)}</span>` : ''}</td>
      <td style="font-size:12.5px;white-space:nowrap">${esc(c.stage)}</td>
      <td class="u-sm">${esc((c.channels || []).join(', ') || '—')}</td>
      <td style="font-size:12.5px">${esc(ownerNames(c.owner_ids))}</td>
      <td style="font-size:12.5px;color:var(--muted);max-width:200px">${esc(c.next_action || '—')}</td>
      <td style="font-variant-numeric:tabular-nums;white-space:nowrap;font-size:12.5px">${c.publish_date || '—'}</td>
      <td class="u-nowrap">
        ${c.publish_url ? `<a href="${esc(c.publish_url)}" target="_blank" rel="noopener" style="font-size:12px">게시</a> ` : ''}
        ${c.reference_url ? `<a href="${esc(c.reference_url)}" target="_blank" rel="noopener" style="font-size:12px" data-production-ref data-ref-title="${esc(c.title || '레퍼런스 영상')}">참고</a> ` : ''}
        ${c.stage === REVIEW ? `<button class="btn sm" data-tpub="${c.id}">게시 승인</button>` : ''}
      </td></tr>`;
  });
  html += '</table><p class="note">제목을 누르면 카드가 열립니다. 단계를 옮기려면 칸반 보기에서 끌거나, 카드를 열어 단계를 바꾸세요.</p>';

  $('#board-table').innerHTML = html;
  $$('#board-table [data-open]').forEach(el =>
    el.onclick = () => openCard(cards.find(c => c.id === el.dataset.open)));
  $$('#board-table [data-tpub]').forEach(b => b.onclick = () => moveStage(b.dataset.tpub, PLANNED));
}

async function moveStage(id, stage){
  const card = cards.find(c => c.id === id);
  if (!card || card.stage === stage) return;
  const { error } = await sb.from('contents').update({ stage }).eq('id', id);
  if (error) return uiAlert(cleanErr(error.message));
  await refresh();
}

