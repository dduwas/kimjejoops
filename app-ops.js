'use strict';
// 김제조 웍스 — 최종검수·운영관리(쓰레드·캐러셀·댓글·업로드)  (v88에서 index.html 에서 분리)
/* ---------------- 최종검수 (v43) ---------------- */
let reviewFiles = [], rvFilter = 'pending';
async function loadReview(){
  const { data, error } = await sb.from('review_files').select('*').order('mtime', { ascending:false }).limit(400);
  reviewFiles = error ? [] : (data || []);
}
const rvStatusKo = { pending:'검수 대기', ok:'OK', rejected:'반려', baseline:'기존 파일' };
const fmtMB = n => n ? (n / 1048576 >= 1024 ? (n / 1073741824).toFixed(1) + 'GB' : Math.round(n / 1048576) + 'MB') : '';
const fmtKst = t => t ? new Date(t).toLocaleString('ko-KR', { timeZone:'Asia/Seoul', month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '';
function canReview(r){
  if (!profile) return false;
  if (['master','admin','lead'].includes(profile.role)) return true;
  const c = cards.find(x => x.id === r.content_id);
  return !!(c && (c.owner_ids || []).includes(me.id));
}
// 11-09 카드 고르기: 단계별 묶음, 편집 중인 카드를 맨 위에
const RV_GROUPS = ['편집', '검수·승인', '촬영', '대본', '아이디어', '게시예정', '게시완료'];
function rvOpts(c, sel){
  const all = cards.filter(x => x.stage !== DROP);
  if (c && !all.includes(c)) all.unshift(c);
  const one = o => `<option value="${o.id}" ${o.id === sel ? 'selected' : ''}>[${esc(TEAM_LABEL[o.team_tag] || o.team_tag || '')}] ${esc(o.title)} · ${esc(o.stage)}</option>`;
  const by = st => all.filter(o => o.stage === st).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  const rest = all.filter(o => !RV_GROUPS.includes(o.stage));
  return RV_GROUPS.map(st => { const L = by(st); return L.length ? `<optgroup label="${st === '편집' ? '✂️ 편집 중' : esc(st)} (${L.length})">${L.map(one).join('')}</optgroup>` : ''; }).join('')
    + (rest.length ? `<optgroup label="기타 (${rest.length})">${rest.map(one).join('')}</optgroup>` : '');
}
function renderReview(){
  const pend = reviewFiles.filter(r => r.kind === 'master' && r.status === 'pending').length;
  const bd = $('#rv-badge'); if (bd) { bd.textContent = pend; bd.classList.toggle('hide', !pend); }
  const box = $('#rv-list'); if (!box || $('#view-review').classList.contains('hide')) return;
  let list = reviewFiles.filter(r => r.kind === 'master');
  if (rvFilter !== 'all') list = list.filter(r => r.status === rvFilter);
  // 11-09 카드 미연결 강조: 생산 라인에 없는 영상을 맨 위로, 빨간 줄로
  const rvLinked = r => !!cards.find(x => x.id === r.content_id);
  list = list.slice().sort((a, b) => rvLinked(a) - rvLinked(b));
  const rvNoLink = list.filter(r => !rvLinked(r)).length;
  if (!document.getElementById('rv-nolink-css')) { const st = document.createElement('style'); st.id = 'rv-nolink-css'; st.textContent = '.rv-t tr.rv-nolink td{background:#fff1f1}.rv-t tr.rv-nolink td:first-child{border-left:4px solid #e03131}.rv-nolink-badge{display:inline-block;background:#e03131;color:#fff;font-weight:700;font-size:12px;border-radius:6px;padding:2px 8px;margin:0 0 4px}.rv-nolink-sum{color:#e03131;font-weight:700}'; document.head.appendChild(st); }
  $('#rv-count').innerHTML = list.length + '건' + (rvNoLink ? ` · <span class="rv-nolink-sum">🔴 카드 미연결 ${rvNoLink}건</span>` : '');
  if (!list.length) { box.innerHTML = `<p class="lede">${rvFilter === 'pending' ? '검수 대기 중인 영상이 없습니다. NAS 인스타그램 폴더에 새 파일이 올라오면 여기 뜹니다.' : '해당 항목이 없습니다.'}</p>`; return; }
  const opts = cards.filter(c => c.stage !== DROP).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  box.innerHTML = `<table class="rv-t"><thead><tr><th>파일 (올라온 날짜)</th><th>연결된 카드</th><th>확인할 것</th><th>검수</th></tr></thead><tbody>${list.map(r => {
    const c = cards.find(x => x.id === r.content_id);
    const clean = reviewFiles.filter(x => x.master_id === r.id);
    const warns = [];
    if (!c) warns.push('생산 라인 카드와 연결되지 않았습니다 — 맞는 카드를 고르거나, 라인에서 빠진 카드를 찾아 정리해 주세요');
    else {
      if (r.match_score != null && r.match_score < 0.7) warns.push('파일 제목과 카드 제목이 조금 다릅니다');
      const pd = c.publish_date;
      if (r.file_date && pd && Math.abs(Date.parse(r.file_date) - Date.parse(pd)) > 3 * 864e5) warns.push(`파일 날짜 ${r.file_date} ↔ 카드 게시일 ${pd}`);
      if (!pd) warns.push('카드 게시일이 비어 있습니다');
    }
    if (!clean.length) warns.push('클린본이 아직 없습니다');
    const can = canReview(r) && r.status !== 'baseline';
    return `<tr${c ? '' : ' class="rv-nolink"'}>
      <td class="fn">${c ? '' : '<div class="rv-nolink-badge">🔴 카드 미연결 — 생산 라인에 없는 영상</div><br>'}${esc(r.filename)}<div class="rv-sub">파일 날짜 ${esc(r.file_date || '-')} · NAS 올라옴 ${esc(fmtKst(r.mtime))} · ${fmtMB(r.size)}${clean.length ? ' · 클린본 ✓' : ''}</div>
        <div class="rv-sub">${esc(r.path)}</div></td>
      <td><select data-rvlink="${r.id}" ${r.status === 'pending' ? '' : 'disabled'}><option value="">— 카드 선택 —</option>${rvOpts(c, r.content_id)}</select>
        ${c ? `<div class="rv-sub">담당 ${esc(ownerNames(c.owner_ids))}${c.publish_date ? ' · 게시일 ' + esc(c.publish_date) : ''} · <a href="#" data-rvopen="${c.id}">카드 열기</a></div>` : ''}</td>
      <td>${warns.length ? warns.map(w => `<div class="rv-warn">⚠ ${esc(w)}</div>`).join('') : '<span class="rv-ok">제목·날짜 일치</span>'}
        ${r.note ? `<div class="rv-sub">메모: ${esc(r.note)}</div>` : ''}</td>
      <td>${r.status === 'pending'
        ? (can ? `<button class="btn sm" data-rvok="${r.id}">OK</button> <button class="btn sm danger" data-rvno="${r.id}">반려</button>` : '<span class="rv-sub">카드 담당자·관리자만 검수</span>')
        : `<span class="${r.status === 'ok' ? 'rv-ok' : r.status === 'rejected' ? 'rv-bad' : ''}">${rvStatusKo[r.status]}</span>${r.reviewed_by ? `<div class="rv-sub">${esc(nameOf(r.reviewed_by))} · ${esc(fmtKst(r.reviewed_at))}</div>` : ''}`}</td></tr>`;
  }).join('')}</tbody></table>`;
  box.querySelectorAll('[data-rvlink]').forEach(s => s.onchange = async () => {
    const { data, error } = await sb.rpc('review_link', { p_id: s.dataset.rvlink, p_content: s.value || null });
    if (error || !data?.ok) return uiAlert((data && data.msg) || error?.message || '연결 실패');
    await refresh();
  });
  box.querySelectorAll('[data-rvopen]').forEach(a => a.onclick = e => { e.preventDefault(); const c = cards.find(x => x.id === a.dataset.rvopen); if (c) openCard(c); });
  const decide = async (id, ok) => {
    let note = null;
    if (!ok) { note = await uiPrompt('반려 사유를 적어 주세요 (편집 담당자에게 카드 다음 액션으로 전달됩니다)'); if (note === null) return; }
    const { data, error } = await sb.rpc('review_decide', { p_id: id, p_ok: ok, p_note: note });
    if (error || !data?.ok) return uiAlert((data && data.msg) || error?.message || '처리 실패');
    await refresh();
  };
  box.querySelectorAll('[data-rvok]').forEach(b => b.onclick = () => decide(b.dataset.rvok, true));
  box.querySelectorAll('[data-rvno]').forEach(b => b.onclick = () => decide(b.dataset.rvno, false));
}
document.querySelectorAll('.rv-f').forEach(b => b.onclick = () => {
  document.querySelectorAll('.rv-f').forEach(x => x.classList.remove('on')); b.classList.add('on'); rvFilter = b.dataset.rvf; renderReview();
});

/* ---------------- 운영관리 (v44, 입장 비밀번호) ---------------- */
// 비밀번호 통과(gate 'video', 12시간) 뒤 3칸: 댓글·DM / AI 영상편집 / SNS 성과
let vdOpen = null, opsTab = 'sns', opsData = null, opsPf = 'all', opsSort = 'views', opsCmAcc = 'all', opsCmSt = 'todo', opsUpSt = 'draft', opsThreadsReady = false, opsUp = 'threads', opsCarSt = 'draft';
try { opsUp = localStorage.getItem('kj_opsup') || 'threads'; } catch (e) {}
try { opsTab = localStorage.getItem('kj_opstab') || 'sns'; } catch (e) {}
if (opsTab === 'video') opsTab = 'sns';   // v67: 🎬 AI 영상편집 탭 내림
const opsN = n => (n == null ? '-' : Number(n).toLocaleString('ko-KR'));
const PF_KO = { youtube:'유튜브', instagram:'인스타', instagram_global:'인스타 @jejo.kpharmacist', xiaohongshu:'샤오홍슈', douyin:'더우인', threads:'쓰레드', _summary:'요약' };
// Account history is read only in the browser; collection is handled by a DB trigger.
let opsTrendAccount = 'all', opsTrendDays = '30';
const trendKey = a => JSON.stringify([a.platform, a.handle || '']);
const trendDay = date => new Date(new Date(date).getTime() + 9 * 3600000).toISOString().slice(0, 10);
const trendValidCount = n => n !== null && n !== '' && Number.isSafeInteger(Number(n)) && Number(n) >= 0;
async function loadFollowerHistory(){
  const rows = [];
  try {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await sb.from('ops_sns_follower_daily')
        .select('platform,handle,day,followers,observed_at,source')
        .order('day').order('platform').order('handle').range(offset, offset + 999);
      if (error) return { rows: [], error: true };
      rows.push(...(data || []));
      if (!data || data.length < 1000) return { rows, error: false };
    }
  } catch (_) { return { rows: [], error: true }; }
}
function trendSeries(rows, account, days, today = trendDay(new Date())){
  const cutoff = days === 'all' ? '' : new Date(Date.parse(today + 'T00:00:00Z') - (Number(days) - 1) * 86400000).toISOString().slice(0, 10);
  const daily = new Map();
  rows.filter(r => trendKey(r) === trendKey(account) && /^\d{4}-\d{2}-\d{2}$/.test(r.day) && r.day <= today && trendValidCount(r.followers))
    .sort((a, b) => String(a.observed_at || '').localeCompare(String(b.observed_at || '')))
    .forEach(r => daily.set(r.day, { ...r, followers: Number(r.followers) }));
  const all = [...daily.values()].sort((a, b) => a.day.localeCompare(b.day));
  const points = all.filter(r => !cutoff || r.day >= cutoff);
  const first = points[0], last = points[points.length - 1];
  const delta = points.length > 1 ? last.followers - first.followers : null;
  return { points, latest: all[all.length - 1], first, last, delta, rate: delta !== null && first.followers > 0 ? delta / first.followers * 100 : null };
}
function trendPlot(points, title){
  if (!points.length) return '<div class="ft-empty">선택 기간에 수집 기록이 없습니다.</div>';
  const W = 520, H = 210, L = 62, R = 20, T = 18, B = 37;
  const min = Math.min(...points.map(p => p.followers)), max = Math.max(...points.map(p => p.followers));
  const pad = Math.max(1, Math.ceil((max - min) * .15));
  const low = Math.max(0, min - pad), high = Math.max(low + 2, max + pad);
  const start = Date.parse(points[0].day), end = Date.parse(points[points.length - 1].day);
  const xy = points.map(p => ({ ...p, x: start === end ? (L + W - R) / 2 : L + (Date.parse(p.day) - start) / (end - start) * (W - L - R), y: H - B - (p.followers - low) / (high - low) * (H - T - B) }));
  const grid = [0, 1, 2].map(i => {
    const value = low + (high - low) * i / 2, y = H - B - i / 2 * (H - T - B);
    return `<line x1="${L}" x2="${W-R}" y1="${y}" y2="${y}" stroke="var(--line)"/><text x="${L-9}" y="${y+4}" text-anchor="end">${opsN(Math.round(value))}</text>`;
  }).join('');
  return `<svg class="ft-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}" data-ft-plot>
    <title>${esc(title)}</title>${grid}
    ${xy.length > 1 ? `<polyline points="${xy.map(p => p.x + ',' + p.y).join(' ')}" fill="none" stroke="var(--blue)" stroke-width="2.5" stroke-linejoin="round"/>` : ''}
    ${xy.map(p => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="var(--blue)" tabindex="0" data-ft-point data-ft-x="${p.x}" data-ft-label="${esc(p.day + ' · ' + opsN(p.followers) + '명')}" aria-label="${esc(p.day + ' · ' + opsN(p.followers) + '명')}"><title>${esc(p.day)} · ${opsN(p.followers)}명</title></circle>`).join('')}
    <text x="${L}" y="${H-10}">${esc(points[0].day.slice(5).replace('-', '/'))}</text>
    ${xy.length > 1 ? `<text x="${W-R}" y="${H-10}" text-anchor="end">${esc(points[points.length - 1].day.slice(5).replace('-', '/'))}</text>` : ''}
    </svg>`;
}
function followerTrendHTML(accs, history){
  if (opsTrendAccount !== 'all' && !accs.some(a => trendKey(a) === opsTrendAccount)) opsTrendAccount = 'all';
  const selected = accs.filter(a => opsTrendAccount === 'all' || trendKey(a) === opsTrendAccount);
  const sign = n => (n > 0 ? '+' : '') + opsN(n);
  return `<section class="ft-section" aria-labelledby="ft-heading">
    <div class="ft-heading"><h4 id="ft-heading">계정별 팔로워·구독자 추이</h4><button class="chip" data-ft-reload>새로고침</button></div>
    <div class="ft-controls"><label>계정 <select data-ft-account aria-label="추이 계정 선택"><option value="all">전체 계정</option>${accs.map(a => `<option value="${esc(trendKey(a))}" ${trendKey(a) === opsTrendAccount ? 'selected' : ''}>${esc(PF_KO[a.platform] || a.platform)} · ${esc(a.handle || '')}</option>`).join('')}</select></label>
      <div class="ft-periods" role="group" aria-label="추이 기간">${['7','30','90','all'].map(d => `<button class="chip ${opsTrendDays === d ? 'on' : ''}" data-ft-days="${d}" aria-pressed="${opsTrendDays === d}">${d === 'all' ? '전체' : d + '일'}</button>`).join('')}</div></div>
    <p class="rv-sub">수집된 날짜의 실제 수치만 표시합니다. 유튜브는 구독자 수입니다. 각 그래프의 세로축 범위는 다릅니다.</p>
    ${history.error ? '<p class="ft-error" role="status">팔로워 기록을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.</p>' : `<div class="ft-grid ${selected.length === 1 ? 'ft-single' : ''}">${selected.map(a => {
      const s = trendSeries(history.rows, a, opsTrendDays), label = (PF_KO[a.platform] || a.platform) + ' · ' + (a.handle || '');
      const title = label + ' ' + (a.platform === 'youtube' ? '구독자' : '팔로워') + ' 추이';
      return `<article class="ft-card"><b>${esc(label)}</b>
        <div class="ft-stat">${s.latest ? opsN(s.latest.followers) + '<small>명 · 최근 기록</small>' : '기록 대기'}</div>
        <div class="ft-change ${s.delta > 0 ? 'ft-up' : s.delta < 0 ? 'ft-down' : ''}">${s.delta === null ? (s.points.length === 1 ? '비교 대기 · 기록 1일' : '기간 내 기록 없음') : sign(s.delta) + '명' + (s.rate === null ? ' · 증가율 기준 없음' : ' (' + (s.rate > 0 ? '+' : '') + s.rate.toFixed(1) + '%)') + ' · 기간 내 증감'}</div>
        ${trendPlot(s.points, title)}
        <div class="ft-readout" aria-live="polite">${s.last ? esc(s.last.day) + ' · ' + opsN(s.last.followers) + '명' : s.latest ? '마지막 기록 ' + esc(s.latest.day) + ' · ' + opsN(s.latest.followers) + '명' : '첫 수집 후 표시됩니다.'}</div>
        <p class="rv-sub">${s.points.length > 1 ? esc(s.first.day) + ' → ' + esc(s.last.day) + ' · ' + s.points.length + '일 기록' : s.points.length === 1 ? '다음 날짜 기록이 쌓이면 증가 추이가 표시됩니다.' : '수집이 없는 날을 0명으로 처리하지 않습니다.'}</p>
        ${s.points.length ? `<details><summary class="rv-sub">날짜별 수치</summary><div class="ft-table"><table class="rv-t ops-t"><thead><tr><th>수집일</th><th>인원</th></tr></thead><tbody>${s.points.slice().reverse().map(p => `<tr><td>${esc(p.day)}</td><td>${opsN(p.followers)}명</td></tr>`).join('')}</tbody></table></div></details>` : ''}
      </article>`;
    }).join('')}</div>`}</section>`;
}
function bindFollowerTrend(body){
  body.querySelector('[data-ft-account]').onchange = e => { opsTrendAccount = e.target.value; renderOpsSns(body); };
  body.querySelectorAll('[data-ft-days]').forEach(b => b.onclick = () => { opsTrendDays = b.dataset.ftDays; renderOpsSns(body); });
  body.querySelector('[data-ft-reload]').onclick = async e => {
    e.target.disabled = true; e.target.textContent = '불러오는 중…';
    await loadOps();
    if (opsTab === 'sns' && document.contains(body)) renderOpsSns(body);
  };
  body.querySelectorAll('[data-ft-plot]').forEach(svg => {
    const readout = svg.closest('.ft-card').querySelector('.ft-readout');
    const dots = [...svg.querySelectorAll('[data-ft-point]')];
    dots.forEach(dot => dot.onfocus = () => { readout.textContent = dot.dataset.ftLabel; });
    svg.onpointermove = e => {
      const rect = svg.getBoundingClientRect(), x = (e.clientX - rect.left) / rect.width * 520;
      const dot = dots.reduce((best, d) => Math.abs(Number(d.dataset.ftX) - x) < Math.abs(Number(best.dataset.ftX) - x) ? d : best, dots[0]);
      if (dot) readout.textContent = dot.dataset.ftLabel;
    };
  });
}

async function loadOps(){
  const [a, p, l, cm, history] = await Promise.all([
    sb.from('ops_sns_accounts').select('*').order('sort', { ascending:true }),
    sb.from('ops_sns_posts').select('*').order('published', { ascending:false }).limit(1000),
    sb.from('ops_sync_log').select('*').order('at', { ascending:false }).limit(1),
    sb.from('ops_comments').select('*').order('created_at', { ascending:false }).limit(1000),
    loadFollowerHistory()
  ]);
  try { const { data: tr } = await sb.from('ops_sync_log').select('id').eq('kind', 'threads_ok').limit(1); opsThreadsReady = !!(tr && tr.length); } catch (e) {}
  opsData = { acc: a.data || [], posts: p.data || [], last: (l.data || [])[0] || null, comments: cm.data || [], history };
}
async function renderVideo(){
  const root = $('#vd-root'); if (!root || $('#view-video').classList.contains('hide')) return;
  if (vdOpen === null) {
    // v65: 이 브라우저에 출입증이 있으면 비밀번호 없이 입장(잠그기·비밀번호 변경 시 무효)
    let dt = null; try { dt = localStorage.getItem('kj_gate_video'); } catch (e) {}
    if (dt) { const { data } = await sb.rpc('gate_device', { p_gate: 'video', p_token: dt }); vdOpen = !!data; if (!data) { try { localStorage.removeItem('kj_gate_video'); } catch (e) {} } }
    if (!vdOpen) { const { data } = await sb.rpc('gate_status', { p_gate: 'video' }); vdOpen = !!data; }
  }
  if (!vdOpen) {
    root.innerHTML = `<div class="vd-lock"><h3>🔐 운영관리</h3><p class="lede" style="margin:0">허가된 사람만 들어갈 수 있습니다.<br>입장 비밀번호를 넣어 주세요.</p>
      <form id="vd-form" autocomplete="off"><input type="password" id="vd-pw" placeholder="입장 비밀번호" autocomplete="new-password">
      <button class="btn" style="width:100%">들어가기</button></form><div class="vd-msg" id="vd-msg"></div></div>`;
    $('#vd-form').onsubmit = async e => {
      e.preventDefault();
      const { data, error } = await sb.rpc('gate_enter', { p_gate: 'video', p_pw: $('#vd-pw').value });
      $('#vd-pw').value = '';
      if (error || !data?.ok) { $('#vd-msg').textContent = (data && data.msg) || error?.message || '확인 실패'; return; }
      try { const { data: dt } = await sb.rpc('gate_remember', { p_gate: 'video', p_label: (navigator.userAgent || '').slice(0, 120) }); if (dt) localStorage.setItem('kj_gate_video', dt); } catch (e) {}
      vdOpen = true; opsData = null; renderVideo();
    };
    setTimeout(() => $('#vd-pw')?.focus(), 0);
    return;
  }
  if (!opsData) { root.innerHTML = '<p class="lede">불러오는 중…</p>'; await loadOps(); }
  const newCm = opsData.comments.filter(c => ['new','drafted'].includes(c.status)).length;
  root.innerHTML = `<h3>🔐 운영관리 <button class="btn sm ghost" id="vd-lockbtn" style="margin-left:8px">잠그기</button></h3>
    <div class="ops-tabs">
      <button data-opstab="comments" class="${opsTab === 'comments' ? 'on' : ''}">💬 댓글·DM${newCm ? ` <span class="nbadge">${newCm}</span>` : ''}</button>
      <button data-opstab="upload" class="${opsTab === 'upload' ? 'on' : ''}">📤 업로드 자동화</button>
      <button data-opstab="anal" class="${opsTab === 'anal' ? 'on' : ''}">🔎 분석 대상</button>
      <button data-opstab="mass" class="${opsTab === 'mass' ? 'on' : ''}">🏭 대본 양산</button>
      <button data-opstab="sns" class="${opsTab === 'sns' ? 'on' : ''}">📈 SNS 성과</button>
      <a class="ops-ext" href="https://works.npksol.space/mcp/beauty/" target="_blank" rel="noopener" title="미모미약국 벤치마킹(새 창)">💊 미모미 벤치마킹 ↗</a>
    </div><div id="ops-body"></div>
    ${profile?.role === 'master' ? `<details class="vd-card" style="max-width:420px;margin-top:28px"><summary style="cursor:pointer;font-weight:800">입장 비밀번호 바꾸기 (대표만)</summary>
      <form id="vd-set" autocomplete="off" style="margin-top:10px"><input type="password" id="vd-new" placeholder="새 비밀번호 (8자 이상)" autocomplete="new-password" style="width:100%;padding:9px;border:1px solid var(--line);border-radius:8px">
      <button class="btn sm" style="margin-top:8px">바꾸기</button> <span class="vd-msg" id="vd-setmsg"></span></form>
      <p class="rv-sub">한 번 들어간 브라우저는 기억되어 다음부터 바로 열립니다(잠그기를 누르면 그 브라우저만 해제). 비밀번호를 바꾸면 기억된 브라우저가 모두 해제됩니다.</p></details>` : ''}`;
  $('#vd-lockbtn').onclick = async () => { let dt = null; try { dt = localStorage.getItem('kj_gate_video'); localStorage.removeItem('kj_gate_video'); } catch (e) {} if (dt) await sb.rpc('gate_forget', { p_gate: 'video', p_token: dt }); await sb.rpc('gate_lock', { p_gate: 'video' }); vdOpen = false; opsData = null; renderVideo(); };
  root.querySelectorAll('[data-opstab]').forEach(b => b.onclick = () => { opsTab = b.dataset.opstab; try { localStorage.setItem('kj_opstab', opsTab); } catch (e) {} renderVideo(); });
  const f = $('#vd-set');
  if (f) f.onsubmit = async e => {
    e.preventDefault();
    const { data, error } = await sb.rpc('gate_set', { p_gate: 'video', p_pw: $('#vd-new').value });
    $('#vd-new').value = '';
    if (!error && data?.ok) { const { data: n } = await sb.rpc('gate_forget_all', { p_gate: 'video' }); try { localStorage.removeItem('kj_gate_video'); } catch (e) {} }
    $('#vd-setmsg').textContent = (error || !data?.ok) ? ((data && data.msg) || error?.message || '실패') : '바뀌었습니다 (기억된 브라우저 모두 해제)';
  };
  const body = $('#ops-body');
  if (opsTab === 'sns') return renderOpsSns(body);
  if (opsTab === 'comments') return renderOpsComments(body);
  if (opsTab === 'upload') return renderOpsUpload(body);
  if (opsTab === 'anal') return renderOpsAnal(body);
  if (opsTab === 'mass') return renderOpsMass(body);
  return renderOpsSns(body);
}
const CHINA_CHANNELS = {
  xiaohongshu:{label:'샤오홍수',profile:'https://www.xiaohongshu.com/user/profile/6a587659000000000f038c02',manage:'https://creator.xiaohongshu.com/'},
  douyin:{label:'더우인',profile:'https://www.douyin.com/user/self',manage:'https://www.douyin.com/user/self'}
};
function chinaChannelPanel(platform){
  const entries=Object.entries(CHINA_CHANNELS).filter(([key])=>!platform||key===platform);
  return '<div class="vd-card"><b>중국 채널 연결·답장</b><p class="rv-sub">로그인은 각 공식 사이트에서 유지됩니다. 마지막 성과 반영 시각과 실제 로그인 상태는 서로 다릅니다. 자동 댓글·DM 연결이 확인되기 전에는 공식 운영 화면에서 답장하세요.</p>'+entries.map(([key,c])=>{
    const a=opsData.acc.find(a=>a.platform===key);
    return '<div style="margin:10px 0"><b>'+esc(c.label)+'</b> · <a target="_blank" rel="noopener" href="'+c.manage+'">공식 운영 화면·답장</a> · <a target="_blank" rel="noopener" href="'+c.profile+'">계정 보기</a><div class="rv-sub">마지막 성과 반영: '+esc(a?.synced?fmtKst(a.synced):'확인할 기록 없음')+'</div></div>';
  }).join('')+'</div>';
}

function renderOpsSns(body){
  const { acc, posts, last } = opsData;
  const sum = acc.find(a => a.platform === '_summary');
  const accs = acc.filter(a => a.platform !== '_summary');
  let list = posts.filter(p => opsPf === 'all' || p.platform === opsPf);
  list = list.slice().sort((a, b) => opsSort === 'views' ? (b.views || 0) - (a.views || 0) : String(b.published).localeCompare(String(a.published)));
  const fm = {}; list.forEach(p => { if (p.views == null || !Number.isFinite(Number(p.views))) return; const k = p.format || '미분류'; (fm[k] = fm[k] || []).push(Number(p.views)); });
  const fmRows = Object.entries(fm).map(([k, v]) => [k, v.length, Math.round(v.reduce((s, x) => s + x, 0) / v.length)]).sort((a, b) => b[2] - a[2]);
  const pfs = ['all', ...new Set(posts.map(p => p.platform))];
  body.innerHTML = `<p class="lede">계정별 SNS 성과와 팔로워·구독자 추이를 확인합니다.
      유튜브·인스타는 매일 아침, 샤오홍슈·더우인은 수집 시 갱신됩니다. 수집되지 않은 수치는 0으로 추정하지 않습니다. 마지막 받은 시각 ${esc(last ? fmtKst(last.at) : '-')}</p>
    ${chinaChannelPanel()}
    <div class="ops-acc">${accs.map(a => `<div class="a"><b>${esc(PF_KO[a.platform] || a.platform)} · ${esc(a.handle || '')}</b>
      <div class="n">${opsN(a.followers)}<span style="font-size:12px;font-weight:600;color:var(--muted)"> ${a.platform === 'youtube' ? '구독' : '팔로워'}</span></div>
      <div class="s">${esc(a.role || '')}<br>게시물 ${opsN(a.posts)}${a.total_views ? ' · 누적 조회 ' + opsN(a.total_views) : ''}${a.operator ? '<br>운영 ' + esc(a.operator) : ''}</div>
      ${a.analysis ? `<details style="margin-top:6px"><summary class="rv-sub" style="cursor:pointer">분석 보기</summary>${['strengths','weaknesses','next'].filter(k => (a.analysis[k] || []).length).map(k => `<div class="rv-sub" style="margin-top:6px"><b>${{ strengths:'강점', weaknesses:'약점', next:'다음 할 것' }[k]}</b><br>${a.analysis[k].map(x => '· ' + esc(x)).join('<br>')}</div>`).join('')}</details>` : ''}</div>`).join('')}</div>
    ${followerTrendHTML(accs, opsData.history)}
    ${sum?.analysis?.points?.length ? `<details class="vd-card" style="margin-bottom:16px"><summary style="cursor:pointer;font-weight:800">전 계정 공통 결론</summary><div class="rv-sub" style="line-height:1.7;margin-top:8px">${sum.analysis.points.map(x => '· ' + esc(x)).join('<br>')}</div></details>` : ''}
    <div class="toolbar" style="padding:0 0 10px">${pfs.map(p => `<button class="chip ${opsPf === p ? 'on' : ''}" data-opspf="${p}">${p === 'all' ? '전체' : esc(PF_KO[p] || p)}</button>`).join('')}
      <div class="sep"></div><button class="chip ${opsSort === 'views' ? 'on' : ''}" data-opssort="views">조회순</button><button class="chip ${opsSort === 'date' ? 'on' : ''}" data-opssort="date">최신순</button>
      <span class="count">${list.length}개</span></div>
    <details style="margin-bottom:12px"><summary class="rv-sub" style="cursor:pointer;font-weight:700">형식별 평균 조회 (조회수가 수집된 게시물만)</summary>
      <table class="rv-t ops-t" style="max-width:520px;margin-top:6px"><tbody>${fmRows.map(r => `<tr><td>${esc(r[0])}</td><td class="num">측정 ${r[1]}개</td><td class="num">평균 ${opsN(r[2])}</td></tr>`).join('')}</tbody></table></details>
    <table class="rv-t ops-t"><thead><tr><th>게시일</th><th>채널</th><th>제목</th><th>형식·주제</th><th>조회</th><th>좋아요</th><th>댓글</th></tr></thead><tbody>${list.slice(0, 300).map(p => `<tr>
      <td class="num">${esc(String(p.published || '').slice(0, 10))}</td><td>${esc(PF_KO[p.platform] || p.platform)}${p.kind ? ` <span class="rv-sub">${esc(p.kind)}</span>` : ''}</td>
      <td>${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title || '(제목 없음)')}</a>` : esc(p.title || '')}</td>
      <td>${p.format ? `<span class="ops-pill">${esc(p.format)}</span>` : ''}${p.topic ? `<span class="ops-pill">${esc(p.topic)}</span>` : ''}</td>
      <td class="num">${opsN(p.views)}</td><td class="num">${opsN(p.likes)}</td><td class="num">${opsN(p.comments)}</td></tr>`).join('')}</tbody></table>`;
  bindFollowerTrend(body);
  body.querySelectorAll('[data-opspf]').forEach(b => b.onclick = () => { opsPf = b.dataset.opspf; renderOpsSns(body); });
  body.querySelectorAll('[data-opssort]').forEach(b => b.onclick = () => { opsSort = b.dataset.opssort; renderOpsSns(body); });
}
function renderOpsComments(body){
  const cm = opsData.comments;
  const ACC = [
    { k:'all', label:'전체', on:true },
    { k:'youtube', label:'유튜브 @kimjejopharma', on:true },
    { k:'instagram', label:'인스타 댓글 @kimjejo_pharma', on:true },
    { k:'instagram_dm', label:'인스타 DM', on:true, warn:'DM은 상대가 마지막 메시지를 보낸 뒤 24시간 안에만 답장할 수 있습니다(인스타 규칙).' },
    { k:'threads', label:'쓰레드 @kimjejo_pharma', on:true },
    { k:'instagram_global', label:'인스타 댓글 @jejo.kpharmacist', on:true },
    { k:'instagram_global_dm', label:'인스타 DM @jejo.kpharmacist', on:true, warn:'DM은 상대가 마지막 메시지를 보낸 뒤 24시간 안에만 답장할 수 있습니다(인스타 규칙).' },
    { k:'xiaohongshu', label:'샤오홍수', on:true, warn:'AI 컴퓨터 전용 크롬이 2시간마다(08:20~22:20) 댓글을 모으고 보내기 누른 답장을 올립니다. 로그인은 20분마다 유지·점검하고, 풀리면 웍스 카드로 알려 드립니다. 김제조 계정은 다른 곳에서 샤오홍슈 웹 로그인 금지(웹 로그인은 한 곳만 유지). 답장은 중국어 기본.' },
    { k:'douyin', label:'더우인', on:true, warn:'하루 1회 AI 컴퓨터가 더우인 창작자센터에서 댓글을 모으고, 보내기 누른 답장을 올립니다. 답장은 중국어 기본.' }
  ];
  const ST = { todo:['new','drafted'], sending:['sending'], replied:['replied'], skip:['skip','hidden'], all:null };
  const STL = { todo:'답장 필요', sending:'보내는 중', replied:'답장 완료', skip:'건너뜀', all:'전체' };
  const accOf = c => c.kind === 'dm' ? c.platform + '_dm' : c.platform;
  const inAcc = c => opsCmAcc === 'all' || accOf(c) === opsCmAcc;
  const list = cm.filter(inAcc).filter(c => !ST[opsCmSt] || ST[opsCmSt].includes(c.status));
  const cnt = (k, st) => cm.filter(c => (k === 'all' || accOf(c) === k) && (!ST[st] || ST[st].includes(c.status))).length;
  const curAcc = ACC.find(a => a.k === opsCmAcc) || ACC[0];
  body.innerHTML = `<p class="lede">계정별 댓글·DM을 5분마다 모으고 AI가 추천 답장을 붙입니다. <b>이대로 보내기</b>를 누르거나, 아래 칸에 직접 써서 <b>확인</b>을 누르면 그 댓글에 답글이 달립니다(1분 안에 AI 컴퓨터가 보냄).</p>
    <div class="toolbar" style="padding:0 0 8px">${ACC.map(a => `<button class="chip ${opsCmAcc === a.k ? 'on' : ''}" data-cmacc="${a.k}">${esc(a.label)} <b>${a.k === 'all' || a.on ? cnt(a.k, 'todo') : '-'}</b></button>`).join('')}</div>
    ${curAcc.warn ? `<div class="rv-warn" style="margin:0 0 10px">⚠ ${esc(curAcc.warn)}</div>` : ''}${opsCmAcc === 'xiaohongshu' ? '<div style="margin:0 0 12px"><button class="btn primary" id="cm-xhs-login2" style="font-size:15px;padding:10px 18px">🔑 샤오홍슈 로그인 (QR 만들기)</button> <span class="rv-sub">새 창에서 QR 만들기 → 1~2분 뒤 QR → 앱 ≡ 扫一扫</span></div>' : ''}
    ${CHINA_CHANNELS[opsCmAcc] ? chinaChannelPanel(opsCmAcc) : ''}
    <div class="toolbar" style="padding:0 0 12px">${Object.keys(STL).map(s => `<button class="chip ${opsCmSt === s ? 'on' : ''}" data-cmst="${s}">${STL[s]} ${cnt(opsCmAcc, s)}</button>`).join('')}
      <div class="sep"></div><button class="chip" id="cm-draft">🤖 추천 답장 더 만들기</button><button class="chip" id="cm-reload">↻ 새로고침</button>${opsCmAcc === 'xiaohongshu' ? '<button class="chip" id="cm-xhs-login">🔑 샤오홍슈 로그인(QR)</button>' : ''}</div>
    <div id="cm-list">${list.length ? list.slice(0, 120).map(c => `<div class="cm-card" data-cm="${esc(c.id)}">
      <div class="rv-sub">${esc(PF_KO[c.platform] || c.platform)}${c.kind === 'dm' ? ' DM' : ''} · ${c.post_url ? `<a href="${esc(c.post_url)}" target="_blank" rel="noopener">${esc(c.post_title || '게시물')}</a>` : esc(c.post_title || '')} · ${esc(fmtKst(c.created_at))}</div>
      <div class="cm-q"><b>${esc(c.author || '')}</b> ${esc(c.text || '')}</div>
      ${c.status === 'replied' ? `<div class="cm-done">✓ 답장 완료${c.replied_text ? ': ' + esc(c.replied_text) : ''}</div>`
      : c.status === 'sending' ? `<div class="cm-done" style="color:#E67700">⏳ 보내는 중: ${esc(c.replied_text || '')} <button class="linkbtn" data-cmundo="${esc(c.id)}">취소</button></div>`
      : c.status === 'skip' ? `<div class="rv-sub">건너뜀 <button class="linkbtn" data-cmundo="${esc(c.id)}">되돌리기</button></div>`
      : `${c.send_error ? `<div class="rv-warn">⚠ ${esc(c.send_error)}</div>` : ''}
        <div class="cm-rec"><span class="cm-tag">추천 답장</span> ${c.reply_draft ? esc(c.reply_draft) : '<span class="rv-sub">아직 없음 — 🤖 추천 답장 더 만들기</span>'}</div>
        <div class="cm-lang" style="display:flex;gap:4px;align-items:center;margin:4px 0;font-size:12px"><span class="rv-sub">답장 언어</span>${[['','자동'],['ko','한국어'],['en','English'],['zh','中文'],['ja','日本語']].map(([l,n]) => `<button class="chip ${(c.reply_lang || '') === l ? 'on' : ''}" style="padding:2px 8px;font-size:12px" data-cmlang="${esc(c.id)}" data-l="${l}" title="${l ? n + '로 다시 쓰기' : '채널 기본 언어(' + ({instagram:'한국어',youtube:'한국어',threads:'한국어',instagram_global:'English',douyin:'中文',xiaohongshu:'中文'}[c.platform] || '한국어') + ')로 다시 쓰기'}">${n}</button>`).join('')}</div>
        <div class="cm-act">${c.reply_draft && !/답장 안 함/.test(c.reply_draft) ? `<button class="btn sm" data-cmsend="${esc(c.id)}">이대로 보내기</button>` : ''}<button class="btn sm ghost" data-cmskip="${esc(c.id)}">건너뛰기</button></div>
        <div class="cm-my"><textarea rows="2" placeholder="추천 답장이 마음에 안 들면 여기에 직접 쓰고 확인" data-cmtxt="${esc(c.id)}"></textarea><button class="btn sm" data-cmmy="${esc(c.id)}">확인</button></div>`}
    </div>`).join('') : '<p class="lede">해당하는 댓글이 없습니다.</p>'}</div>`;
  const call = async (b) => { const { data, error } = await sb.functions.invoke('ops-reply', { body: b }); if (error || data?.error) { uiAlert((data && data.error) || error?.message || '실패'); return null; } return data; };
  const set = (id, patch) => { const c = opsData.comments.find(x => x.id === id); if (c) Object.assign(c, patch); renderOpsComments(body); };
  body.querySelectorAll('[data-cmacc]').forEach(b => b.onclick = () => { opsCmAcc = b.dataset.cmacc; renderOpsComments(body); });
  body.querySelectorAll('[data-cmst]').forEach(b => b.onclick = () => { opsCmSt = b.dataset.cmst; renderOpsComments(body); });
  body.querySelectorAll('[data-cmsend]').forEach(b => b.onclick = async () => {
    const c = opsData.comments.find(x => x.id === b.dataset.cmsend); if (!c) return;
    b.disabled = true; if (await call({ action:'send', id:c.id, text:c.reply_draft })) set(c.id, { status:'sending', replied_text:c.reply_draft, send_error:null }); else b.disabled = false;
  });
  body.querySelectorAll('[data-cmmy]').forEach(b => b.onclick = async () => {
    const id = b.dataset.cmmy; const t = body.querySelector(`[data-cmtxt="${CSS.escape(id)}"]`).value.trim();
    if (!t) return uiAlert('답장 내용을 적어 주세요.');
    b.disabled = true; if (await call({ action:'send', id, text:t })) set(id, { status:'sending', replied_text:t, send_error:null }); else b.disabled = false;
  });
  body.querySelectorAll('[data-cmlang]').forEach(b => b.onclick = async () => { const id = b.dataset.cmlang; b.textContent = '…'; b.disabled = true; if (await call({ action:'draft', ids:[id], lang:b.dataset.l })) { await loadOps(); } renderOpsComments(body); });
  body.querySelectorAll('[data-cmskip]').forEach(b => b.onclick = async () => { if (await call({ action:'skip', id:b.dataset.cmskip })) set(b.dataset.cmskip, { status:'skip' }); });
  body.querySelectorAll('[data-cmundo]').forEach(b => b.onclick = async () => { if (await call({ action:'undo', id:b.dataset.cmundo })) set(b.dataset.cmundo, { status:'drafted' }); });
  $('#cm-draft').onclick = async e => { e.target.disabled = true; e.target.textContent = '🤖 만드는 중…'; const d = await call({ action:'draft' }); await loadOps(); renderOpsComments(body); if (d) uiAlert(`추천 답장 ${d.drafted || 0}개를 만들었습니다.`); };
  $('#cm-reload').onclick = async () => { await loadOps(); renderOpsComments(body); };
  if ($('#cm-xhs-login2') && $('#cm-xhs-login')) $('#cm-xhs-login2').onclick = () => $('#cm-xhs-login').click();
  if ($('#cm-xhs-login')) $('#cm-xhs-login').onclick = async () => { const w = window.open('about:blank', '_blank'); const { data } = await sb.from('app_settings').select('value').eq('key', 'xhs_login_url').maybeSingle(); if (data && data.value) { if (w) w.location = data.value; else location.href = data.value; } else { if (w) w.close(); uiAlert('로그인 링크 설정이 없습니다(관리자만 사용 가능).'); } };
}

