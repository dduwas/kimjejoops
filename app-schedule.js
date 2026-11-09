'use strict';
// 김제조 웍스 — 게시 일정·공용 서랍  (v88에서 index.html 에서 분리) · v107 외국어 라인·번역·계정별 업로드 현황
/* ---------------- 게시 일정 (캘린더 + 게시판) ---------------- */
let scView = 'calendar', scCat = 'all';
let calBase = new Date();

// 일정 종류 — 촬영은 촬영일, 나머지는 게시예정일 기준으로 달력에 찍는다
const SC_KINDS = {
  shoot:   { label: '촬영',      dateKey: 'shoot_date',   cls: 'k-shoot' },
  edit:    { label: '편집',      dateKey: 'publish_date', cls: 'k-edit'  },
  planned: { label: '게시 예정', dateKey: 'publish_date', cls: 'k-plan'  },
  done:    { label: '게시 완료', dateKey: 'publish_date', cls: 'k-done'  }
};

// 카드 하나가 여러 일정을 만들 수 있다 (촬영일과 게시일이 각각 찍힌다)
/* ---------- v59 자동 게시 일정 (10-26 대표 요청) ----------
   카드에 게시일이 없던 실제 게시물(인스타·유튜브·쓰레드·더우인·샤오홍슈)과 예약 업로드(쓰레드 예약·유튜브 예약)를
   n8n 48(매일 07:25)이 sched-fill 함수로 kj_sched_auto 에 채움 → 캘린더에 '🤖 자동'으로 표시(누르면 게시물 열림).
   카드를 만들어 게시 링크를 넣으면 다음날 자동 일정은 사라짐. 솔루션즈·전체 라인에서만, 담당자 필터 중엔 숨김. */
let schedAuto = [], schedAutoAt = 0, schedStatus = null;
/* v107 (11-10 대표 요청) 더우인·샤오홍슈·글로벌 인스타(@jejo.kpharmacist)는 외국어 라인, 나머지는 솔루션즈 라인.
   중국어 제목은 sched-fill 이 '원문 ｜ 번역' 으로 저장 → 달력에 '원문 (번역)'. 계정별 업로드 현황은 _status 행(sched-fill 이 2시간마다 갱신). */
const autoLine = a => (a.platform === 'douyin' || a.platform === 'xiaohongshu' || /jejo\.kpharmacist|global/i.test(a.account || '')) ? '외' : '솔';
const autoTitle = t => { const p = String(t || '').split(' ｜ '); return p[1] ? p[0] + ' (' + p[1] + ')' : p[0]; };
const SA_CH = { instagram:'인스타', youtube:'유튜브', threads:'쓰레드', douyin:'더우인', xiaohongshu:'샤오홍슈' };
async function loadSchedAuto(){
  schedAutoAt = Date.now();
  const { data } = await sb.from('kj_sched_auto').select('*').order('date');
  const st = (data || []).find(x => x.ext_id === '_status');
  try { schedStatus = st ? JSON.parse(st.title) : null; } catch (_) { schedStatus = null; }
  schedAuto = (data || []).filter(x => x.ext_id !== '_status');
}
function autoEvHTML(e){
  const a = e.auto, k = e.kind === 'planned' ? 'k-plan' : 'k-done';
  // v99 한 플랫폼에 계정이 둘 이상이면(인스타 김제조/글로벌) 달력에도 계정을 같이 보여 준다
  const multi = (schedAuto || []).some(x => x.platform === a.platform && (x.account || '') !== (a.account || ''));
  const lab = (SA_CH[a.platform] || a.platform) + (multi && a.account ? ' ' + String(a.account).replace(/^@/, '') : '') + (e.kind === 'planned' ? ' 예약' : '');
  const tip = `🤖 자동 · ${lab}${a.account ? ' · ' + a.account : ''} · ${autoTitle(a.title)}${a.exact === false ? ' (게시일 = 처음 확인된 날)' : ''}`;
  return `<a class="ev ev-auto" ${a.url ? `href="${esc(a.url)}" target="_blank" rel="noopener"` : ''} title="${esc(tip)}"><span class="dotmark ${k}"></span>🤖${esc(lab)} ${esc(autoTitle(a.title) || '(제목 없음)')}</a>`;
}
function scheduleEvents(){
  const out = [];
  const accOn = scAccFilter.size > 0;   // v99 계정으로 보는 중에는 계정 구분이 없는 수동 카드는 빼고 그 계정 글만 본다
  cards.forEach(c => {
    if (accOn) return;
    if (!scLineOk(c)) return;   // v39: 전체 또는 고른 라인
    if (!matchOwner(c, scOwnerFilter)) return;
    if (!matchChannel(c, scChannelFilter)) return;

    const push = kind => {
      const d = c[SC_KINDS[kind].dateKey] || null;
      out.push({ card: c, kind, date: d });
    };

    if (c.stage === '촬영') push('shoot');
    else if (c.stage === '편집') push('edit');
    else if (c.stage === PLANNED) {
      push('planned');
      // 게시 예정이어도 촬영일이 따로 있으면 촬영 일정도 남긴다
      if (c.shoot_date && c.shoot_date !== c.publish_date)
        out.push({ card: c, kind: 'shoot', date: c.shoot_date });
    }
    else if (c.stage === DONE) push('done');
  });

  if (accOn || !scOwnerFilter.size) schedAuto.forEach(a => {
    if (accOn && !scAccFilter.has((a.platform || '') + '|' + (a.account || ''))) return;
    if (!accOn && scLine !== 'all' && scLine !== autoLine(a)) return;   // v107 외국어 채널은 외국어 라인에서
    if (!accOn && scChannelFilter.size && ![...scChannelFilter].some(ch => String(ch).includes(SA_CH[a.platform] || a.platform))) return;
    out.push({ card: null, auto: a, kind: a.kind === 'planned' ? 'planned' : 'done', date: a.date });
  });
  return out.filter(e => scCat === 'all' || e.kind === scCat);
}

