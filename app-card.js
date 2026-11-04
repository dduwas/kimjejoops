'use strict';
// 김제조 웍스 — 카드 상세·전역 단축키·우클릭 메뉴·부팅 호출  (v88에서 index.html 에서 분리)
/* ---------------- 카드 상세 ---------------- */
$('#btn-new').onclick = () => openCard(null, { team_tag: lineOf() });   // v37: 지금 보고 있는 라인에 추가

function openCard(c, preset){
  const isNew = !c;
  const d = c || { title:'', stage:'아이디어', channels:[], ...(preset || {}) };
  const admin = isAdmin();

  const body = `
    <h2>${isNew ? '새 콘텐츠' : esc(d.title)}</h2>
    <div class="sub">${isNew ? '제목만 먼저 채워도 됩니다.' : '단계 ' + esc(d.stage)}</div>
    <div id="dr-msg"></div>

    <div class="field"><label>콘텐츠 제목</label><input id="f-title" value="${esc(d.title)}"></div>
    <div class="field"><label>단계</label>
      <input type="hidden" id="f-stage" value="${esc(d.stage || IDEA)}">
      <div class="btngroup" id="f-stage-g">${[...STAGES, ...(d.stage === DROP ? [DROP] : [])]
        .map(s => `<button type="button" data-v="${esc(s)}" class="${d.stage === s ? 'on' : ''}${s === DROP ? ' warn' : ''}">${esc(stageKo(s))}</button>`).join('')}</div></div>
    <div class="field"><label>생산 라인 — 바꾸면 단계는 그대로 두고 그 라인으로 옮겨짐</label>
      <input type="hidden" id="f-tag" value="${esc(teamTag(d))}">
      <div class="btngroup" id="f-tag-g">${TEAM_TAGS
        .map(t => `<button type="button" data-v="${esc(t)}" class="${teamTag(d) === t ? 'on' : ''}">${esc(TEAM_LABEL[t] || t)}</button>`).join('')}</div></div>
    <div class="field"><label>핵심 메시지 — 이 콘텐츠가 남길 한 줄</label>
      <input id="f-key" value="${esc(d.key_message)}"></div>
    <div class="field"><label>채널</label><div class="chgroup" id="f-channels">
      ${channels.filter(c => c.active || (d.channels||[]).includes(c.label))
        .map(c => `<label><input type="checkbox" value="${esc(c.label)}" ${(d.channels||[]).includes(c.label)?'checked':''}>${esc(c.label)}</label>`).join('')
        || '<span class="u-sm2">설정 탭에서 채널을 먼저 추가하세요</span>'}
    </div></div>

    ${hasStyles() ? `<div class="field"><label>스타일 — 여러 개 선택 가능</label><div class="chgroup" id="f-styles">
      ${STYLES.map(s => `<label><input type="checkbox" value="${esc(s)}" ${styleList(d).includes(s) ? 'checked' : ''}>${esc(s)}</label>`).join('')}
    </div></div>` : ''}

    <div class="sect">담당과 일정</div>
    <div class="field"><label>담당자 — 여러 명 선택 가능</label><div class="chgroup tall" id="f-owners">
      ${team.filter(t => t.status === 'approved')
        .map(t => `<label><input type="checkbox" value="${t.id}" ${(d.owner_ids||[]).includes(t.id)?'checked':''}>${esc(t.name || t.email)}</label>`).join('')}
    </div></div>
    <div class="grid2">
      <div class="field"><label>CTA 댓글 키워드 — 한 단어</label>
        <input id="f-cta" value="${esc(d.cta_keyword)}" placeholder="라벨"></div>
      <div class="field"><label>CTA로 보낼 글 — 글쓰기의 비밀자료</label>
        <select id="f-ctapost"><option value="">— 연결 안 함 —</option>
          ${posts.map(p => `<option value="${p.id}" ${d.cta_post_id===p.id?'selected':''}>${esc((p.title||'(제목 없음)').slice(0,40))}${p.status==='published'?'':' (팀 전용)'}</option>`).join('')}
        </select>
        ${d.cta_post_id && posts.find(p => p.id === d.cta_post_id) ? (() => { const lp = posts.find(p => p.id === d.cta_post_id); return `<div class="note" style="margin-top:4px">열람 ${lp.view_count || 0}회 · ${lp.status==='published' ? `<a href="${esc(shareUrl(lp.slug))}" target="_blank" rel="noopener">보낼 링크</a>` : '팀 전용 — 글쓰기 목록의 🔗로 링크를 만드세요'}</div>`; })() : ''}</div>
      <div class="field"><label>촬영일</label><input type="date" id="f-shoot" value="${d.shoot_date||''}"></div>
    </div>
    <div class="grid2">
      <div class="field"><label>게시예정일</label><input type="date" id="f-pub" value="${d.publish_date||''}"></div>
      <div class="field"></div>
    </div>
    <div class="field"><label>다음 액션 — 지금 누가 뭘 해야 하는지</label>
      <input id="f-next" value="${esc(d.next_action)}"></div>

    <div class="sect">대본과 결과</div>
    <div class="field"><label>대본 · 메모 ${isNew ? '' : '<button type="button" class="chip" id="f-aiscript" style="margin-left:6px;font-size:11.5px">🤖 AI 대본 쓰기</button>'}</label><textarea id="f-script" style="min-height:150px">${esc(d.script)}</textarea></div>
    <div class="field"><label>게시 링크 — 실제 올라간 곳</label>
      <input id="f-url" value="${esc(d.publish_url)}" placeholder="https://"></div>
    <div class="field"><label>레퍼런스 링크 — 참고 자료·벤치마크</label>
      <input id="f-ref" value="${esc(d.reference_url)}" placeholder="https://"></div>
    ${(d.publish_url || d.reference_url) ? `<div class="field"><label>미리보기 — ${d.publish_url ? '게시물' : '레퍼런스'}</label>${kjReferenceMarkup(d.publish_url || d.reference_url, d.title || '콘텐츠')}</div>` : ''}
    ${!isNew && d.publish_url ? `<button class="btn sm ghost" id="f-sync">게시 링크에서 불러오기</button>
    <div id="f-sync-msg" style="margin-top:9px"></div>
    <p class="note">유튜브·인스타 게시 링크가 있으면 조회수·좋아요·댓글을 자동으로 채웁니다.
      ${d.stats_synced_at ? `마지막 수집 ${d.stats_synced_at.slice(0,16).replace('T',' ')}` : '아직 수집한 적이 없습니다.'}</p>` : ''}
    <div class="grid2">
      <div class="field"><label>조회수 ${d.publish_url ? '<span style="color:var(--blue)">· 자동</span>' : ''}</label>
        <input type="number" id="f-v" value="${d.views ?? ''}"></div>
      <div class="field"><label>좋아요 ${d.publish_url ? '<span style="color:var(--blue)">· 자동</span>' : ''}</label>
        <input type="number" id="f-lk" value="${d.likes ?? ''}"></div>
    </div>
    <div class="grid2">
      <div class="field"><label>댓글 ${d.publish_url ? '<span style="color:var(--blue)">· 자동</span>' : ''}</label>
        <input type="number" id="f-cm" value="${d.comments ?? ''}"></div>
      <div class="field"><label>저장 <span class="u-muted">· 직접 입력</span></label>
        <input type="number" id="f-s" value="${d.saves ?? ''}"></div>
    </div>
    <div class="grid2">
      <div class="field"><label>공유 <span class="u-muted">· 직접 입력</span></label>
        <input type="number" id="f-sh" value="${d.shares ?? ''}"></div>
      <div class="field"><label>링크 클릭 <span class="u-muted">· 직접 입력</span></label>
        <input type="number" id="f-lc" value="${d.link_clicks ?? ''}"></div>
    </div>
    <p class="note">저장·공유·링크클릭은 계정 소유자만 볼 수 있는 값이라 자동으로 못 가져옵니다.
      인스타 인사이트에서 보고 직접 넣어주세요.</p>

    <div class="drawer-actions">
      <button class="btn" id="dr-save">저장</button>
      <button class="btn ghost" id="dr-cancel">저장 안 함</button>
      ${(!isNew && d.stage !== DROP) ? '<button class="btn danger" id="dr-drop" style="margin-left:auto">드랍</button>' : ''}
      ${(!isNew && d.stage === DROP) ? '<button class="btn" id="dr-restore" style="margin-left:auto">아이디어 단계로 복구</button>' : ''}
      ${(!isNew && admin) ? '<button class="btn danger" id="dr-del">완전 삭제</button>' : ''}
    </div>`;

  // 현재 입력값을 한 덩어리로 읽는다 — 저장과 변경 감지에 함께 쓴다
  const collect = () => {
    const num = id => { const v = $(id).value.trim(); return v === '' ? null : Number(v); };
    return {
      title: $('#f-title').value.trim(),
      stage: $('#f-stage').value,
      team_tag: $('#f-tag').value || null,
      key_message: $('#f-key').value.trim() || null,
      channels: [...document.querySelectorAll('#f-channels input:checked')].map(i => i.value),
      ...(hasStyles() ? { styles: [...document.querySelectorAll('#f-styles input:checked')].map(i => i.value) } : {}),
      owner_ids: [...document.querySelectorAll('#f-owners input:checked')].map(i => i.value),
      cta_keyword: $('#f-cta').value.trim() || null,
      cta_post_id: $('#f-ctapost').value || null,
      shoot_date: $('#f-shoot').value || null,
      publish_date: $('#f-pub').value || null,
      next_action: $('#f-next').value.trim() || null,
      script: $('#f-script').value || null,
      publish_url: $('#f-url').value.trim() || null,
      reference_url: $('#f-ref').value.trim() || null,
      views: num('#f-v'), likes: num('#f-lk'), comments: num('#f-cm'),
      saves: num('#f-s'), shares: num('#f-sh'), link_clicks: num('#f-lc')
    };
  };

  const save = async () => {
    const payload = collect();
    if (!payload.title) {
      $('#dr-msg').innerHTML = '<div class="msg err">제목을 입력해 주세요.</div>';
      $('#f-title').focus();
      return false;
    }
    const res = isNew
      ? await sb.from('contents').insert({ ...payload, created_by: me.id })
      : await sb.from('contents').update(payload).eq('id', c.id);
    if (res.error) {
      $('#dr-msg').innerHTML = `<div class="msg err">${esc(cleanErr(res.error.message))}</div>`;
      return false;
    }
    return true;
  };

  const ctl = mountDrawer({ body, collect, save });
  const forceClose = ctl.forceClose;

  $('#dr-save').onclick = () => ctl.saveAndClose();
  if ($('#f-aiscript')) $('#f-aiscript').onclick = () => aiScript(cards.find(x => x.id === d.id) || d);   // v41
  $('#dr-cancel').onclick = () => ctl.discard();

  // v86 단계·생산 라인 버튼 — 고른 값은 숨은 input 에 담는다(저장·변경감지 코드는 그대로)
  const bindBtnGroup = (gid, inpId) => {
    const g = $(gid), inp = $(inpId);
    if (!g || !inp) return () => {};
    const paint = () => g.querySelectorAll('button[data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === inp.value));
    g.querySelectorAll('button[data-v]').forEach(b => b.onclick = () => {
      if (inp.value === b.dataset.v) return;
      inp.value = b.dataset.v; paint();
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    });
    paint(); return paint;
  };
  bindBtnGroup('#f-stage-g', '#f-stage');
  const paintTag = bindBtnGroup('#f-tag-g', '#f-tag');

  // 담당자 → 담당팀 자동(웰니스박스: 유현일·김호준 / 솔루션즈: 김주성·강민형·채진병). 담당팀을 직접 바꾸면 그 뒤로는 자동으로 안 바꿈
  { let manual = (isNew && !!d.team_tag) || (!!d.team_tag && d.team_tag !== (teamByOwners(d.owner_ids) || d.team_tag));   // v37: 라인에서 새로 만든 카드는 담당자를 골라도 라인 유지
    if ($('#f-tag')) $('#f-tag').addEventListener('change', () => { manual = true; });
    const box = $('#f-owners');
    if (box) box.addEventListener('change', () => { if (manual) return; const t = teamByOwners([...box.querySelectorAll('input:checked')].map(i => i.value)); if (t && $('#f-tag')) { $('#f-tag').value = t; paintTag(); } }); }

  if ($('#f-sync')) $('#f-sync').onclick = async () => {
    await runSync([c.id], '#f-sync-msg');
    const fresh = cards.find(x => x.id === c.id);
    if (fresh) {
      if (fresh.views    != null) $('#f-v').value  = fresh.views;
      if (fresh.likes    != null) $('#f-lk').value = fresh.likes;
      if (fresh.comments != null) $('#f-cm').value = fresh.comments;
    }
  };

  if ($('#dr-drop')) $('#dr-drop').onclick = async () => {
    forceClose();            // v92 확인창 없이 한 번에 드랍 — 토스트의 「되돌리기」로 되돌린다
    await dropNow(c.id);
  };

  if ($('#dr-restore')) $('#dr-restore').onclick = async () => {
    const { error } = await sb.from('contents').update({ stage: IDEA }).eq('id', c.id);
    if (error) return uiAlert(cleanErr(error.message));
    forceClose(); await refresh();
  };

  if ($('#dr-del')) $('#dr-del').onclick = async () => {
    if (!await uiConfirm('이 카드를 완전히 삭제합니다. 되돌릴 수 없습니다.\n보관만 원하시면 드랍을 쓰세요.', { ok: '완전히 삭제', danger: true })) return;
    const { error } = await sb.from('contents').delete().eq('id', c.id);
    if (error) return uiAlert(cleanErr(error.message));
    forceClose(); await refresh();
  };
}

// 헤더 높이를 재서 편집창 위치를 맞춘다
function syncHeaderHeight(){
  const h = document.querySelector('header');
  const px = (h && !$('#screen-app').classList.contains('hide')) ? h.offsetHeight : 0;
  document.documentElement.style.setProperty('--hh', px + 'px');
}
window.addEventListener('resize', syncHeaderHeight);
const _show = show;
show = function(w){ _show(w); setTimeout(syncHeaderHeight, 0); };

/* ---------------- Ctrl+클릭 새 창 열기 ----------------
   · 카드·표의 줄·일정·글·회의록을 Ctrl(맥은 Cmd)+클릭 또는 휠 클릭 → 새 창에서 그 항목이 열린 채로 뜬다
   · 카드 안의 링크는 어떤 클릭이든 링크만 열리고 카드는 열리지 않는다
-------------------------------------------------------- */
function deepLink(kind, id){
  return `${location.origin}${location.pathname}?open=${kind}:${encodeURIComponent(id)}`;
}

// 눌린 자리에서 "무엇을 여는 요소인지" 찾는다
function openTargetOf(el){
  if (!el || !el.closest) return null;
  const pick = (sel, kind, key) => {
    const n = el.closest(sel);
    return n ? { kind, id: n.dataset[key] } : null;
  };
  return pick('.card[data-id]', 'card', 'id')
      || pick('[data-insrow]', 'card', 'insrow')
      || pick('[data-open]', 'card', 'open')
      || pick('[data-tdopen]', 'todo', 'tdopen')
      || pick('[data-mt]', 'meeting', 'mt')
      || pick('[data-po]', 'post', 'po')
      || pick('[data-edit]', 'member', 'edit')
      || pick('[data-edit2]', 'member', 'edit2');
}

function isPlainLink(el){
  const a = el && el.closest && el.closest('a[href]');
  if (!a) return null;
  if (a.closest('[contenteditable="true"]')) return null;   // 편집 중인 본문 속 링크는 제외
  return a;
}

// 캡처 단계에서 먼저 가로챈다 — 카드의 원래 클릭 동작보다 앞선다
document.addEventListener('click', e => {
  // ① 링크는 링크로만 동작 — 카드가 같이 열리지 않게
  const a = isPlainLink(e.target);
  if (a) {
    e.stopPropagation();
    // Ordinary production-reference clicks preview here; modifiers retain native new-tab behavior.
    if (a.hasAttribute('data-production-ref') && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
      e.preventDefault();
      kjOpenProductionReference(a.href, a.dataset.refTitle);
      return;
    }
    if (!a.target) a.target = '_blank';
    a.rel = 'noopener';
    return;                                // 기본 동작(새 탭 열기)은 그대로 둔다
  }
  // ② Ctrl/Cmd+클릭 — 새 창으로
  if (!(e.ctrlKey || e.metaKey)) return;
  if (e.target.closest && e.target.closest('input,select,textarea,button,[contenteditable="true"]')) return;
  const t = openTargetOf(e.target);
  if (!t || !t.id) return;
  e.preventDefault();
  e.stopPropagation();
  window.open(deepLink(t.kind, t.id), '_blank');
}, true);

// 휠(가운데) 버튼 클릭도 새 창으로
document.addEventListener('auxclick', e => {
  if (e.button !== 1) return;
  if (isPlainLink(e.target)) return;       // 링크는 브라우저가 알아서 새 탭으로 연다
  const t = openTargetOf(e.target);
  if (!t || !t.id) return;
  e.preventDefault();
  window.open(deepLink(t.kind, t.id), '_blank');
}, true);
document.addEventListener('mousedown', e => {
  if (e.button === 1 && openTargetOf(e.target) && !isPlainLink(e.target)) e.preventDefault(); // 자동 스크롤 방지
}, true);

/* ---------------- 우클릭 메뉴 (v30) ----------------
   카드·표의 줄·일정·글·할 일·회의록·팀원 위에서 우클릭 → 바로 쓰는 동작 메뉴
   입력칸·본문 편집·일반 링크 위에서는 브라우저 기본 메뉴(복사·붙여넣기)를 그대로 쓴다
-------------------------------------------------------- */
function closeCtx(){ const m = document.querySelector('.kjctx'); if (m) m.remove(); }
document.addEventListener('contextmenu', e => {
  closeCtx();
  if (e.shiftKey) return;                                   // Shift+우클릭 = 브라우저 기본 메뉴
  if (e.target.closest && e.target.closest('input,select,textarea,[contenteditable="true"],.kjctx')) return;
  if (isPlainLink(e.target)) return;
  const t = openTargetOf(e.target);
  if (!t || !t.id) return;
  e.preventDefault();
  const kindKo = { card:'콘텐츠', post:'글', todo:'할 일', meeting:'회의록', member:'팀원' }[t.kind] || '';
  const obj = t.kind === 'card' ? cards.find(x => x.id === t.id)
    : t.kind === 'post' ? posts.find(x => x.id === t.id)
    : t.kind === 'todo' ? todos.find(x => x.id === t.id)
    : t.kind === 'meeting' ? meetings.find(x => x.id === t.id)
    : team.find(x => x.id === t.id);
  if (!obj) return;
  const opener = { card: () => openCard(obj), post: () => openPost(obj), todo: () => openTodo(obj), meeting: () => openMeeting(obj), member: () => openMember(obj) }[t.kind];
  const items = [];   // [label, fn, cls]
  items.push(['📂 열기', opener]);
  if (t.kind !== 'member') {
    items.push(['🗗 새 창에서 열기', () => window.open(deepLink(t.kind, t.id), '_blank')]);
    items.push(['🔗 워크스페이스 링크 복사', async () => poToast(await copyText(deepLink(t.kind, t.id)) ? '링크를 복사했습니다.' : '복사하지 못했습니다: ' + deepLink(t.kind, t.id), 3500)]);
  }
  if (t.kind === 'post') items.push(['📨 보낼 링크 복사', () => copyPostLink(obj)]);
  if (t.kind === 'card' && obj.publish_url) items.push(['▶ 게시물 열기', () => window.open(obj.publish_url, '_blank', 'noopener')]);
  if (t.kind === 'card') items.push(['📝 대본 다운로드 (docx)', () => scriptDownload([obj])]);
  if (t.kind === 'card') items.push(['🤖 AI 대본 쓰기', () => aiScript(obj)]);
  // v32: 정리 필요 등에서 바로 처리 — 게시완료·계속 진행·삭제
  if (t.kind === 'card' && obj.stage !== DONE) items.push(['✅ 게시완료로', async () => {
    const { error } = await sb.from('contents').update({ stage: DONE, publish_date: obj.publish_date || new Date().toISOString().slice(0, 10), updated_at: new Date().toISOString() }).eq('id', obj.id);
    if (error) return uiAlert(cleanErr(error.message)); await refresh(); poToast('게시완료로 옮겼습니다.', 2500);
  }]);
  if (t.kind === 'card') items.push(['⏩ 계속 진행 (오늘로 갱신)', async () => {
    const { error } = await sb.from('contents').update({ updated_at: new Date().toISOString() }).eq('id', obj.id);
    if (error) return uiAlert(cleanErr(error.message)); await refresh();
  }]);
  if (t.kind === 'card' && isAdmin()) items.push(['🗑 완전히 삭제', async () => {
    if (!await uiConfirm(`"${obj.title}" 카드를 완전히 삭제합니다. 되돌릴 수 없습니다.\n보관만 원하시면 단계 이동의 '드랍'을 쓰세요.`, { ok: '완전히 삭제', danger: true })) return;
    const { error } = await sb.from('contents').delete().eq('id', obj.id);
    if (error) return uiAlert(cleanErr(error.message)); await refresh(); poToast('삭제했습니다.', 2500);
  }, 'danger']);
  if (t.kind === 'todo') items.push([obj.done ? '↩ 완료 취소' : '✔ 완료로 표시', async () => {
    const { error } = await sb.from('todos').update({ done: !obj.done, done_at: obj.done ? null : new Date().toISOString() }).eq('id', obj.id);
    if (error) return uiAlert(cleanErr(error.message)); await refresh();
  }]);

  const m = document.createElement('div'); m.className = 'kjctx';
  m.innerHTML = `<div class="h">${esc(kindKo)} · ${esc((obj.title || obj.name || obj.email || '').slice(0, 40))}</div>`
    + items.map((x, i) => `<button class="it ${x[2] || ''}" data-ci="${i}">${x[0]}</button>`).join('')
    + (t.kind === 'card' ? `<div class="sep"></div><div class="h">단계 이동</div>
        <div class="stg">${[...STAGES, DROP].map(s => `<button data-cs="${esc(s)}" class="${obj.stage === s ? 'on' : ''}">${esc(stageKo(s))}</button>`).join('')}</div>
        <div class="h">라인 옮기기 (단계 그대로)</div><div class="stg">${TEAM_TAGS.map(t => `<button data-ct="${t}" class="${teamTag(obj) === t ? 'on' : ''}">${TEAM_LABEL[t]}</button>`).join('')}</div>
        <div class="h">게시예정일</div><input type="date" data-cd value="${obj.publish_date || ''}">` : '');
  document.body.appendChild(m);
  const W = m.offsetWidth, H = m.offsetHeight;
  m.style.left = Math.max(6, Math.min(e.clientX, innerWidth - W - 6)) + 'px';
  m.style.top = Math.max(6, Math.min(e.clientY, innerHeight - H - 6)) + 'px';
  m.querySelectorAll('[data-ci]').forEach(b => b.onclick = () => { closeCtx(); items[+b.dataset.ci][1](); });
  m.querySelectorAll('[data-cs]').forEach(b => b.onclick = async () => {
    const s = b.dataset.cs; closeCtx();
    if (s === obj.stage) return;
    if (s === DROP) return dropNow(obj.id);
    await moveStage(obj.id, s);
  });
  m.querySelectorAll('[data-ct]').forEach(b => b.onclick = async () => {
    closeCtx(); await moveLine(obj.id, b.dataset.ct);
  });
  const di = m.querySelector('[data-cd]');
  if (di) di.onchange = async () => {
    const v = di.value || null; closeCtx();
    const { error } = await sb.from('contents').update({ publish_date: v }).eq('id', obj.id);
    if (error) return uiAlert(cleanErr(error.message)); await refresh();
  };
}, true);
document.addEventListener('mousedown', e => { if (!(e.target.closest && e.target.closest('.kjctx'))) closeCtx(); }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCtx(); });
window.addEventListener('scroll', closeCtx, true);
window.addEventListener('resize', closeCtx);