const UP_TABS = () => `<div class="ops-tabs" style="margin-top:0"><button class="${opsUp === 'threads' ? 'on' : ''}" data-upkind="threads">🧵 쓰레드 @kimjejo_pharma</button><button class="${opsUp === 'carousel' ? 'on' : ''}" data-upkind="carousel">🖼 캐러셀 @kimjejo_pharma</button></div>`;
const upTabBind = body => body.querySelectorAll('[data-upkind]').forEach(b => b.onclick = () => { opsUp = b.dataset.upkind; try { localStorage.setItem('kj_opsup', opsUp); } catch (e) {} renderOpsUpload(body); });
async function renderOpsUpload(body){
  if (opsUp === 'carousel') return renderOpsUpCarousel(body);
  return renderOpsUpThreads(body);
}
async function renderOpsUpThreads(body){
  const { data } = await sb.from('ops_threads').select('*').order('created_at', { ascending:false }).limit(200);
  const all = data || [];
  const G = { draft:'승인 대기', approved:'예약됨', posting:'올리는 중', posted:'올라감', failed:'실패', rejected:'반려' };
  const st = opsUpSt;
  const list = all.filter(t => st === 'draft' ? t.status === 'draft' : st === 'approved' ? ['approved','posting'].includes(t.status) : t.status === st);
  const next = (() => { const d = new Date(Date.now() + 9 * 36e5); const h = d.getUTCHours(); if (h >= 12) d.setUTCDate(d.getUTCDate() + 1); d.setUTCHours(12, 30, 0, 0); return d.toISOString().slice(0, 16); })();
  const kstLocal = iso => iso ? new Date(new Date(iso).getTime() + 9 * 36e5).toISOString().slice(0, 16) : next;
  body.innerHTML = UP_TABS() + `
    <p class="lede">매일 아침 AI가 지금까지 콘텐츠 중 <b>조회수가 높고 결이 맞는 것</b>(영양제·화장품·성분 꿀팁)을 골라(일부만 뽑거나 섞거나 새로 써서) 쓰레드 글 초안 3개를 만듭니다. 대표가 <b>고친 글·승인한 글·반려한 글(이유)</b>을 보고 다음 초안의 말투와 주제를 맞춰 갑니다. 고쳐서 <b>승인</b>하면 정한 시각에 AI 컴퓨터가 올립니다. 승인 안 한 글은 올라가지 않습니다. 올릴 시각을 <b>비워 두면</b> 이미 예약된 글 다음으로 자동으로 잡힙니다 — 하루 한 개씩, 대기가 20일치를 넘으면 하루 두 개(아침·저녁)로 늘어납니다.</p>
    ${opsThreadsReady ? '' : '<div class="rv-warn" style="margin:0 0 10px">⚠ 쓰레드 계정 연결 전입니다. 승인해 두면 연결되는 대로 예약 시각 순서로 올라갑니다.</div>'}
    <div class="toolbar" style="padding:0 0 12px">${Object.keys(G).filter(k => k !== 'posting').map(k => `<button class="chip ${st === k ? 'on' : ''}" data-upst="${k}">${G[k]} ${all.filter(t => k === 'approved' ? ['approved','posting'].includes(t.status) : t.status === k).length}</button>`).join('')}
      <div class="sep"></div><button class="chip" id="up-gen">🤖 초안 더 만들기</button><button class="chip" id="up-restyle">🧵 말투 다시 쓰기</button></div>
    <div>${list.length ? list.map(t => `<div class="cm-card">
      <div class="rv-sub">원본: <b>${esc(t.source_title || '-')}</b>${t.source_views ? ' · 조회 ' + opsN(t.source_views) : ''}${t.why ? ' · ' + esc(t.why) : ''}${t.reject_reason ? ' · <b>반려 이유:</b> ' + esc(t.reject_reason) : ''}</div>
      ${['posted','posting'].includes(t.status) ? `<div class="cm-q" style="white-space:pre-wrap">${esc(t.text)}</div><div class="cm-done">${t.status === 'posted' ? '✓ ' + esc(fmtKst(t.posted_at)) + ' 올라감' + (t.views != null ? ` · 조회 ${opsN(t.views)} · 좋아요 ${opsN(t.likes)} · 답글 ${opsN(t.replies_n)}` : '') + (t.permalink ? ` · <a href="${esc(t.permalink)}" target="_blank" rel="noopener">쓰레드에서 보기</a>` : '') : '⏳ 올리는 중'}</div>`
      : `<textarea class="up-txt" data-uptxt="${t.id}" rows="8" style="width:100%;border:1px solid var(--line);border-radius:8px;padding:10px;font:inherit;font-size:14px;line-height:1.6;margin:6px 0">${esc(t.text)}</textarea>
        <div class="rv-sub" data-upcnt="${t.id}">${(t.text || '').length}/500자</div>
        ${t.error ? `<div class="rv-warn">⚠ ${esc(t.error)}</div>` : ''}
        <div class="cm-act" style="align-items:center;flex-wrap:wrap">
          <label class="rv-sub">올릴 시각 <input type="datetime-local" data-upat="${t.id}" value="${t.scheduled_at ? kstLocal(t.scheduled_at) : ''}" style="border:1px solid var(--line);border-radius:6px;padding:4px"> <span class="rv-sub">비워 두면 자동</span></label>
          ${t.status === 'rejected' ? `<button class="btn sm ghost" data-upundo="${t.id}">되살리기</button>`
          : `<button class="btn sm" data-upok="${t.id}">${t.status === 'approved' ? '수정 저장' : '승인·예약'}</button>
             <button class="btn sm ghost" data-upsave="${t.id}">글만 저장</button>
             ${t.status === 'approved' ? `<button class="btn sm ghost" data-upundo="${t.id}">승인 취소</button>` : `<button class="btn sm danger" data-upno="${t.id}">반려</button>`}`}
        </div>`}
    </div>`).join('') : `<p class="lede">${G[st]} 글이 없습니다.</p>`}</div>`;
  upTabBind(body);
  const call = async (b) => { const { data, error } = await sb.functions.invoke('ops-threads', { body: b }); if (error || data?.error) { uiAlert((data && data.error) || error?.message || '실패'); return null; } return data; };
  const txt = id => body.querySelector(`[data-uptxt="${id}"]`).value;
  const at = id => { const v = body.querySelector(`[data-upat="${id}"]`)?.value; return v ? new Date(v + ':00+09:00').toISOString() : null; };
  body.querySelectorAll('[data-upst]').forEach(b => b.onclick = () => { opsUpSt = b.dataset.upst; renderOpsUpload(body); });
  body.querySelectorAll('.up-txt').forEach(t => t.oninput = () => { body.querySelector(`[data-upcnt="${t.dataset.uptxt}"]`).textContent = t.value.length + '/500자'; });
  body.querySelectorAll('[data-upok]').forEach(b => b.onclick = async () => { b.disabled = true; if (await call({ action:'approve', id:b.dataset.upok, text:txt(b.dataset.upok), scheduled_at:at(b.dataset.upok) })) renderOpsUpload(body); else b.disabled = false; });
  body.querySelectorAll('[data-upsave]').forEach(b => b.onclick = async () => { if (await call({ action:'save', id:b.dataset.upsave, text:txt(b.dataset.upsave) })) { b.textContent = '저장됨'; setTimeout(() => b.textContent = '글만 저장', 1500); } });
  body.querySelectorAll('[data-upno]').forEach(b => b.onclick = async () => { const why = await uiPrompt('반려 이유를 짧게 적어 주세요(선택) — AI가 다음 초안부터 반영합니다.\n예) 너무 광고 같음 / 말투 과함 / 주제 겹침', ''); if (why === null) return; if (await call({ action:'reject', id:b.dataset.upno, reason:why })) renderOpsUpload(body); });
  body.querySelectorAll('[data-upundo]').forEach(b => b.onclick = async () => { if (await call({ action:'undo', id:b.dataset.upundo })) renderOpsUpload(body); });
  $('#up-gen').onclick = async e => { e.target.disabled = true; e.target.textContent = '🤖 만드는 중…(20초쯤)'; const d = await call({ action:'generate', n:3 }); opsUpSt = 'draft'; renderOpsUpload(body); if (d) uiAlert(`초안 ${d.made || 0}개를 만들었습니다.`); };
  $('#up-restyle').onclick = async e => { if (!await uiConfirm('아직 안 올라간 글(승인 대기·예약됨·실패)을 지금 말투 기준으로 다시 씁니다. 올라간 글은 그대로 둡니다. 진행할까요?')) return; e.target.disabled = true; e.target.textContent = '🧵 다시 쓰는 중…(30초쯤)'; const d = await call({ action:'restyle' }); renderOpsUpload(body); if (d) uiAlert(`${d.changed || 0}개를 다시 썼습니다.`); };
}