function renderSchedule(){
  if (document.getElementById('view-schedule').classList.contains('hide')) return;   // v106 안 보이는 화면은 그리지 않는다
  if (!schedAutoAt) { loadSchedAuto().then(() => { buildScheduleChips(); renderSchedule(); }).catch(() => {}); }
  const evs = scheduleEvents();
  const n = k => evs.filter(e => e.kind === k).length;
  const filtered = scOwnerFilter.size || scChannelFilter.size || scAccFilter.size;
  paintFilterCounts();   // v106 접힌 필터 버튼에 개수 표시

  const parts = [];
  ['shoot','edit','planned','done'].forEach(k => {
    if (n(k)) parts.push(`${SC_KINDS[k].label} ${n(k)}개`);
  });
  $('#schedule-count').textContent =
    (parts.join(' · ') || '표시할 일정 없음') + (filtered ? ' (필터 적용 중)' : '');

  $('#cal-controls').classList.toggle('hide', scView !== 'calendar');
  scView === 'calendar' ? renderCalendar(evs) : renderScheduleTable(evs);
  renderUploadStatus();
  wireScheduleButtons();
}

/* v107 계정별 업로드 현황 — 모든 계정의 실제 게시(카드와 짝지어진 것 포함)를 한 표로. sched-fill 이 갱신 */
function renderUploadStatus(){
  let box = document.getElementById('sched-status');
  if (!box) { box = document.createElement('div'); box.id = 'sched-status'; const body = $('#schedule-body'); body.parentNode.insertBefore(box, body); }
  const S = schedStatus;
  if (!S || !Array.isArray(S.accounts)) { box.innerHTML = ''; return; }
  let open = true; try { open = localStorage.getItem('kj_upst') !== '0'; } catch (_) {}
  const all = S.accounts.filter(a => !String(a.platform).startsWith('_'));
  const rows = all.filter(a => (a.total || a.planned) || !all.some(b => b !== a && b.platform === a.platform && (b.total || b.planned)))
    .filter(a => scLine === 'all' || a.line === scLine);
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10), mon = today.slice(0, 7);
  const ago = d => d ? Math.round((new Date(today) - new Date(d)) / 864e5) : null;
  const ch = a => (SA_CH[a.platform] || a.platform) + (a.account ? ' ' + String(a.account).replace(/^@/, '') : '');
  const lineLab = { '외': '외국어', '솔': '솔루션즈' };
  const at = S.at ? new Date(S.at) : null;
  box.innerHTML = `<details class="upst" ${open ? 'open' : ''} style="margin:4px 0 12px;border:1px solid var(--line,#dde5f0);border-radius:10px;padding:8px 12px;background:var(--card,#fff)">
    <summary style="cursor:pointer;font-weight:700">📊 계정별 업로드 현황 <span class="u-muted" style="font-weight:400;font-size:12px">· ${at ? at.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' 갱신' : ''} · 2시간마다 자동</span></summary>
    <table style="margin-top:8px"><tr><th>라인</th><th>계정</th><th>마지막 게시</th><th>최근 7일</th><th>최근 30일</th><th>이번 달</th><th>예약</th><th>누적</th></tr>
    ${rows.map(a => { const g = ago(a.last); const warn = g === null || g > 7;
      return `<tr><td>${lineLab[a.line] || a.line}</td><td><b>${esc(ch(a))}</b></td>
        <td style="white-space:nowrap;${warn ? 'color:var(--warn,#c0392b);font-weight:700' : ''}">${a.last ? a.last.slice(5) + ` (${g === 0 ? '오늘' : g + '일 전'})` : '기록 없음'}</td>
        <td>${a.d7 || 0}</td><td>${a.d30 || 0}</td><td>${(a.months || {})[mon] || 0}</td>
        <td>${a.planned ? a.planned + (a.next ? ' · ' + a.next.slice(5) : '') : '—'}</td><td class="u-muted">${a.total || 0}</td></tr>`; }).join('')}
    </table><p class="note" style="margin:6px 0 0">빨간 날짜 = 7일 넘게 게시가 없거나 기록이 없는 계정. 숫자는 ${esc(S.since || '')} 이후 실제 게시 기준(카드와 연결된 글 포함).</p></details>`;
  box.querySelector('details').ontoggle = e => { try { localStorage.setItem('kj_upst', e.target.open ? '1' : '0'); } catch (_) {} };
}

