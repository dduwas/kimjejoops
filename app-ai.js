'use strict';
// 김제조 웍스 — AI 대본 쓰기·일괄 작성  (v88에서 index.html 에서 분리)
/* ---------- v47 🤖 AI 대본 쓰기 (대본 저장과 별개) ----------
   서버 함수 write-script: 내용 레퍼런스(링크/붙여넣기) → 내용 카피, 형식(유형 + 붙여넣기/카드 대본) → 형식 적용.
   형식 유형은 김제조 숏폼 대본 스킬(v1, 10-25)의 '잘 되는 포맷'. 결과는 script_jobs 기록, 카드에 넣는 건 사람이 확인 후.
   v47: 카드 편집창에서 열었을 때 '카드 대본에 넣기'가 편집창 대본 칸도 채움(편집창 저장 시 빈 대본으로 덮어쓰던 문제 수정). */
const AI_FMT = [
  { k:'', label:'기본 구조', desc:'내 문제 → 충격적인 사실 → 이유(근거·숫자) → 행동', re:null },
  { k:'vs', label:'A vs B 판정형', desc:'제품·선택지 → 판정 → 근거 한 줄(숫자) 3박자 반복. 예: 다이소 vs 올영, 혈당 과일 vs 과일', re:/vs|VS|대결|비교/ },
  { k:'tier', label:'티어리스트', desc:'S~D 등급으로 나눠 등급마다 이유 한 줄. 예: 진통제·피로회복제 티어리스트', re:/티어/ },
  { k:'rank', label:'TOP5·랭킹', desc:'N가지·순위 호명. 순서를 섞어 호명해 끝까지 보게. 예: 번아웃 신호 5가지, 자기 전 별로인 영양제 TOP5', re:/TOP|top|가지|랭킹|순위|베스트/ },
  { k:'eval', label:'생활 평가형', desc:'생활 습관·자세를 하나씩 점수/평가. 예: 잠자는 포지션 평가', re:/평가|점수/ }
];
/* v74 외국어 라인 — 영어 대본. PD 확정 현지화 규칙(직역 금지·구어체·발화 길이 85~100%·번역표)을 추가 지시로 붙인다. */
const EN_NOTE = "[영어판으로 쓴다 — 외국어 라인]\n- 결과물은 미국 영어로 쓴다. rows 의 line(대사·자막)은 영어로, scene(장면 설명)은 한국어로 둔다.\n- 직역하지 않는다. 미국 소비자가 실제로 쓰는 구어체로 다시 쓴다(예: 속건조 → dehydrated skin).\n- 핵심 주장, 김제조 캐릭터(약사이자 제조사 대표), 입증 가능한 사실은 그대로 유지한다.\n- 현지에서 안 통하는 농담·약어·비유는 바꾼다. 한국 브랜드(다이소·올리브영 등)는 짧은 설명을 붙이거나 현지 대응물로 바꾼다.\n- 발화 길이는 한국어 기준 분량의 85~100%로 맞춘다(영상 길이를 못 바꾸기 때문).\n- 미국 FDA·FTC 건강 표시 규제는 확인 전 통과를 단정하지 않는다. 걸릴 만한 문장은 [확인 필요]로 표시하고 대체 문장을 제안한다.\n- 마지막 줄 자막은 한국어 대신 영어로: [자막] Supplement truths — follow Kim Jejo!\n- notes 맨 끝에 「번역표」를 붙인다. 한 줄에 '한국어 | English' 로, 화면 자막까지 포함한다.";
/* v90 「🔁 거의 그대로 따라 쓰기」 — 레퍼런스를 최대한 그대로 따라가되 항목 1~2개 교체·순서 바꾸기로만 변주한다 */
const SAME_NOTE = "[거의 그대로 따라 쓰기 — 조금만 바꾼 변주판]\n"
  + "- 목표는 레퍼런스와 거의 같은 영상이다. 구성·장면 순서·호흡·길이·훅의 종류를 그대로 가져온다. 새로 기획하지 않는다.\n"
  + "- 다만 아래 세 가지는 일부러 바꾼다. 바꿀 수 있는 자리가 있으면 반드시 바꾼다.\n"
  + "  (1) 나열되는 항목이 3개 이상이면 그중 1~2개를 반드시 갈아 끼운다. 제품 5개면 1~2개 교체, 신호 7가지면 1~2개 교체.\n"
  + "      교체는 같은 기능군 안에서 고른다. 예: 항산화면 커큐민↔아스타잔틴·레스베라트롤, 수면이면 마그네슘↔테아닌, 다이소 제품이면 같은 코너의 다른 제품.\n"
  + "      레퍼런스 항목만큼 근거가 두텁지 않아도 된다. 약사·제조자로서 말이 되면 넣는다. 단정적 효능 표현만 피하고, 근거가 얕으면 그 자리에 [확인 필요]를 붙인다.\n"
  + "      설명 길이는 원래 항목과 비슷하게 맞춘다. 정말 바꿀 만한 것이 없을 때만 그대로 두고, 그 이유를 「바꾼 곳」에 적는다.\n"
  + "  (2) 나열 순서를 바꾼다. 특히 맨 처음과 맨 마지막은 자리를 옮긴다. 순위형이면 1위와 2~3위를 바꿔도 된다.\n"
  + "  (3) 예시·비유·상황 중 한두 개를 한국 소비자에게 더 익숙한 것으로 갈아 끼운다.\n"
  + "- 말은 새로 쓴다. 뜻이 같아도 문장은 레퍼런스와 다르게 쓴다. 같은 문장을 그대로 옮기면 안 된다(인스타 오리지널리티 정책·김제조 대본 규칙).\n"
  + "- 표현은 레퍼런스보다 쉽게. 어려운 말은 쉬운 말로, 긴 문장은 짧게, 전문 용어는 한 번 풀어서.\n"
  + "- 레퍼런스에 없는 수치·임상·후기는 만들지 않는다. 그대로 쓰는 항목의 숫자는 레퍼런스 값을 유지한다.\n"
  + "- 김제조 확정 규칙(마지막 자막, 길이, 규제 표현)은 그대로 지킨다.\n"
  + "- notes 맨 끝에 「바꾼 곳」을 붙인다. 무엇을 무엇으로 바꿨는지, 순서를 어떻게 돌렸는지 한 줄씩 적는다.";