// v69 🖼 캐러셀 — AI가 문구·캡션 초안 → 대표 승인 → 장표 이미지 올리면 수요일마다 자동 게시
const CAR_G = { draft:'문구 승인 대기', design:'장표 시안', ready:'디자인 대기', approved:'예약됨', posted:'올라감', failed:'실패', rejected:'반려' };
/* v75 캐러셀 형식 라이브러리 — 릴스에서 성과가 검증된 틀을 캐러셀에도. 서버(ops-threads CAR_FMT)와 키가 같아야 한다. */
const CAR_FMT_UI = [
  { k:'', label:'AI가 고름', d:'지난 캐러셀과 다른 형식을 AI가 알아서 고릅니다' },
  { k:'base', label:'기준형', d:'고민 → 고르는 기준을 한 장에 하나씩 → 정리' },
  { k:'vs', label:'판정형', d:'두 가지를 맞세우고 한쪽을 고릅니다 (제품명 대신 성분 형태·습관으로)' },
  { k:'tier', label:'티어형', d:'S·A·B 등급으로 나눠 등급마다 이유 한 줄' },
  { k:'rank', label:'TOP5형', d:'N가지를 한 장에 하나씩, 끝에서 두 번째가 1위' },
  { k:'check', label:'체크리스트형', d:'"몇 개나 해당되세요?" → 항목 하나씩 → 개수별 조언' },
  { k:'myth', label:'오해 바로잡기', d:'흔한 생각 → 사실은 → 진짜 기준' },
  { k:'behind', label:'공장 비하인드', d:'원료 입고·검사·함량 설계·포장 → 그래서 이걸 보세요' },
];
const CAR_FMT_L = Object.fromEntries(CAR_FMT_UI.filter(f => f.k).map(f => [f.k, f.label]));
const CAR_FMT_D = Object.fromEntries(CAR_FMT_UI.map(f => [f.k, f.d]));
let carFmt = '';
function carCard(c, kstLocal){
  const sl = Array.isArray(c.slides) ? c.slides : [];
  const im = Array.isArray(c.images) ? c.images : [];
  const done = ['posted', 'posting'].includes(c.status);
  return `<div class="cm-card" data-carid="${c.id}">
    <div class="rv-sub">원본: <b>${esc(c.source_title || '-')}</b>${c.source_views ? ' · 조회 ' + opsN(c.source_views) : ''}${c.format && CAR_FMT_L[c.format] ? ' · 형식: <b>' + esc(CAR_FMT_L[c.format]) + '</b>' : ''}${c.scheduled_at && !done ? ' · 올릴 때: ' + esc(fmtKst(c.scheduled_at)) : ''}${c.reject_reason ? ' · <b>반려 이유:</b> ' + esc(c.reject_reason) : ''}</div>
    <div style="font-weight:800;margin:4px 0;font-size:15px">${esc(c.topic || '(제목 없음)')}</div>
    ${c.design_note ? `<div class="an-angle">🎨 ${esc(c.design_note)}</div>` : ''}
    ${done ? '' : `<label class="rv-sub" style="display:block;margin-top:6px">장표 만들 때 지시 <span class="rv-sub">— 위 AI 디자인 메모를 고쳐 쓰셔도 됩니다 (사진 종류·강조할 단어·포인트 색)</span></label>
    <textarea data-carbrief rows="3" style="width:100%;border:1px solid var(--line);border-radius:8px;padding:8px;font:inherit;font-size:13.5px;line-height:1.6;margin:2px 0 4px">${esc(c.design_brief || c.design_note || '')}</textarea>`}
    ${done ? `<div class="cm-done">${c.status === 'posted' ? '✓ ' + esc(fmtKst(c.posted_at)) + ' 올라감' + (c.permalink ? ` · <a href="${esc(c.permalink)}" target="_blank" rel="noopener">인스타에서 보기</a>` : '') : '⏳ 올리는 중'}</div>` : ''}
    ${done ? '' : `<div class="rv-sub" style="margin:8px 0 2px">장표 <b>${im.filter(x => x).length}/${sl.length}</b>장 올라옴 ·
      <label class="btn sm ghost" style="padding:2px 8px;cursor:pointer">\uD83D\uDCCE 한 번에 올리기<input type="file" accept="image/*" multiple data-carall style="display:none"></label>
      <b data-carallst></b> <span class="rv-sub">파일 이름 순서대로 1장부터 채웁니다 (01, 02, 03 …)</span></div>`}
    <div class="car-slides">${sl.map((s, i) => `<div class="car-sl">
      <div class="rv-sub">${i === 0 ? '표지' : i === sl.length - 1 ? '마지막 장' : (i + 1) + '장'}</div>
      <input data-carh="${i}" value="${esc(s.headline || '')}" ${done ? 'disabled' : ''} placeholder="큰 글씨">
      <textarea data-carb="${i}" rows="3" ${done ? 'disabled' : ''} placeholder="작은 글씨">${esc(s.body || '')}</textarea>
      <div class="car-im">${im[i] ? `<img src="${esc(im[i])}" alt="">` : '<span class="rv-sub">장표 없음</span>'}${done ? '' : `<input type="file" accept="image/*" data-carf="${i}">`}</div>
    </div>`).join('')}</div>
    <label class="rv-sub">캡션</label>
    <textarea data-carcap rows="7" ${done ? 'disabled' : ''} style="width:100%;border:1px solid var(--line);border-radius:8px;padding:10px;font:inherit;font-size:14px;line-height:1.6;margin:4px 0">${esc(c.caption || '')}</textarea>
    ${c.error ? `<div class="rv-warn">⚠ ${esc(c.error)}</div>` : ''}
    ${done ? '' : `<div class="cm-act" style="align-items:center;flex-wrap:wrap">
      <label class="rv-sub">올릴 시각 <input type="datetime-local" data-carat value="${kstLocal(c.scheduled_at)}" style="border:1px solid var(--line);border-radius:6px;padding:4px"> <span class="rv-sub">비워 두면 다음 수요일</span></label>
      ${c.status === 'rejected' ? '<button class="btn sm ghost" data-carundo>되살리기</button>'
        : c.status === 'draft' ? `<button class="btn sm" data-carmake>🎨 장표 시안 요청</button>
           <button class="btn sm ghost" data-carsave>문구만 저장</button>
           <button class="btn sm danger" data-carno>반려</button>`
        : `<button class="btn sm" data-carok>${c.status === 'design' ? '시안 승인·예약' : '수정 저장·예약'}</button>
           <button class="chip" data-carmake>🔁 시안 다시 요청</button>
           <button class="btn sm ghost" data-carsave>문구만 저장</button>
           <button class="btn sm ghost" data-carundo>${c.status === 'design' ? '문구 단계로' : '승인 취소'}</button>`}
    </div>`}
  </div>`;
}
async function renderOpsUpCarousel(body){
  const { data } = await sb.from('ops_carousels').select('*').order('created_at', { ascending:false }).limit(120);
  const all = data || [];
  const st = opsCarSt;
  const list = all.filter(c => st === 'approved' ? ['approved', 'posting'].includes(c.status) : c.status === st);
  const kstLocal = iso => iso ? new Date(new Date(iso).getTime() + 9 * 36e5).toISOString().slice(0, 16) : '';
  body.innerHTML = UP_TABS() + `
    <p class="lede">메인 인스타(@kimjejo_pharma) <b>캐러셀</b>입니다. AI가 지금까지 콘텐츠에서 소재를 골라 <b>표지부터 마지막 장까지 문구와 캡션</b>을 짭니다.
      순서는 <b>① 문구 확인 → 🎨 장표 시안 요청 → ② 그림 보고 승인 → ③ 예약 게시</b> 입니다. 문구만 보고 승인하지 않고, <b>장표 그림을 본 뒤에 승인</b>합니다.
      승인하면 <b>다음 수요일</b>부터 한 주에 하나씩 자리가 잡힙니다(시각은 바꿀 수 있습니다). 🎨 메모는 'AI가 찍어낸 느낌'을 피하려고 AI가 적어 둔 디자인 지침입니다.</p>
    <div class="toolbar" style="padding:0 0 12px">${Object.keys(CAR_G).map(k => `<button class="chip ${st === k ? 'on' : ''}" data-carst="${k}">${CAR_G[k]} ${all.filter(c => k === 'approved' ? ['approved', 'posting'].includes(c.status) : c.status === k).length}</button>`).join('')}
      <div class="sep"></div><button class="chip" id="car-gen">🤖 캐러셀 초안 만들기</button></div>
    <div class="toolbar" style="padding:0 0 10px"><span class="rv-sub" style="align-self:center;margin-right:2px">형식</span>${CAR_FMT_UI.map(f => `<button class="chip ${carFmt === f.k ? 'on' : ''}" data-carfmt="${f.k}">${f.label}</button>`).join('')}</div>
    <p class="rv-sub" style="margin:-4px 0 12px">${esc(CAR_FMT_D[carFmt] || '')}</p>
    <div>${list.length ? list.map(c => carCard(c, kstLocal)).join('') : `<p class="lede">${CAR_G[st]} 캐러셀이 없습니다.</p>`}</div>`;
  upTabBind(body);
  const call = async (b) => { const { data, error } = await sb.functions.invoke('ops-threads', { body: b }); if (error || data?.error) { uiAlert((data && data.error) || error?.message || '실패'); return null; } return data; };
  const re = () => renderOpsUpCarousel(body);
  body.querySelectorAll('[data-carst]').forEach(b => b.onclick = () => { opsCarSt = b.dataset.carst; re(); });
  body.querySelectorAll('[data-carfmt]').forEach(b => b.onclick = () => { carFmt = b.dataset.carfmt; re(); });
  body.querySelector('#car-gen').onclick = async e => { e.target.disabled = true; e.target.textContent = '🤖 만드는 중…(40초쯤)'; const d = await call({ action:'car_generate', n:2, fmt: carFmt }); opsCarSt = 'draft'; re(); if (d) uiAlert(`캐러셀 초안 ${d.made || 0}개를 만들었습니다.`); };
  body.querySelectorAll('[data-carid]').forEach(card => {
    const id = card.dataset.carid;
    const slides = () => [...card.querySelectorAll('[data-carh]')].map((h, i) => ({ headline: h.value, body: card.querySelector(`[data-carb="${i}"]`).value }));
    const cap = () => card.querySelector('[data-carcap]').value;
    const at = () => { const v = card.querySelector('[data-carat]') ? card.querySelector('[data-carat]').value : ''; return v ? new Date(v + ':00+09:00').toISOString() : null; };
    const sv = card.querySelector('[data-carsave]');
    if (sv) sv.onclick = async () => { if (await call({ action:'car_save', id, slides: slides(), caption: cap() })) { sv.textContent = '저장됨'; setTimeout(() => sv.textContent = '문구만 저장', 1500); } };
    const ok = card.querySelector('[data-carok]');
    if (ok) ok.onclick = async () => { ok.disabled = true; await call({ action:'car_save', id, slides: slides(), caption: cap() });
      const d = await call({ action:'car_approve', id, scheduled_at: at() });
      if (!d) { ok.disabled = false; return; }
      re(); uiAlert(d.status === 'approved' ? '예약했습니다 — ' + fmtKst(d.scheduled_at) : `문구를 확정했습니다 (${fmtKst(d.scheduled_at)} 예정).\n장표 이미지 ${d.need}장을 올리면 그때부터 자동 게시 대상이 됩니다.`); };
    const no = card.querySelector('[data-carno]');
    if (no) no.onclick = async () => { const why = await uiPrompt('반려 이유를 짧게 적어 주세요(선택) — AI가 다음 초안부터 반영합니다.', ''); if (why === null) return; if (await call({ action:'car_reject', id, reason: why })) re(); };
    const un = card.querySelector('[data-carundo]');
    if (un) un.onclick = async () => { if (await call({ action:'car_undo', id })) re(); };
    const mk = card.querySelector('[data-carmake]');
    if (mk) mk.onclick = async () => { mk.disabled = true;
      const bf = card.querySelector('[data-carbrief]');
      const d = await call({ action:'car_brief', id, slides: slides(), caption: cap(), brief: bf ? bf.value : '' });
      if (d) { opsCarSt = 'design'; re(); poToast('장표 시안을 요청했습니다. 「장표 시안」 탭에서 그림이 올라오면 보고 승인하시면 됩니다.', 6000); } else mk.disabled = false; };
    card.querySelectorAll('[data-carf]').forEach(f => f.onchange = async () => {
      const file = f.files && f.files[0]; if (!file) return;
      if (file.size > 4000000) return uiAlert('이미지가 너무 큽니다. 4MB 이하로 줄여 주세요.');
      const data64 = await new Promise(res => { const rd = new FileReader(); rd.onload = () => res(rd.result); rd.readAsDataURL(file); });
      f.disabled = true;
      const d = await call({ action:'car_img', id, i: +f.dataset.carf, data: data64 });
      if (d) re(); else f.disabled = false;
    });
    const allf = card.querySelector('[data-carall]');
    if (allf) allf.onchange = async () => {
      const fs = [...(allf.files || [])].sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
      if (!fs.length) return;
      const slots = card.querySelectorAll('[data-carh]').length;
      if (fs.length > slots && !await uiConfirm('장표 칸은 ' + slots + '개인데 ' + fs.length + '장을 고르셨습니다. 앞에서 ' + slots + '장만 올립니다. 계속할까요?')) return;
      const st = card.querySelector('[data-carallst]'); const n = Math.min(fs.length, slots);
      allf.disabled = true;
      for (let i = 0; i < n; i++) {
        const file = fs[i];
        if (file.size > 4000000) { uiAlert(file.name + ' 이(가) 4MB를 넘어 건너뜁니다.'); continue; }
        if (st) st.textContent = '올리는 중… ' + (i + 1) + '/' + n;
        const data64 = await new Promise(res => { const rd = new FileReader(); rd.onload = () => res(rd.result); rd.readAsDataURL(file); });
        const d = await call({ action:'car_img', id, i, data: data64 });
        if (!d) { if (st) st.textContent = '실패'; allf.disabled = false; return; }
      }
      const filled = card.querySelectorAll('[data-carh]').length;
      if (n >= filled) {
        if (st) st.textContent = '장표 다 찼습니다 — 예약 거는 중…';
        const d = await call({ action:'car_approve', id, scheduled_at: at() });
        if (d) { re(); poToast(d.status === 'approved' ? '장표 ' + n + '장을 올리고 ' + fmtKst(d.scheduled_at) + ' 예약까지 걸었습니다.' : '장표를 올렸습니다. (' + d.images + '/' + d.need + ')', 5000); return; }
      }
      if (st) st.textContent = '완료';
      re();
    };
  });
}