function renderCalendar(evs){
  const y = calBase.getFullYear(), mo = calBase.getMonth();
  $('#cal-title').textContent = `${y}년 ${mo+1}월`;

  const first = new Date(y, mo, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(y, mo+1, 0).getDate();
  const today = new Date().toISOString().slice(0,10);

  const byDay = {};
  evs.forEach(e => { if (e.date) (byDay[e.date] ||= []).push(e); });

  const order = { shoot:0, edit:1, planned:2, done:3 };
  Object.values(byDay).forEach(list => list.sort((a,b) => order[a.kind] - order[b.kind]));

  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push('<div class="cell out"></div>');
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${y}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const items = byDay[key] || [];
    const dow = (startPad + d - 1) % 7;
    cells.push(`<div class="cell ${key===today?'today':''}" data-day="${key}">
      <div class="cell-d ${dow===0?'sun':''} ${dow===6?'sat':''}">${d}</div>
      ${items.map(e => {
        if (e.auto) return autoEvHTML(e);
        const k = SC_KINDS[e.kind];
        const color = { shoot:'#E08A2E', edit:'#2EA88A', planned:'#2E7BE4', done:'#0B2A5B' }[e.kind] || '#DDE5F0';
        return `<div class="ev" draggable="true" data-open="${e.card.id}"
          data-ev="${e.card.id}|${e.kind}" style="border-left-color:${color}"
          title="${esc(k.label)} · ${esc(e.card.title)} — 끌어서 날짜를 옮길 수 있습니다">
          <span class="dotmark ${k.cls}"></span>${scLine === 'all' ? tagHTML(e.card) : ''}${esc(e.card.title)}</div>`;
      }).join('')}
    </div>`);
  }
  while (cells.length % 7) cells.push('<div class="cell out"></div>');

  const noDate = evs.filter(e => !e.date && !e.auto);

  $('#schedule-body').innerHTML = `
    <div class="calgrid">
      ${['일','월','화','수','목','금','토'].map((d,i) =>
        `<div class="cal-h ${i===0?'sun':''} ${i===6?'sat':''}">${d}</div>`).join('')}
      ${cells.join('')}
    </div>
    <div class="callegend">
      <span><span class="dotmark k-shoot"></span>촬영</span>
      <span><span class="dotmark k-edit"></span>편집</span>
      <span><span class="dotmark k-plan"></span>게시 예정</span>
      <span><span class="dotmark k-done"></span>게시 완료</span>
      <span>🤖 자동 = 카드 없던 실제 게시물·예약 업로드</span>
      <span class="u-muted">촬영은 촬영일, 나머지는 게시예정일에 표시됩니다 · 끌어서 날짜를 옮기고, 빈 칸을 누르면 그 날짜로 새 일정이 생깁니다</span>
    </div>
    ${noDate.length ? `<div class="sect" style="margin-top:26px">날짜 미정 ${noDate.length}개</div>
      ${scheduleTableHTML(noDate)}` : ''}`;
}