async function aiScript(card){
  if (!card) return;
  const withScript = cards.filter(c => c.script && c.id !== card.id).sort((a, b) => (b.views || 0) - (a.views || 0));
  let fmtK = '';
  let enMode = (card.team_tag === '외');
  const bg = document.createElement('div'); bg.className = 'aiw-bg';
  bg.innerHTML = `<div class="aiw"><h3>🤖 AI 대본 쓰기 — ${esc(card.title)}</h3>
    <div class="sub">① 무엇을 말할지(내용) ② 어떤 틀로 말할지(형식)를 정하면 김제조 말투로 초안을 씁니다. 결과를 보고 <b>카드 대본에 넣기</b>를 눌러야 저장됩니다.<br><b>🔁 거의 그대로 따라 쓰기</b>는 레퍼런스를 <b>구성·순서까지 그대로</b> 따라가되, <b>나열 항목 1~2개를 바꾸고 순서를 돌려</b> 변주판을 만듭니다. 문장은 새로 씁니다(형식 선택은 무시). 메모 끝에 <b>바꾼 곳</b>이 정리됩니다.</div>
    <div class="aiw-sec"><div class="aiw-h">① 내용 레퍼런스</div>
      <label>링크</label><input id="aw-url" value="${esc(card.reference_url || '')}" placeholder="https://www.instagram.com/p/…">
      <label>내용 붙여넣기 <span class="aiw-hint">영상 자막·캡션·기사 본문. 인스타·유튜브는 링크로 캡션만 읽혀서, 말하는 내용은 여기 붙여 주세요</span></label><textarea id="aw-reftext"></textarea>
    </div>
    <div class="aiw-sec"><div class="aiw-h">② 형식 레퍼런스 <span class="aiw-hint">(선택)</span></div>
      <label>따라 할 형식 붙여넣기 <span class="aiw-hint">다른 계정 대본·장면 구성. 여기 쓰면 아래 선택보다 우선</span></label>
      <textarea id="aw-fmttext" placeholder="예: 0~2초 결론 먼저 → 1번 … → 2번 … → 마무리 질문"></textarea>
      <label>또는 형식 고르기</label>
      <div class="aiw-fmts">${AI_FMT.map(f => `<button type="button" class="chip ${f.k === fmtK ? 'on' : ''}" data-awfmt="${f.k}">${esc(f.label)}</button>`).join('')}</div>
      <div class="aiw-hint" id="aw-fmtdesc" style="margin:6px 0 0"></div>
      <label>본보기 대본 <span class="aiw-hint">고른 형식의 우리 대본(조회수 순). 장면 구성·리듬·자막 방식을 따라 함</span></label>
      <select id="aw-fmtcard"></select>
    </div>
    <label>언어</label>
    <div class="aiw-fmts"><button type="button" class="chip ${enMode ? '' : 'on'}" data-awen="0">🇰🇷 한국어</button><button type="button" class="chip ${enMode ? 'on' : ''}" data-awen="1">🌐 영어 대본</button>
      <span class="aiw-hint">영어로 하면 직역 대신 현지 구어체로 다시 쓰고, 메모 끝에 번역표가 붙습니다 (외국어 라인 카드는 자동으로 켜집니다)</span></div>
    <label>추가 지시 (선택)</label><input id="aw-note" placeholder="예: 40초 이내, 네/아니요 형식, TTS 질문 + 약사 답">
    <div class="row"><button class="btn sm" id="aw-go">✍️ 초안 쓰기</button><button class="btn sm" id="aw-same" style="background:#6B3FA0;border-color:#6B3FA0" title="레퍼런스를 구성·순서까지 거의 그대로 따라가되 나열 항목 1~2개 교체·순서 바꾸기로 변주합니다. 문장은 새로 씁니다. 위의 형식 선택은 쓰지 않습니다">🔁 거의 그대로 따라 쓰기</button><button class="chip" id="aw-x">닫기</button><span id="aw-st" style="font-size:12.5px;color:var(--muted)"></span></div>
    <div id="aw-out"></div></div>`;
  document.body.appendChild(bg);
  const $b = s => bg.querySelector(s);
  const fillFmt = () => {
    const f = AI_FMT.find(x => x.k === fmtK) || AI_FMT[0];
    bg.querySelectorAll('[data-awfmt]').forEach(b => b.classList.toggle('on', b.dataset.awfmt === fmtK));
    $b('#aw-fmtdesc').textContent = '틀: ' + f.desc;
    const list = (f.re ? withScript.filter(c => f.re.test(c.title || '')) : withScript).slice(0, 60);
    $b('#aw-fmtcard').innerHTML = `<option value="">${f.re ? '본보기 없이 이 형식으로' : '없음 — 같은 라인 최근 대본 형식'}</option>` +
      list.map((c, i) => `<option value="${c.id}" ${f.re && i === 0 ? 'selected' : ''}>[${teamTag(c)}] ${esc(c.title)}${c.views ? ' · 조회 ' + fmtN(c.views) : ''}</option>`).join('');
  };
  fillFmt();
  bg.querySelectorAll('[data-awfmt]').forEach(b => b.onclick = () => { fmtK = b.dataset.awfmt; fillFmt(); });
  bg.querySelectorAll('[data-awen]').forEach(b => b.onclick = () => { enMode = b.dataset.awen === '1'; bg.querySelectorAll('[data-awen]').forEach(x => x.classList.toggle('on', (x.dataset.awen === '1') === enMode)); });
  const close = () => bg.remove();
  $b('#aw-x').onclick = close; bg.onclick = e => { if (e.target === bg) close(); };
  const call = async (mode) => {
    const { data: { session } } = await sb.auth.getSession();
    const f = AI_FMT.find(x => x.k === fmtK) || AI_FMT[0];
    const same = mode === 'same';   // v89: 레퍼런스 구조를 그대로 따르므로 형식 지정은 끈다
    const body = { card_id: card.id, ref_url: $b('#aw-url').value.trim(), ref_text: $b('#aw-reftext').value,
      format_text: same ? '' : $b('#aw-fmttext').value,
      format_card_id: same ? null : ($b('#aw-fmttext').value.trim() ? null : ($b('#aw-fmtcard').value || null)),
      format_type: same ? '' : (fmtK ? `${f.label} — ${f.desc}` : ''),
      note: (same ? SAME_NOTE + '\n' : '') + (enMode ? EN_NOTE + '\n' : '') + $b('#aw-note').value };
    const r = await fetch(String(window.SUPABASE_URL).replace(/\/+$/, '') + '/functions/v1/write-script', { method: 'POST', headers: { Authorization: 'Bearer ' + session.access_token, apikey: window.SUPABASE_ANON_KEY, 'content-type': 'application/json' },
      body: JSON.stringify(body) });
    return r.json();
  };
  const run = async (mode) => {
    const st = $b('#aw-st'), out = $b('#aw-out'), go = $b('#aw-go'), sm = $b('#aw-same');
    go.disabled = true; sm.disabled = true;
    st.textContent = (mode === 'same' ? '거의 그대로 따라 쓰는 중… ' : '쓰는 중… ') + '(20~60초)'; out.innerHTML = '';
    try {
      const j = await call(mode);
      if (j.error) { out.innerHTML = `<div class="msg">⚠ ${esc(j.error)}</div>`; return; }
      if (j.need_key) { out.innerHTML = `<div class="msg">⚠ AI 키가 아직 설정되지 않았습니다.</div>`; return; }
      out.innerHTML = `<div class="msg">내용: ${esc(j.ref_how || '-')} · 형식: ${esc(j.fmt_how || '-')} · 스킬 v${j.skill_version}${j.hook ? `<br><b>훅:</b> ${esc(j.hook)}` : ''}${j.notes ? `<br><b>메모:</b> ${esc(j.notes)}` : ''}</div>
        <table><tr><th style="width:42%">장면 설명</th><th>대사/자막</th></tr>${(j.rows || []).map(r => `<tr><td>${esc(r.scene || '')}</td><td>${esc(r.line || '')}</td></tr>`).join('')}</table>
        <div class="row"><button class="btn sm" id="aw-apply">카드 대본에 넣기</button><button class="chip" id="aw-again">다시 쓰기</button><span style="font-size:12.5px;color:var(--muted)">${card.script ? '지금 대본은 AI 작업 기록에 남기고 바꿉니다' : ''}</span></div>`;
      out.querySelector('#aw-again').onclick = () => run(mode);
      out.querySelector('#aw-apply').onclick = async e => {
        const cur = cards.find(x => x.id === card.id) || card;
        if (cur.script && !confirm('카드에 있는 대본·메모를 이 초안으로 바꿉니다. (이전 대본은 AI 작업 기록에 남습니다)')) return;
        e.target.disabled = true;
        const { data: upd, error } = await sb.from('contents').update({ script: j.script }).eq('id', card.id).select('id, script');
        if (error) { e.target.disabled = false; return alert(cleanErr(error.message)); }
        if (!upd || !upd.length || upd[0].script !== j.script) { e.target.disabled = false; return alert('저장되지 않았습니다(권한 확인 필요). 다시 시도하거나 대표에게 알려 주세요.'); }
        if (j.job_id) await sb.from('script_jobs').update({ applied_at: new Date().toISOString() }).eq('id', j.job_id);
        const fs = document.getElementById('f-script');   // 카드 편집창이 열려 있으면 그 칸도 같은 대본으로(편집창 저장 때 덮어쓰기 방지)
        if (fs) { fs.value = j.script; fs.dispatchEvent(new Event('input', { bubbles: true })); }
        close(); await refresh(); poToast(fs ? 'AI 초안을 카드 대본에 저장했고, 편집창 대본 칸에도 넣었습니다.' : 'AI 초안을 카드 대본에 넣었습니다. 📝 대본 저장으로 docx를 받을 수 있습니다.', 3500);
      };
    } catch (err) { out.innerHTML = `<div class="msg">⚠ ${esc(err.message || String(err))}</div>`; }
    finally { go.disabled = false; sm.disabled = false; st.textContent = ''; }
  };
  $b('#aw-go').onclick = () => run('');
  $b('#aw-same').onclick = () => run('same');
}