// 주소의 ?open=종류:ID 를 읽어 해당 화면으로 가서 연다
function openFromUrl(){
  const q = new URLSearchParams(location.search).get('open');
  if (!q || !q.includes(':')) return;
  const [kind, raw] = q.split(':');
  const id = decodeURIComponent(raw || '');

  const goTab = v => {
    const b = document.querySelector(`nav button[data-view="${v}"]`);
    if (b && !b.classList.contains('hide')) b.click();
  };

  if (kind === 'card') {
    const c = cards.find(x => x.id === id);
    if (!c) return uiAlert('해당 카드를 찾지 못했습니다. 삭제됐거나 권한이 없을 수 있습니다.');
    if (c.stage === PLANNED || c.stage === DONE) goTab('schedule');
    else if (c.stage === DROP) goTab('drops');
    setTimeout(() => openCard(c), 0);
  } else if (kind === 'todo') {
    const t = todos.find(x => x.id === id);
    goTab('todo'); if (t) setTimeout(() => openTodo(t), 0);
  } else if (kind === 'meeting') {
    const m = meetings.find(x => x.id === id);
    goTab('meetings'); if (m) setTimeout(() => openMeeting(m), 0);
  } else if (kind === 'post') {
    const p = posts.find(x => x.id === id);
    goTab('posts'); if (p) setTimeout(() => openPost(p), 0);
  } else if (kind === 'member' && isAdmin()) {
    const t = team.find(x => x.id === id);
    goTab('team'); if (t) setTimeout(() => openMember(t), 0);
  }

  // 새로고침해도 다시 열리지 않게 주소를 정리한다
  history.replaceState(null, '', location.pathname);
}

boot();