function scheduleTableHTML(evs){
  const today = new Date().toISOString().slice(0,10);
  return `<table>
    <tr><th>날짜</th><th>분류</th><th>콘텐츠</th><th>채널</th><th>담당</th><th>조회</th><th>저장</th><th></th></tr>
    ${evs.map(e => {
      const c = e.card, k = SC_KINDS[e.kind];
      const late = e.date && e.date < today && e.kind !== 'done';
      const pill = { shoot:'pill pending', edit:'pill pending',
                     planned:'pill pending', done:'pill approved' }[e.kind];
      return `<tr>
        <td style="font-variant-numeric:tabular-nums;white-space:nowrap">${e.date || '미정'}
          ${late ? '<br><span class="pill rejected">지남</span>' : ''}
          <br><span style="font-size:11px;color:var(--muted)">${e.kind === 'shoot' ? '촬영일' : '게시예정일'}</span></td>
        <td><span class="${pill}">${k.label}</span></td>
        <td data-open="${c.id}" style="cursor:pointer">${tagHTML(c)}<b>${esc(c.title)}</b>
          ${c.publish_url ? ` <a href="${esc(c.publish_url)}" target="_blank" rel="noopener" style="font-size:12px">게시 링크</a>` : ''}
          ${c.reference_url ? ` <a href="${esc(c.reference_url)}" target="_blank" rel="noopener" style="font-size:12px">레퍼런스</a>` : ''}
          ${c.key_message ? `<br><span class="u-sm">${esc(c.key_message)}</span>` : ''}</td>
        <td class="u-sm">${esc((c.channels||[]).join(', ') || '—')}</td>
        <td>${esc(ownerNames(c.owner_ids))}</td>
        <td style="font-variant-numeric:tabular-nums">${fmtN(c.views)}</td>
        <td style="font-variant-numeric:tabular-nums">${fmtN(c.saves)}</td>
        <td class="u-nowrap">
          ${e.kind === 'planned' ? `<button class="btn sm" data-sdone="${c.id}">게시 완료</button>` : ''}
          ${e.kind === 'done' ? `<button class="btn sm ghost" data-splan="${c.id}">예정으로</button>` : ''}
          ${(e.kind === 'planned' || e.kind === 'done')
            ? `<button class="btn sm danger" data-cancel="${c.id}">게시취소</button>` : ''}
        </td></tr>`;
    }).join('')}
  </table>`;
}

function renderScheduleTable(evs){
  const rows = [...evs].filter(e => !e.auto).sort((a,b) => (a.date || '9999').localeCompare(b.date || '9999'));
  $('#schedule-body').innerHTML = rows.length
    ? scheduleTableHTML(rows) + '<p class="note">촬영·편집 카드는 생산 라인에서 관리합니다. 여기서는 일정만 봅니다.<br>게시취소를 누르면 아이디어 단계로 돌아갑니다. 입력한 내용과 성과는 그대로 남습니다.</p>'
    : '<div class="empty">해당하는 일정이 없습니다.</div>';
}