// v48 🎬 AI 영상편집 — 요청 → 대표 승인 → AI 컴퓨터(Codex) 작업 → 검수(승인/재작업). 실제 편집은 Codex, 발행은 하지 않음.
let opsVdSt = 'todo', opsVdNew = null;
const VD_KIND = { en:'🇺🇸 영어판', zh:'🇨🇳 중국어판', new:'✨ 신규 AI 영상' };
const VD_ST = { requested:'대표 승인 대기', approved:'AI 컴퓨터로 보내는 중', queued:'AI 컴퓨터 대기열', working:'편집 중', review:'검수 대기', redo:'재작업 요청됨', done:'완료', rejected:'반려', cancelled:'취소', failed:'실패' };
const VD_GROUP = { todo:['requested','review'], run:['approved','queued','working','redo'], done:['done'], off:['rejected','cancelled','failed'], all:null };
const VD_GL = { todo:'내 차례(승인·검수)', run:'진행 중', done:'완료', off:'반려·취소·실패', all:'전체' };
async function renderOpsVideo(body){
  const [{ data: jobs }, { data: files }] = await Promise.all([
    sb.from('ops_video_jobs').select('*').order('created_at', { ascending:false }).limit(300),
    sb.from('review_files').select('id, path, filename, file_date, mtime, title_guess, content_id').order('mtime', { ascending:false }).limit(400)
  ]);
  const all = jobs || [], fl = files || [];
  const isMaster = profile?.role === 'master';
  const mon = new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 7);
  const spent = all.filter(j => j.cost_krw && new Date(new Date(j.updated_at).getTime() + 9 * 36e5).toISOString().slice(0, 7) === mon).reduce((s, j) => s + j.cost_krw, 0);
  const cardTitle = id => (cards.find(c => c.id === id) || {}).title || '';
  const inG = (j, g) => !VD_GROUP[g] || VD_GROUP[g].includes(j.status);
  const list = all.filter(j => inG(j, opsVdSt));
  const bar = Math.min(100, Math.round(spent / 5000));
  body.innerHTML = `<p class="lede">기존 영상의 <b>영어판·중국어판</b>이나 <b>신규 AI 영상</b>을 요청하면, 대표 승인 뒤 AI 컴퓨터(Codex)가 편집해 NAS <b>T:\\01.자동편집</b>에 올리고 여기서 검수합니다. 발행은 하지 않습니다.</p>
    <div class="rv-warn" style="margin:0 0 10px">🧪 시험 단계 — 요청·승인은 여기에 쌓이지만 AI 컴퓨터로 보내지 않습니다(자동편집 꺼짐). 대표가 켜면 승인된 순서대로 시작합니다.</div>
    <div class="vd-budget"><span>이번 달 AI 편집 비용 <b>${opsN(spent)}원</b> / 500,000원</span><div class="vd-bar"><i style="width:${bar}%;background:${bar >= 80 ? '#E03131' : '#E67700'}"></i></div></div>
    <div class="toolbar" style="padding:8px 0 12px">${Object.keys(VD_GL).map(g => `<button class="chip ${opsVdSt === g ? 'on' : ''}" data-vdst="${g}">${VD_GL[g]} ${all.filter(j => inG(j, g)).length}</button>`).join('')}
      <div class="sep"></div><button class="btn sm" id="vd-newbtn">＋ 새 편집 요청</button></div>
    <div id="vd-new"></div>
    <div>${list.length ? list.map(j => {
      const src = j.kind === 'new' ? ('카드: ' + (cardTitle(j.content_id) || '-')) : (j.source_name || '-') + (cardTitle(j.content_id) ? ' · ' + cardTitle(j.content_id) : '');
      const st = `<span class="vd-st vd-${j.status}">${VD_ST[j.status] || j.status}</span>`;
      let act = '';
      if (j.status === 'requested') act = (isMaster ? `<button class="btn sm" data-vdok="${j.id}">승인(편집 시작)</button><button class="btn sm ghost" data-vdno="${j.id}">반려</button>` : '<span class="rv-sub">대표 승인을 기다립니다(유료 작업).</span>') + `<button class="btn sm ghost" data-vdcancel="${j.id}">요청 취소</button>`;
      else if (j.status === 'approved') act = `<span class="rv-sub">승인됨 — 자동편집을 켜면 AI 컴퓨터로 넘어갑니다.</span><button class="btn sm ghost" data-vdcancel="${j.id}">취소</button>`;
      else if (['queued', 'working', 'redo'].includes(j.status)) act = `<span class="rv-sub">${j.status === 'working' ? 'AI 컴퓨터가 편집하고 있습니다.' : 'AI 컴퓨터가 차례대로 처리합니다.'}</span>`;
      else if (j.status === 'review') act = `<button class="btn sm" data-vddone="${j.id}">검수 승인(완료)</button><textarea rows="2" data-vdwhy="${j.id}" placeholder="재작업이 필요하면 고칠 점을 적고 '재작업'" style="flex:1;min-width:220px;border:1px solid var(--line);border-radius:8px;padding:6px 8px;font:inherit;font-size:13px"></textarea><button class="btn sm ghost" data-vdredo="${j.id}">재작업</button>`;
      return `<div class="cm-card">
        <div class="rv-sub">${VD_KIND[j.kind] || j.kind} · ${esc(fmtKst(j.created_at))} ${st}${j.cost_krw ? ` · 비용 ${opsN(j.cost_krw)}원` : ''}</div>
        <div class="cm-q"><b>${esc(src)}</b>${j.note ? `<div class="rv-sub" style="white-space:pre-wrap">요청: ${esc(j.note)}</div>` : ''}</div>
        ${j.redo_reason && ['redo', 'queued', 'working', 'review'].includes(j.status) ? `<div class="rv-sub">재작업 사유: ${esc(j.redo_reason)}</div>` : ''}
        ${j.result_path ? `<div class="vd-res">📁 결과 <code>${esc(j.result_path)}</code> <button class="linkbtn" data-vdcopy="${esc(j.result_path)}">경로 복사</button>${j.result_preview ? `<div class="rv-sub">미리보기: <code>${esc(j.result_preview)}</code></div>` : ''}</div>` : ''}
        ${j.codex_note ? `<div class="rv-sub" style="white-space:pre-wrap">AI 메모: ${esc(j.codex_note)}</div>` : ''}
        ${j.error ? `<div class="rv-warn">⚠ ${esc(j.error)}</div>` : ''}
        ${j.reject_reason ? `<div class="rv-sub">반려 사유: ${esc(j.reject_reason)}</div>` : ''}
        ${act ? `<div class="cm-act" style="align-items:center;flex-wrap:wrap">${act}</div>` : ''}
      </div>`; }).join('') : `<p class="lede">${VD_GL[opsVdSt]} 항목이 없습니다.</p>`}</div>`;
  const call = async (b) => { const { data, error } = await sb.functions.invoke('ops-video', { body: b }); if (error || data?.error) { uiAlert((data && data.error) || error?.message || '실패'); return null; } return data; };
  const again = () => renderOpsVideo(body);
  body.querySelectorAll('[data-vdst]').forEach(b => b.onclick = () => { opsVdSt = b.dataset.vdst; again(); });
  body.querySelectorAll('[data-vdok]').forEach(b => b.onclick = async () => { b.disabled = true; if (await call({ action:'approve', id:b.dataset.vdok })) again(); else b.disabled = false; });
  body.querySelectorAll('[data-vdno]').forEach(b => b.onclick = async () => { const r = await uiPrompt('반려 사유(선택)', ''); if (r === null) return; if (await call({ action:'reject', id:b.dataset.vdno, reason:r })) again(); });
  body.querySelectorAll('[data-vdcancel]').forEach(b => b.onclick = async () => { if (!await uiConfirm('이 요청을 취소합니다.', { ok: '요청 취소', cancel: '그대로 두기', danger: true })) return; if (await call({ action:'cancel', id:b.dataset.vdcancel })) again(); });
  body.querySelectorAll('[data-vddone]').forEach(b => b.onclick = async () => { if (await call({ action:'decide', id:b.dataset.vddone, ok:true })) { poToast('검수 승인했습니다.', 2000); again(); } });
  body.querySelectorAll('[data-vdredo]').forEach(b => b.onclick = async () => { const t = body.querySelector(`[data-vdwhy="${b.dataset.vdredo}"]`).value.trim(); if (!t) return uiAlert('고칠 점을 적어 주세요.'); if (await call({ action:'decide', id:b.dataset.vdredo, ok:false, reason:t })) again(); });
  body.querySelectorAll('[data-vdcopy]').forEach(b => b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.vdcopy); b.textContent = '복사됨'; } catch (e) { await uiPrompt('경로', b.dataset.vdcopy); } });
  // 새 요청
  const box = $('#vd-new');
  const drawNew = () => {
    if (!opsVdNew) { box.innerHTML = ''; return; }
    const k = opsVdNew.kind, q = (opsVdNew.q || '').trim().toLowerCase();
    const usedKey = new Set(all.filter(j => !['rejected', 'cancelled', 'failed'].includes(j.status)).map(j => j.kind + ':' + j.source_file_id));
    const fs = fl.filter(f => !q || (f.filename + ' ' + (f.title_guess || '') + ' ' + cardTitle(f.content_id)).toLowerCase().includes(q)).slice(0, 80);
    const cs = cards.filter(c => c.script && (!q || (c.title || '').toLowerCase().includes(q))).sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 80);
    box.innerHTML = `<div class="vd-card" style="margin-bottom:14px"><b>새 편집 요청</b>
      <div class="toolbar" style="padding:8px 0">${Object.keys(VD_KIND).map(x => `<button class="chip ${k === x ? 'on' : ''}" data-vdk="${x}">${VD_KIND[x]}</button>`).join('')}</div>
      <div class="rv-sub">${k === 'new' ? '대본이 있는 카드를 고르세요. 김제조 AI 아바타 + 제품·자료 화면 + AI 장면으로 새로 만듭니다.' : '완성된 한국어 영상(NAS 인스타그램 폴더)을 고르세요. 원본은 그대로 두고 새 파일로 만듭니다.'}</div>
      <input id="vd-q" value="${esc(opsVdNew.q || '')}" placeholder="${k === 'new' ? '카드 제목 검색' : '파일명·카드 제목 검색'}" style="width:100%;margin:8px 0;padding:8px;border:1px solid var(--line);border-radius:8px">
      <div class="vd-pick">${k === 'new'
        ? cs.map(c => `<label><input type="radio" name="vdpick" value="${c.id}" ${opsVdNew.pick === c.id ? 'checked' : ''}> [${teamTag(c)}] ${esc(c.title)}${c.views ? ` <span class="rv-sub">조회 ${fmtN(c.views)}</span>` : ''}</label>`).join('') || '<p class="rv-sub">대본 있는 카드가 없습니다.</p>'
        : fs.map(f => { const used = usedKey.has(k + ':' + f.id); return `<label class="${used ? 'dim' : ''}"><input type="radio" name="vdpick" value="${f.id}" ${used ? 'disabled' : ''} ${opsVdNew.pick === f.id ? 'checked' : ''}> ${esc(f.filename)} <span class="rv-sub">${esc(f.file_date || String(f.mtime || '').slice(0, 10))}${cardTitle(f.content_id) ? ' · ' + esc(cardTitle(f.content_id)) : ''}${used ? ' · 이미 요청됨' : ''}</span></label>`; }).join('') || '<p class="rv-sub">파일이 없습니다.</p>'}</div>
      <textarea id="vd-note" rows="2" placeholder="요청 메모(선택): 예) 제목은 영어로 새로, 자막 크게, 30초 이내" style="width:100%;margin-top:8px;border:1px solid var(--line);border-radius:8px;padding:8px;font:inherit">${esc(opsVdNew.note || '')}</textarea>
      <div class="cm-act" style="align-items:center">${isMaster ? '<label class="rv-sub"><input type="checkbox" id="vd-appr" checked> 바로 승인(유료 작업 시작)</label>' : '<span class="rv-sub">요청하면 대표 승인 후 시작합니다.</span>'}
        <button class="btn sm" id="vd-send">요청하기</button><button class="btn sm ghost" id="vd-close">닫기</button></div></div>`;
    box.querySelectorAll('[data-vdk]').forEach(b => b.onclick = () => { opsVdNew = { kind:b.dataset.vdk, q:opsVdNew.q, note:$('#vd-note').value }; drawNew(); });
    $('#vd-q').oninput = e => { opsVdNew.q = e.target.value; opsVdNew.note = $('#vd-note').value; const pos = e.target.selectionStart; drawNew(); const n = $('#vd-q'); n.focus(); n.setSelectionRange(pos, pos); };
    box.querySelectorAll('[name="vdpick"]').forEach(r => r.onchange = () => { opsVdNew.pick = r.value; });
    $('#vd-close').onclick = () => { opsVdNew = null; drawNew(); };
    $('#vd-send').onclick = async e => {
      if (!opsVdNew.pick) return uiAlert(k === 'new' ? '카드를 골라 주세요.' : '원본 영상을 골라 주세요.');
      e.target.disabled = true;
      const b = { action:'request', kind:k, note:$('#vd-note').value, approve: !!($('#vd-appr') && $('#vd-appr').checked) };
      if (k === 'new') b.content_id = opsVdNew.pick; else b.source_file_id = opsVdNew.pick;
      const d = await call(b);
      if (d) { opsVdNew = null; opsVdSt = d.status === 'approved' ? 'run' : 'todo'; poToast(d.status === 'approved' ? '승인된 요청으로 등록했습니다(시험 단계라 아직 편집은 시작하지 않습니다).' : '요청했습니다. 대표 승인 후 시작합니다.', 3000); again(); }
      else e.target.disabled = false;
    };
  };
  $('#vd-newbtn').onclick = () => { opsVdNew = opsVdNew ? null : { kind:'en' }; drawNew(); };
  drawNew();
}

// 운영관리 화면이 열려 있으면 5분마다 댓글·DM 새로고침(글 쓰는 중이면 건너뜀)
setInterval(async () => { try { if (!vdOpen || !opsData || $('#view-video').classList.contains('hide') || opsTab === 'upload') return; const a = document.activeElement; if (a && a.tagName === 'TEXTAREA' && a.value) return; await loadOps(); renderVideo(); } catch (e) {} }, 300000);

