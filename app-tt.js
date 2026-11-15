'use strict';
/* v116 (11-16) 🎵 틱톡 임시 — 운영관리 탭
   - 틱톡 크리에이티브센터 인기 순위(AI 컴퓨터가 매일 06:37 수집, 07:07 로컬 AI 분석) → kj_tt_trends·kj_tt_meta
   - 영상·해시태그를 생산 라인(아이디어)으로 넘기기 / 틱톡 분석 대상 계정(kj_tt_targets) 추가·삭제 */
let ttSet = '', ttData = null;
const ttLB = { hashtag: '해시태그', video: '영상', creator: '크리에이터', KR: '한국', US: '미국', JP: '일본' };
const ttLabel = n => n.split('_').map(p => ttLB[p] || (/^\d+$/.test(p) ? p + '일' : p)).join(' ');
const ttN = x => x == null ? '-' : x >= 1e8 ? (x / 1e8).toFixed(1) + '억' : x >= 1e4 ? (x / 1e4).toFixed(1) + '만' : Number(x).toLocaleString();
function ttMd(s) {
  const e = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  let h = '', list = '';
  const close = () => { if (list) { h += '</' + list + '>'; list = ''; } };
  String(s || '').split('\n').forEach(l => {
    let m;
    if ((m = l.match(/^#{1,4}\s+(.*)/))) { close(); h += '<h4>' + e(m[1]) + '</h4>'; }
    else if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) { if (list !== 'ol') { close(); h += '<ol>'; list = 'ol'; } h += '<li>' + e(m[1]) + '</li>'; }
    else if ((m = l.match(/^\s*[-*•]\s+(.*)/))) { if (list !== 'ul') { close(); h += '<ul>'; list = 'ul'; } h += '<li>' + e(m[1]) + '</li>'; }
    else if (l.trim()) { close(); h += '<p>' + e(l) + '</p>'; }
  });
  close(); return h;
}
async function ttLoad() {
  const [t, m, g] = await Promise.all([
    sb.from('kj_tt_trends').select('*').order('rank', { ascending: true }),
    sb.from('kj_tt_meta').select('*').eq('id', 1).maybeSingle(),
    sb.from('kj_tt_targets').select('*').order('created_at', { ascending: false })]);
  if (t.error) throw t.error;
  ttData = { rows: t.data || [], meta: m.data || null, targets: g.data || [] };
}
async function renderOpsTiktok(body) {
  if (!document.getElementById('tt-css')) {
    const st = document.createElement('style'); st.id = 'tt-css';
    st.textContent = `.tt-wrap{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:16px;margin-top:10px}
.tt-card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px 16px;min-width:0}
.tt-ai h4{margin:14px 0 4px;color:#E8590C;font-size:14.5px}.tt-ai h4:first-child{margin-top:0}.tt-ai p,.tt-ai li{font-size:13.5px;line-height:1.65;margin:2px 0}.tt-ai ol,.tt-ai ul{padding-left:18px;margin:4px 0}
.tt-sets{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}.tt-sets button{border:1px solid var(--line);background:#fff;border-radius:999px;padding:5px 12px;font-size:13px;cursor:pointer}.tt-sets button.on{background:#111;color:#fff;border-color:#111}
.tt-t{width:100%;border-collapse:collapse;font-size:13.5px}.tt-t td,.tt-t th{padding:7px 4px;border-top:1px solid var(--line);vertical-align:middle;text-align:left}.tt-t th{font-size:12px;color:var(--muted,#888)}.tt-t td.n{text-align:right;white-space:nowrap}
.tt-t .up{color:#0f766e;font-size:11.5px}.tt-t .dn{color:#b42318;font-size:11.5px}.tt-t .nw{color:#fe2c55;font-size:11px;font-weight:800}
.tt-go{white-space:nowrap}.tt-go button{font-size:12px;padding:3px 8px;border:1px solid var(--line);background:#fff;border-radius:7px;cursor:pointer;margin-left:2px}.tt-go button:hover{border-color:#E8590C;color:#E8590C}.tt-go .done{font-size:12px;color:#0f766e;font-weight:700}
.tt-acc{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px}.tt-acc input{padding:7px 10px;border:1px solid var(--line);border-radius:8px;font:inherit;font-size:13.5px}
.tt-chip{display:inline-flex;gap:6px;align-items:center;border:1px solid var(--line);border-radius:999px;padding:3px 6px 3px 11px;font-size:13px;background:#fff}.tt-chip button{border:0;background:none;cursor:pointer;color:#999}
.tt-warn{background:#fff4e5;color:#8a4b00;border-radius:10px;padding:9px 13px;font-size:13.5px;margin-top:8px}
@media (max-width:900px){.tt-wrap{grid-template-columns:1fr}}`;
    document.head.appendChild(st);
  }
  body.innerHTML = '<p class="lede">불러오는 중…</p>';
  try { await ttLoad(); } catch (e) { body.innerHTML = '<p class="lede">불러오지 못했습니다: ' + esc(cleanErr(e.message)) + '</p>'; return; }
  ttPaint(body);
}
function ttPaint(body) {
  const { rows, meta, targets } = ttData;
  const O = ['hashtag', 'video', 'creator'];
  const sets = [...new Set(rows.map(r => r.set_name))].sort((a, b) => O.indexOf(a.split('_')[0]) - O.indexOf(b.split('_')[0]) || a.localeCompare(b));
  if (!sets.includes(ttSet)) ttSet = sets[0] || '';
  const cur = rows.filter(r => r.set_name === ttSet);
  const isTag = ttSet.startsWith('hashtag'), isCr = ttSet.startsWith('creator');
  const day = meta && meta.day ? meta.day.replace(/(\d{4})(\d\d)(\d\d)/, '$1-$2-$3') : '';
  body.innerHTML = `<div class="tt-card"><b>🎵 틱톡 임시</b> <span class="lede" style="font-size:13px">틱톡 크리에이티브센터 인기 순위(매일 아침 자동) · ${esc(day)} 수집</span>
      <div class="lede" style="font-size:13px;margin-top:4px">영상·해시태그는 <b>생산 라인</b>으로 넘길 수 있고, 크리에이터는 <b>분석 대상</b>에 넣을 수 있습니다.</div>
      ${meta && !meta.logged ? '<div class="tt-warn">⚠ 수집용 크롬이 틱톡에 로그인되지 않아 순위가 3개씩만 나옵니다. 로그인되면 20개씩 모입니다.</div>' : ''}
      <div style="margin-top:12px"><b style="font-size:13.5px">🔎 틱톡 분석 대상 계정</b> <span class="lede" style="font-size:12.5px">${targets.length}개 · 틱톡 수집기가 붙으면 이 계정들의 영상 조회수를 모읍니다</span>
      <div class="tt-acc">${targets.map(t => `<span class="tt-chip"><a href="https://www.tiktok.com/@${esc(t.handle)}" target="_blank" rel="noopener">@${esc(t.handle)}</a>${t.info ? ' <span class="lede" style="font-size:12px">' + esc(t.info) + '</span>' : ''}<button data-ttdel="${esc(t.handle)}" title="빼기">✕</button></span>`).join('')}</div>
      <div class="tt-acc"><input id="tt-h" placeholder="틱톡 아이디 또는 링크 (여러 개는 쉼표)" style="flex:1;min-width:220px"><input id="tt-hm" placeholder="메모 (선택)" style="width:160px"><button class="btn sm" id="tt-hadd">+ 계정 추가</button></div></div></div>
    <div class="tt-wrap"><div class="tt-card tt-ai"><div class="lede" style="font-size:12.5px;margin-bottom:6px">🤖 로컬 AI 분석 — 김제조 관점</div>${ttMd(meta && meta.ai)}</div>
    <div class="tt-card"><div class="tt-sets">${sets.map(s => `<button data-ttset="${esc(s)}" class="${s === ttSet ? 'on' : ''}">${esc(ttLabel(s))} <span style="opacity:.6">${rows.filter(r => r.set_name === s).length}</span></button>`).join('') || '<span class="lede">아직 수집된 순위가 없습니다.</span>'}</div>
    <table class="tt-t"><tr><th>#</th><th>${isTag ? '해시태그' : isCr ? '크리에이터' : '영상'}</th><th class="n">${isTag ? '게시' : '좋아요'}</th><th class="n">${isCr ? '팔로워' : '조회'}</th><th></th></tr>
    ${cur.map(r => `<tr data-ttid="${esc(r.id)}"><td>${r.rank ?? ''}${r.is_new ? ' <span class="nw">NEW</span>' : r.chg > 0 ? ' <span class="up">▲' + r.chg + '</span>' : r.chg < 0 ? ' <span class="dn">▼' + (-r.chg) + '</span>' : ''}</td>
      <td>${r.url ? '<a href="' + esc(r.url) + '" target="_blank" rel="noopener">' : ''}${isTag ? '#' : ''}${esc(r.name || r.handle || '')}${r.url ? '</a>' : ''}${r.handle && !isTag ? ' <span class="lede" style="font-size:12px">@' + esc(r.handle) + '</span>' : ''}</td>
      <td class="n">${ttN(isTag ? r.posts : r.likes)}</td><td class="n">${ttN(isCr ? r.followers : r.views)}</td>
      <td class="tt-go">${r.status === 'line' ? '<span class="done">✓ 생산 라인</span>' : isCr ? (r.handle ? `<button data-ttacc="${esc(r.handle)}">+ 분석 대상</button>` : '') : Object.keys(TEAM_LABEL).filter(k => k !== '웰').map(k => `<button data-ttline="${k}" title="${esc(TEAM_LABEL[k])} 라인 아이디어로">→ ${esc(TEAM_LABEL[k].split('/')[0])}</button>`).join('')}</td></tr>`).join('')}</table></div></div>`;
  body.querySelectorAll('[data-ttset]').forEach(b => b.onclick = () => { ttSet = b.dataset.ttset; ttPaint(body); });
  body.querySelectorAll('[data-ttline]').forEach(b => b.onclick = async () => {
    const tr = b.closest('tr'); const r = ttData.rows.find(x => x.id === tr.dataset.ttid); const team = b.dataset.ttline; if (!r) return;
    tr.querySelectorAll('button').forEach(x => x.disabled = true);
    const isT = r.set_name.startsWith('hashtag');
    const title = (isT ? '틱톡 #' : '틱톡 ') + (r.name || r.handle || '');
    const { data, error } = await sb.from('contents').insert({ title: title.replace(/\s+/g, ' ').slice(0, 60), stage: IDEA, team_tag: team, reference_url: r.url || null,
      next_action: `🎵 틱톡 임시(${ttLabel(r.set_name)} ${r.rank || ''}위${r.views ? ', 조회 ' + ttN(r.views) : ''}${r.posts ? ', 게시 ' + ttN(r.posts) : ''})에서 넘어옴`.slice(0, 500) }).select('id').single();
    if (error) { tr.querySelectorAll('button').forEach(x => x.disabled = false); return uiAlert(cleanErr(error.message)); }
    await sb.from('kj_tt_trends').update({ status: 'line', content_id: data.id }).eq('id', r.id);
    r.status = 'line'; r.content_id = data.id; poToast(`생산 라인(${TEAM_LABEL[team]}) 아이디어로 넘겼습니다.`); ttPaint(body);
  });
  const addAcc = async (raw, memo) => {
    const hs = [...new Set(String(raw).split(/[\s,·]+/).map(x => x.trim().replace(/^https?:\/\//, '').replace(/.*tiktok\.com\//, '').replace(/^@/, '').replace(/[/?#].*$/, '').toLowerCase()).filter(x => /^[a-z0-9._]{2,30}$/.test(x)))];
    if (!hs.length) return uiAlert('틱톡 아이디를 적어 주세요. 여러 개면 쉼표로 나눠 적으면 됩니다.');
    const have = new Set(ttData.targets.map(t => t.handle)); const neu = hs.filter(h => !have.has(h));
    if (!neu.length) return uiAlert('이미 들어 있는 계정입니다.');
    const { error } = await sb.from('kj_tt_targets').insert(neu.map(h => ({ handle: h, info: memo || null, created_by: me && me.id })));
    if (error) return uiAlert(cleanErr(error.message));
    await ttLoad(); ttPaint(body); poToast(neu.length + '개 틱톡 계정을 분석 대상에 넣었습니다.');
  };
  body.querySelector('#tt-hadd').onclick = () => addAcc($('#tt-h').value, $('#tt-hm').value.trim());
  body.querySelector('#tt-h').onkeydown = e => { if (e.key === 'Enter') addAcc($('#tt-h').value, $('#tt-hm').value.trim()); };
  body.querySelectorAll('[data-ttacc]').forEach(b => b.onclick = () => addAcc(b.dataset.ttacc, '크리에이티브센터 ' + ttLabel(ttSet)));
  body.querySelectorAll('[data-ttdel]').forEach(b => b.onclick = async () => {
    const { error } = await sb.from('kj_tt_targets').delete().eq('handle', b.dataset.ttdel);
    if (error) return uiAlert(cleanErr(error.message));
    await ttLoad(); ttPaint(body);
  });
}