/* ---------- v73 🤖 AI 대본 일괄 작성 (대기열) ----------
   고른 카드를 script_jobs 에 queued 로 쌓고(write-script action:'queue'), pg_cron kj-script-queue 가 1분마다 한 건씩
   write-script action:'run_queued' 로 처리해 카드 대본까지 바로 채운다. 브라우저를 꺼도 계속된다. 이전 대본은 prev_script 에 남는다. */
async function aiScriptBulk(list){
  if (!list || !list.length) return alert('카드를 먼저 골라 주세요.');
  let fmtK = '';
  let enMode = list.every(c => c.team_tag === '외');
  const bg = document.createElement('div'); bg.className = 'aiw-bg';
  bg.innerHTML = `<div class="aiw"><h3>🤖 AI 대본 일괄 작성 — ${list.length}개</h3>
    <div class="sub">고른 카드를 <b>대기열</b>에 넣습니다. AI 컴퓨터가 <b>1분에 한 건씩</b> 써서 카드 대본에 바로 채웁니다.
      <b>이 창을 닫거나 브라우저를 꺼도 계속됩니다.</b> 한 건에 30~60초쯤 걸립니다. 각 카드의 레퍼런스 링크를 내용으로 씁니다.</div>
    <div class="ms-items">${list.map(c => `<span>${esc(c.title)}${(c.script || '').trim() ? ' · <b style="color:#B42318">대본 있음</b>' : ''}</span>`).join('')}</div>
    <label>형식</label>
    <div class="aiw-fmts">${AI_FMT.map(f => `<button type="button" class="chip ${f.k === fmtK ? 'on' : ''}" data-bwfmt="${f.k}">${esc(f.label)}</button>`).join('')}</div>
    <div class="aiw-hint" id="bw-fmtdesc" style="margin:6px 0 0"></div>
    <label>언어</label>
    <div class="aiw-fmts"><button type="button" class="chip ${enMode ? '' : 'on'}" data-bwen="0">🇰🇷 한국어</button><button type="button" class="chip ${enMode ? 'on' : ''}" data-bwen="1">🌐 영어 대본</button>
      <span class="aiw-hint">외국어 라인 카드만 고르면 자동으로 켜집니다</span></div>
    <label>추가 지시 (선택) <span class="aiw-hint">고른 카드 전부에 같이 적용됩니다</span></label>
    <input id="bw-note" placeholder="예: 40초 이내, 첫 2초에 결론 먼저">
    <label style="display:flex;gap:6px;align-items:center;margin-top:12px;font-weight:600"><input type="checkbox" id="bw-over"> 이미 대본이 있는 카드도 다시 쓰기
      <span class="aiw-hint">끄면 대본이 비어 있는 카드만 씁니다 (이전 대본은 어느 쪽이든 AI 작업 기록에 남습니다)</span></label>
    <div class="row"><button class="btn sm" id="bw-go">대기열에 넣기</button><button class="chip" id="bw-x">닫기</button><span id="bw-st" style="font-size:12.5px;color:var(--muted)"></span></div></div>`;
  document.body.appendChild(bg);
  const $b = s => bg.querySelector(s);
  const fill = () => { const f = AI_FMT.find(x => x.k === fmtK) || AI_FMT[0];
    bg.querySelectorAll('[data-bwfmt]').forEach(b => b.classList.toggle('on', b.dataset.bwfmt === fmtK));
    $b('#bw-fmtdesc').textContent = '틀: ' + f.desc; };
  fill();
  bg.querySelectorAll('[data-bwfmt]').forEach(b => b.onclick = () => { fmtK = b.dataset.bwfmt; fill(); });
  bg.querySelectorAll('[data-bwen]').forEach(b => b.onclick = () => { enMode = b.dataset.bwen === '1'; bg.querySelectorAll('[data-bwen]').forEach(x => x.classList.toggle('on', (x.dataset.bwen === '1') === enMode)); });
  const close = () => bg.remove();
  $b('#bw-x').onclick = close; bg.onclick = e => { if (e.target === bg) close(); };
  $b('#bw-go').onclick = async () => {
    const go = $b('#bw-go'); go.disabled = true; $b('#bw-st').textContent = '넣는 중…';
    try {
      const f = AI_FMT.find(x => x.k === fmtK) || AI_FMT[0];
      const { data: { session } } = await sb.auth.getSession();
      const r = await fetch(String(window.SUPABASE_URL).replace(/\/+$/, '') + '/functions/v1/write-script', { method: 'POST',
        headers: { Authorization: 'Bearer ' + session.access_token, apikey: window.SUPABASE_ANON_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'queue', card_ids: list.map(c => c.id), format_type: fmtK ? `${f.label} — ${f.desc}` : '',
          note: (enMode ? EN_NOTE + '\n' : '') + $b('#bw-note').value, overwrite: $b('#bw-over').checked }) });
      const j = await r.json();
      if (j.error) { go.disabled = false; $b('#bw-st').textContent = ''; return alert(j.error); }
      close(); scPickMode(false);
      poToast(j.queued ? `${j.queued}개를 대기열에 넣었습니다${j.skipped ? ` (대본이 이미 있어 건너뜀 ${j.skipped}개)` : ''}. 1분에 한 건씩 써서 카드에 바로 채웁니다.`
        : '넣을 카드가 없습니다. 이미 대기 중이거나 대본이 모두 채워져 있습니다.', 6000);
      sqWatch();
    } catch (err) { go.disabled = false; $b('#bw-st').textContent = ''; alert(err.message || String(err)); }
  };
}
let sqTimer = null;
async function sqWatch(){
  if (sqTimer) { clearTimeout(sqTimer); sqTimer = null; }
  let n = 0;
  try { const { data } = await sb.from('script_jobs').select('id').in('status', ['queued', 'writing']); n = (data || []).length; } catch (e) { return; }
  let el = document.getElementById('sq-bar');
  if (!n) { if (el) { el.remove(); await refresh(); poToast('AI 대본 일괄 작성이 끝났습니다.', 4000); } return; }
  if (!el) { el = document.createElement('div'); el.id = 'sq-bar'; el.className = 'sq-bar'; document.body.appendChild(el); }
  el.innerHTML = `🤖 AI 대본 <b>${n}개</b> 쓰는 중…<small>1분에 한 건씩 · 창을 닫아도 계속됩니다</small>`;
  sqTimer = setTimeout(sqWatch, 20000);
}
setTimeout(() => { try { sqWatch(); } catch (e) {} }, 4000);