function wireScheduleButtons(){
  $$('#schedule-body [data-open]').forEach(el =>
    el.onclick = () => openCard(cards.find(c => c.id === el.dataset.open)));

  // 캘린더에서 일정을 끌어 다른 날짜로 옮긴다
  $$('#schedule-body .ev[data-ev]').forEach(el => {
    el.ondragstart = ev => {
      ev.dataTransfer.setData('text/plain', el.dataset.ev);
      ev.dataTransfer.effectAllowed = 'move';
      el.classList.add('dragging');
    };
    el.ondragend = () => el.classList.remove('dragging');
  });

  $$('#schedule-body .cell[data-day]').forEach(cell => {
    // 빈 곳을 누르면 그 날짜로 새 일정을 만든다
    cell.onclick = ev => {
      if (ev.target.closest('.ev')) return;      // 일정 자체를 누른 경우는 제외
      newScheduleCard(cell.dataset.day);
    };
    cell.ondragover = ev => { ev.preventDefault(); cell.classList.add('drop'); };
    cell.ondragleave = () => cell.classList.remove('drop');
    cell.ondrop = async ev => {
      ev.preventDefault(); cell.classList.remove('drop');
      const raw = ev.dataTransfer.getData('text/plain');
      if (!raw || !raw.includes('|')) return;
      const [id, kind] = raw.split('|');
      const card = cards.find(c => c.id === id);
      if (!card) return;

      const field = SC_KINDS[kind].dateKey;      // 촬영이면 촬영일, 아니면 게시예정일
      const newDate = cell.dataset.day;
      if (card[field] === newDate) return;

      const patch = {}; patch[field] = newDate;
      const { error } = await sb.from('contents').update(patch).eq('id', id);
      if (error) return uiAlert(cleanErr(error.message));
      await refresh();
    };
  });
  $$('#schedule-body [data-sdone]').forEach(b => b.onclick = () => moveStage(b.dataset.sdone, DONE));
  $$('#schedule-body [data-splan]').forEach(b => b.onclick = () => moveStage(b.dataset.splan, PLANNED));
  $$('#schedule-body [data-cancel]').forEach(b => b.onclick = async () => {
    const c = cards.find(x => x.id === b.dataset.cancel);   // v101 되돌릴 수 있는 일은 묻지 않는다
    const was = c.stage;
    await moveStage(c.id, IDEA);
    uiToast('게시 취소: ' + String(c.title || '').slice(0, 24) + ' · 아이디어로 보냈습니다',
      { action: { label: '되돌리기', run: () => moveStage(c.id, was) } });
  });
}

// 게시 일정에서 바로 새 콘텐츠를 만든다
function newScheduleCard(dateStr){
  const asShoot = scCat === 'shoot';
  const preset = asShoot
    ? { stage: '촬영',  shoot_date: dateStr || null }
    : { stage: PLANNED, publish_date: dateStr || null };
  openCard(null, { ...preset, team_tag: scLine === 'all' ? lineOf() : scLine });   // v39: 게시 일정에서 고른 라인(전체면 생산 라인 탭의 라인)
}

$('#sc-new').onclick = () => newScheduleCard(null);

$$('.sc-view').forEach(b => b.onclick = () => {
  $$('.sc-view').forEach(x => x.classList.remove('on'));
  b.classList.add('on'); scView = b.dataset.view2; renderSchedule();
});
$$('.sc-cat').forEach(b => b.onclick = () => {
  $$('.sc-cat').forEach(x => x.classList.remove('on'));
  b.classList.add('on'); scCat = b.dataset.cat; renderSchedule();
});
$('#cal-prev').onclick  = () => { calBase = new Date(calBase.getFullYear(), calBase.getMonth()-1, 1); renderSchedule(); };
$('#cal-next').onclick  = () => { calBase = new Date(calBase.getFullYear(), calBase.getMonth()+1, 1); renderSchedule(); };
$('#cal-today').onclick = () => { calBase = new Date(); renderSchedule(); };