async function moveLine(id, t){
  id = String(id || '').split('|')[0];   // 캘린더 일정은 "카드id|종류"
  const c = cards.find(x => x.id === id); if (!c || teamTag(c) === t) return;
  const { error } = await sb.from('contents').update({ team_tag: t }).eq('id', id);
  if (error) return alert(cleanErr(error.message));
  await refresh(); poToast(`"${(c.title || '').slice(0, 24)}" → ${TEAM_LABEL[t]} 라인으로 옮김 (단계 '${c.stage}' 그대로)`, 2800);
}

function buildScheduleChips(){
  const pool = cards.filter(c => scLineOk(c) && (
    c.stage === '촬영' || c.stage === '편집' || c.stage === PLANNED || c.stage === DONE));
  buildChips('#sc-owner-chips', '#sc-owner-clear', ownerItems(pool), scOwnerFilter, renderSchedule);
  const chs = channels.filter(c => c.active).map(c => ({ key: c.label, label: c.label }));
  buildChips('#sc-channel-chips', '#sc-channel-clear', chs, scChannelFilter, renderSchedule);

  // v99 계정별 보기 — 실제로 올라간 글이 있는 계정만 칩으로 (🤖 자동 일정 기준)
  const accMap = new Map();
  (schedAuto || []).forEach(a => {
    const key = (a.platform || '') + '|' + (a.account || '');
    if (!accMap.has(key)) accMap.set(key, { key, name: (SA_CH[a.platform] || a.platform) + (a.account ? ' ' + a.account : ''), n: 0 });
    accMap.get(key).n++;
  });
  const accs = [...accMap.values()].sort((x, y) => y.n - x.n).map(x => ({ key: x.key, label: x.name + ' ' + x.n }));
  buildChips('#sc-acc-chips', '#sc-acc-clear', accs, scAccFilter, renderSchedule);
}

function buildChannelChips(){
  const active = channels.filter(c => c.active);
  // 사라진 채널이 필터에 남아 있으면 정리
  [...channelFilter].forEach(l => { if (!active.some(c => c.label === l)) channelFilter.delete(l); });

  $('#channel-chips').innerHTML = active.map(c =>
    `<button class="chip ch ${channelFilter.has(c.label)?'on':''}" data-ch="${esc(c.label)}">${esc(c.label)}</button>`
  ).join('') || '<span style="font-size:12.5px;color:var(--muted)">설정 탭에서 채널을 추가하세요</span>';

  $$('#channel-chips .chip').forEach(b => b.onclick = () => {
    const ch = b.dataset.ch;
    channelFilter.has(ch) ? channelFilter.delete(ch) : channelFilter.add(ch);
    b.classList.toggle('on', channelFilter.has(ch));
    $('#chip-clear').classList.toggle('hide', channelFilter.size === 0);
    renderBoard();
  });
  $('#chip-clear').classList.toggle('hide', channelFilter.size === 0);
  $('#chip-clear').onclick = () => {
    channelFilter.clear();
    $$('#channel-chips .chip').forEach(b => b.classList.remove('on'));
    $('#chip-clear').classList.add('hide');
    renderBoard();
  };
}

function visible(){
  return cards.filter(c => {
    if (c.stage === PLANNED || c.stage === DONE || c.stage === DROP) return false;
    if (onlyMine && !(c.owner_ids || []).includes(me.id)) return false;
    if (!matchOwner(c, ownerFilter)) return false;
    if (teamTag(c) !== lineOf()) return false;
    if (!matchChannel(c, channelFilter)) return false;
    if (stageFilter.size && !stageFilter.has(colNameOf(c.stage))) return false;
    return true;
  });
}