/* ---------------- 공용 서랍 (열림/닫힘·저장 확인) ----------------
   여러 화면이 같은 규칙을 쓰도록 한곳에 모았다.
   · Esc → 닫기 (변경사항 있으면 물어봄)
   · 바깥 클릭 → 변경 없으면 그냥 닫고, 그 자리에 다른 카드가 있으면 그 카드를 연다
   · 변경 있으면 저장할지 물어본다
------------------------------------------------------------------ */
function mountDrawer({ body, collect, save }){
  $('#drawer-root').innerHTML = `<div class="scrim"><div class="drawer" tabindex="-1">
    <div class="dbar">
      <div class="dbar-l" id="dw-crumb"></div>
      <div class="dbar-r">
        <div class="hint" id="dw-hint"></div>
        <button class="close" id="dw-close">닫기</button>
      </div>
    </div>
    <div class="dinner">${body}</div>
  </div></div>`;

  // 제목을 위쪽 막대에도 짧게 보여준다
  const h2 = $('.dinner h2');
  if (h2) $('#dw-crumb').textContent = h2.textContent;

  // 저장·취소 버튼을 아래에 고정한다
  const acts = $('.dinner .drawer-actions');
  if (acts) acts.classList.add('stick');

  const snap = o => JSON.stringify({
    ...o,
    owner_ids: [...(o.owner_ids || [])].sort(),
    attendee_ids: [...(o.attendee_ids || [])].sort(),
    channels: [...(o.channels || [])].sort()
  });
  let initial = snap(collect());
  const dirty = () => snap(collect()) !== initial;
  // 내용을 나중에 채우는 화면(이미지 편집 등)에서 기준을 다시 잡을 때 쓴다
  const resetBaseline = () => { initial = snap(collect()); };

  const forceClose = () => {
    window.onbeforeunload = null;
    window.__drawerGuard = null;
    $('#drawer-root').innerHTML = '';
  };
  window.onbeforeunload = () => dirty() ? '' : undefined;

  const saveAndClose = async () => {
    const ok = await save();
    if (!ok) return false;
    forceClose(); await refresh(); return true;
  };

  const discard = async () => {
    if (dirty() && !await uiConfirm('작성하던 내용을 버리고 닫습니다.', { ok: '버리고 닫기', cancel: '계속 편집', danger: true })) return;
    forceClose();
  };

  // 닫기 시도 — 변경사항이 있으면 물어본다. next 는 닫힌 뒤 실행할 동작.
  const tryClose = async (next) => {
    if (!dirty()) { forceClose(); if (next) next(); return; }
    const yes = await uiConfirm('저장하지 않은 내용이 있습니다.', { ok: '저장하고 닫기', cancel: '계속 편집' });
    if (!yes) return;
    if (await saveAndClose()) { if (next) next(); }
  };

  $('#dw-close').onclick = () => tryClose();

  // 저장하지 않은 변경이 있으면 위쪽 막대에 알린다
  const flag = $('#dw-hint');
  const syncFlag = () => {
    if (!flag) return;
    const on = dirty();
    flag.textContent = on ? '저장하지 않은 변경' : '';
    flag.classList.toggle('show', on);
    flag.classList.toggle('warn', on);
  };
  const dr = $('.drawer');
  ['input','change','keyup'].forEach(ev => dr.addEventListener(ev, () => {
    clearTimeout(window.__flagT);
    window.__flagT = setTimeout(syncFlag, 250);
  }));

  // 위쪽 메뉴를 누르면 편집창을 먼저 정리한다
  window.__drawerGuard = tryClose;

  // 바깥 클릭 — 그 자리에 있던 카드를 찾아 이어서 연다
  $('.scrim').onclick = async e => {
    if (!e.target.classList.contains('scrim')) return;
    const x = e.clientX, y = e.clientY;
    const scrim = $('.scrim');
    scrim.style.pointerEvents = 'none';
    const under = document.elementFromPoint(x, y);
    scrim.style.pointerEvents = '';

    const hitCard  = under && under.closest && under.closest('.card[data-id]');
    const hitOpen  = under && under.closest && under.closest('[data-open]');
    const nextId   = hitCard ? hitCard.dataset.id : (hitOpen ? hitOpen.dataset.open : null);

    if (nextId && (e.ctrlKey || e.metaKey)) {   // Ctrl+클릭 — 지금 창은 그대로, 새 창으로
      window.open(deepLink('card', nextId), '_blank');
      return;
    }
    await tryClose(nextId ? () => {
      const c = cards.find(x2 => x2.id === nextId);
      if (c) openCard(c);
    } : null);
  };

  // Esc 로 닫기, Ctrl+S 로 저장
  const onKey = async e => {
    if (e.key === 'Escape') { e.preventDefault(); await tryClose(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); await saveAndClose(); }
  };
  $('.drawer').onkeydown = onKey;
  document.onkeydown = e => { if ($('.drawer')) onKey(e); };
  setTimeout(() => { const d = $('.drawer'); if (d) d.focus(); }, 0);

  return { dirty, forceClose, saveAndClose, discard, tryClose, resetBaseline };
}

/* ================= 글쓰기 ================= */
let poFilter = 'all';

