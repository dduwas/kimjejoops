'use strict';
// 김제조 웍스 — 할 일·회의록·드랍·팀 관리·내 계정·설정  (v88에서 index.html 에서 분리)
/* ---------------- 할 일 (게시판) ---------------- */
let tdFilter = 'open';

function renderTodos(){
  const today = new Date().toISOString().slice(0,10);
  let rows = todos.filter(t => {
    if (tdFilter === 'open') return !t.done;
    if (tdFilter === 'done') return t.done;
    if (tdFilter === 'mine') return !t.done && (t.owner_ids || []).includes(me.id);
    return true;
  });

  const rank = { '높음':0, '보통':1, '낮음':2 };
  rows.sort((a,b) =>
    (a.done - b.done) ||
    (a.due_date || '9999').localeCompare(b.due_date || '9999') ||
    (rank[a.priority] - rank[b.priority]));

  const open = todos.filter(t => !t.done);
  const late = open.filter(t => t.due_date && t.due_date < today).length;
  $('#todo-count').textContent =
    `진행 중 ${open.length}개 · 완료 ${todos.length - open.length}개` + (late ? ` · 기한 지남 ${late}개` : '');

  $('#todo-list').innerHTML = rows.length ? `<table>
    <tr><th style="width:44px">완료</th><th>할 일</th><th>담당</th><th>기한</th><th>우선순위</th><th>작성</th></tr>
    ${rows.map(t => {
      const overdue = !t.done && t.due_date && t.due_date < today;
      return `<tr class="${t.done?'is-done':''}">
        <td><input type="checkbox" class="tdchk" data-toggle="${t.id}" ${t.done?'checked':''}></td>
        <td data-tdopen="${t.id}" style="cursor:pointer">
          <b class="todo-t">${esc(t.title)}</b>
          ${t.memo ? `<br><span class="u-sm">${esc(t.memo.split('\n')[0]).slice(0,60)}${t.memo.length>60?'…':''}</span>` : ''}
          ${t.meeting_id ? '<br><span style="font-size:11.5px;color:var(--blue)">회의록에서 옮김</span>' : ''}
        </td>
        <td style="font-size:12.5px">${esc(ownerNames(t.owner_ids))}</td>
        <td style="font-variant-numeric:tabular-nums;white-space:nowrap;font-size:12.5px"
            class="${overdue?'od':''}">${t.due_date || '—'}${overdue?'<br><span class="pill rejected">지남</span>':''}</td>
        <td><span class="pri p-${t.priority}">${t.priority}</span></td>
        <td style="font-size:11.5px;color:var(--muted);white-space:nowrap">${(t.created_at||'').slice(0,10)}</td>
      </tr>`;
    }).join('')}
  </table>
  <p class="note">제목을 누르면 열려서 내용을 고칠 수 있습니다. 왼쪽 체크로 바로 완료 처리됩니다.</p>`
  : `<div class="empty">${tdFilter==='done' ? '완료한 할 일이 없습니다.' : '할 일이 없습니다.<br>위 버튼으로 하나 만들어 보세요.'}</div>`;

  $$('#todo-list [data-toggle]').forEach(el => el.onchange = async e => {
    e.stopPropagation();
    const { error } = await sb.from('todos').update({ done: el.checked }).eq('id', el.dataset.toggle);
    if (error) uiAlert(cleanErr(error.message));
    await refresh();
  });
  $$('#todo-list [data-tdopen]').forEach(el =>
    el.onclick = () => openTodo(todos.find(t => t.id === el.dataset.tdopen)));
}

$('#td-new').onclick = () => openTodo(null);
$$('.td-f').forEach(b => b.onclick = () => {
  $$('.td-f').forEach(x => x.classList.remove('on'));
  b.classList.add('on'); tdFilter = b.dataset.f; renderTodos();
});

function openTodo(t){
  const isNew = !t;
  const d = t || { title:'', owner_ids:[], due_date:'', priority:'보통', memo:'', done:false };

  const body = `
    <h2>${isNew ? '새 할 일' : esc(d.title)}</h2>
    <div class="sub">${isNew ? '제목만 있어도 저장됩니다.' : (d.done ? '완료됨' : '진행 중')}</div>
    <div id="dr-msg"></div>

    <div class="field"><label>할 일</label><input id="t-title" value="${esc(d.title)}"></div>
    <div class="grid2">
      <div class="field"><label>기한</label><input type="date" id="t-due" value="${d.due_date || ''}"></div>
      <div class="field"><label>우선순위</label><select id="t-pri">
        ${['높음','보통','낮음'].map(p => `<option ${d.priority===p?'selected':''}>${p}</option>`).join('')}
      </select></div>
    </div>
    <div class="field"><label>담당자 — 여러 명 선택 가능</label><div class="chgroup tall" id="t-owners">
      ${team.filter(x => x.status === 'approved')
        .map(x => `<label><input type="checkbox" value="${x.id}" ${(d.owner_ids||[]).includes(x.id)?'checked':''}>${esc(x.name || x.email)}</label>`).join('')}
    </div></div>
    <div class="field"><label>내용 · 메모</label><textarea id="t-memo" style="min-height:170px">${esc(d.memo)}</textarea></div>
    <label class="check" style="max-width:180px"><input type="checkbox" id="t-done" ${d.done?'checked':''}>완료 처리</label>

    <div class="drawer-actions">
      <button class="btn" id="t-save">저장</button>
      <button class="btn ghost" id="t-cancel">저장 안 함</button>
      ${!isNew ? '<button class="btn danger" id="t-del" style="margin-left:auto">삭제</button>' : ''}
    </div>`;

  const collect = () => ({
    title: $('#t-title').value.trim(),
    due_date: $('#t-due').value || null,
    priority: $('#t-pri').value,
    owner_ids: [...document.querySelectorAll('#t-owners input:checked')].map(i => i.value),
    memo: $('#t-memo').value || null,
    done: $('#t-done').checked
  });

  const save = async () => {
    const payload = collect();
    if (!payload.title) {
      $('#dr-msg').innerHTML = '<div class="msg err">할 일 내용을 입력해 주세요.</div>';
      $('#t-title').focus(); return false;
    }
    const res = isNew
      ? await sb.from('todos').insert({ ...payload, created_by: me.id })
      : await sb.from('todos').update(payload).eq('id', t.id);
    if (res.error) { $('#dr-msg').innerHTML = `<div class="msg err">${esc(cleanErr(res.error.message))}</div>`; return false; }
    return true;
  };

  const ctl = mountDrawer({ body, collect, save });

  $('#t-save').onclick = () => ctl.saveAndClose();
  $('#t-cancel').onclick = () => ctl.discard();
  if ($('#t-del')) $('#t-del').onclick = async () => {
    if (!await uiConfirm('이 할 일을 삭제합니다.', { ok: '삭제', danger: true })) return;
    const { error } = await sb.from('todos').delete().eq('id', t.id);
    if (error) return uiAlert(cleanErr(error.message));
    ctl.forceClose(); await refresh();
  };
}

/* ---------------- 회의록 ---------------- */
function renderMeetings(){
  $('#meeting-list').innerHTML = meetings.length ? meetings.map(m => `
    <div class="mtcard" data-mt="${m.id}">
      <div class="mt-head">
        <div>
          <b>${esc(m.title)}</b>
          <span style="font-size:12px;color:var(--muted);margin-left:9px">${m.met_on || '날짜 미정'}</span>
        </div>
        <span class="u-sm">
          ${(m.files || []).length ? `첨부 ${(m.files||[]).length}개 · ` : ''}${esc(ownerNames(m.attendee_ids))}</span>
      </div>
      ${m.summary ? `<div class="mt-sum">${summaryPreview(m.summary)}</div>`
                  : '<div class="mt-sum" style="color:var(--muted)">아직 정리하지 않았습니다. 눌러서 열어보세요.</div>'}
    </div>`).join('')
    : '<div class="empty">회의록이 없습니다.<br>위 버튼으로 첫 회의록을 만드세요.</div>';

  $$('#meeting-list [data-mt]').forEach(el =>
    el.onclick = () => openMeeting(meetings.find(m => m.id === el.dataset.mt)));
}

$('#mt-new').onclick = () => openMeeting(null);

// 목록에서는 글자만 보여준다 (이미지는 열어야 보인다)
function summaryPreview(html){
  const tmp = document.createElement('div');
  tmp.innerHTML = html || '';
  const nImg = tmp.querySelectorAll('img').length;
  tmp.querySelectorAll('img').forEach(i => i.remove());
  const text = (tmp.innerText || '').trim();
  const head = esc(text.slice(0, 180)).replace(/\n/g, '<br>') + (text.length > 180 ? '…' : '');
  const tag = nImg ? `<span style="color:var(--blue);font-size:12px">이미지 ${nImg}개</span>` : '';
  return (head || '<span class="u-muted">내용 없음</span>') + (tag ? '<br>' + tag : '');
}

function openMeeting(m){
  const isNew = !m;
  const d = m || { title:'', met_on:new Date().toISOString().slice(0,10),
                   attendee_ids:[], raw_text:'', summary:'', actions:'', files:[] };

  const body = `
    <h2>${isNew ? '새 회의록' : esc(d.title)}</h2>
    <div class="sub">결론과 액션 칸에는 이미지도 넣을 수 있습니다. 캡처한 뒤 Ctrl+V 로 붙여넣으세요.</div>
    <div id="dr-msg"></div>

    <div class="field"><label>회의 제목</label><input id="m-title" value="${esc(d.title)}"></div>
    <div class="field"><label>회의 날짜</label><input type="date" id="m-date" value="${d.met_on || ''}"></div>
    <div class="field"><label>참석자</label><div class="chgroup tall" id="m-att">
      ${team.filter(t => t.status === 'approved').map(t =>
        `<label><input type="checkbox" value="${t.id}" ${(d.attendee_ids||[]).includes(t.id)?'checked':''}>${esc(t.name || t.email)}</label>`).join('')}
    </div></div>

    <div class="sect">첨부 파일</div>
    <div id="m-files">${filesHTML(d.files || [])}</div>
    <input type="file" id="m-file-input" multiple style="margin-top:9px;font-size:13px">
    <p class="note">파일 하나당 50MB까지 올릴 수 있습니다. 올린 파일은 승인된 팀원만 열람할 수 있습니다.</p>

    <div class="sect">회의 대본</div>
    <div class="field"><textarea id="m-raw" style="min-height:200px" placeholder="회의 내용을 그대로 붙여넣으세요. 녹취록이어도 됩니다.">${esc(d.raw_text)}</textarea></div>

    <div class="sect">핵심 결론</div>
    <div class="rich" id="m-sum" contenteditable="true" data-ph="결정된 내용을 적으세요. 이미지는 Ctrl+V 로 붙여넣습니다."></div>
    <div class="richbar">
      <button class="btn sm ghost" data-pick="m-sum">이미지 넣기</button>
      <span class="richhint">캡처 후 Ctrl+V 로도 들어갑니다</span>
    </div>

    <div class="sect">다음 액션</div>
    <div class="rich" id="m-act" contenteditable="true" data-ph="- [담당자] 할 일 내용"></div>
    <div class="richbar">
      <button class="btn sm ghost" data-pick="m-act">이미지 넣기</button>
      <button class="btn sm ghost" id="m-to-todo">액션을 할 일로 보내기</button>
    </div>
    <p class="note">"- [담당자] 내용" 형태의 줄만 할 일로 옮깁니다. 담당자 이름이 팀 명단과 같으면 자동 배정됩니다.<br>
      이미지는 승인된 팀원만 볼 수 있습니다.</p>

    <div class="drawer-actions">
      <button class="btn" id="m-save">저장</button>
      <button class="btn ghost" id="m-cancel">저장 안 함</button>
      ${(!isNew && isAdmin()) ? '<button class="btn danger" id="m-del" style="margin-left:auto">삭제</button>' : ''}
    </div>`;

  let files = [...(d.files || [])];

  const collect = () => ({
    title: $('#m-title').value.trim(),
    met_on: $('#m-date').value || null,
    attendee_ids: [...document.querySelectorAll('#m-att input:checked')].map(i => i.value),
    raw_text: $('#m-raw').value || null,
    summary: richOut('#m-sum'),
    actions: richOut('#m-act'),
    files
  });
  const mtMsg = (t2, k='err') => $('#dr-msg').innerHTML = `<div class="msg ${k}">${esc(t2)}</div>`;

  const save = async () => {
    const payload = collect();
    if (!payload.title) { mtMsg('회의 제목을 입력해 주세요.'); $('#m-title').focus(); return false; }
    const res = isNew
      ? await sb.from('meetings').insert({ ...payload, created_by: me.id })
      : await sb.from('meetings').update(payload).eq('id', m.id);
    if (res.error) { mtMsg(cleanErr(res.error.message)); return false; }
    return true;
  };

  const ctl = mountDrawer({ body, collect, save });
  const forceClose = ctl.forceClose;

  $('#m-save').onclick = () => ctl.saveAndClose();
  $('#m-cancel').onclick = () => ctl.discard();

  // 이미지가 들어가는 두 칸을 준비한다
  const pickers = {};
  ['#m-sum', '#m-act'].forEach(sel => { pickers[sel] = wireRich(sel, mtMsg); });

  $$('[data-pick]').forEach(b => b.onclick = () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = () => { const f = inp.files[0]; if (f) pickers['#' + b.dataset.pick](f); };
    inp.click();
  });

  // 저장된 내용을 채운다. 이때 dirty 기준도 다시 잡는다.
  (async () => {
    await richIn('#m-sum', d.summary);
    await richIn('#m-act', d.actions);
    ctl.resetBaseline();
  })();

  // 파일 업로드
  $('#m-file-input').onchange = async e => {
    const list = [...e.target.files];
    for (const f of list) {
      if (f.size > 50 * 1024 * 1024) { mtMsg(`${f.name} 은 50MB를 넘습니다.`); continue; }
      const path = `${Date.now()}_${Math.random().toString(36).slice(2,8)}_${f.name}`;
      mtMsg(`${f.name} 올리는 중…`, 'ok');
      const { error } = await sb.storage.from('meeting-files').upload(path, f);
      if (error) { mtMsg(`${f.name} 업로드 실패: ${cleanErr(error.message)}`); continue; }
      files.push({ name: f.name, path, size: f.size });
    }
    $('#m-files').innerHTML = filesHTML(files);
    wireFiles();
    $('#m-file-input').value = '';
    mtMsg('올렸습니다. 저장을 눌러야 회의록에 남습니다.', 'ok');
  };

  function wireFiles(){
    $$('#m-files [data-dl]').forEach(b => b.onclick = async () => {
      const { data, error } = await sb.storage.from('meeting-files')
        .createSignedUrl(b.dataset.dl, 60);
      if (error) return uiAlert(cleanErr(error.message));
      window.open(data.signedUrl, '_blank');
    });
    $$('#m-files [data-rm]').forEach(b => b.onclick = async () => {
      if (!await uiConfirm('이 파일을 지웁니다.', { ok: '지우기', danger: true })) return;
      await sb.storage.from('meeting-files').remove([b.dataset.rm]);
      files = files.filter(f => f.path !== b.dataset.rm);
      $('#m-files').innerHTML = filesHTML(files); wireFiles();
    });
  }
  wireFiles();

  // 액션 → 할 일
  $('#m-to-todo').onclick = async () => {
    const all = ($('#m-act').innerText || '').split('\n');
    // "## 다음 액션" 아래부터, 다음 "##" 을 만나기 전까지만 읽는다
    let started = all.findIndex(l => l.trim().startsWith('##')) === -1;
    const lines = [];
    for (const raw of all) {
      const l = raw.trim();
      if (l.startsWith('##')) { started = l.includes('다음 액션'); continue; }
      if (!started) continue;
      if (l.startsWith('-') || l.startsWith('•')) lines.push(l);
    }
    if (!lines.length) return mtMsg('옮길 액션 줄을 찾지 못했습니다.');

    const rows = lines.map(l => {
      const body = l.replace(/^[-•]\s*/, '');
      const hit = body.match(/^\[([^\]]+)\]\s*(.*)$/);
      let owners = [], title = body;
      if (hit) {
        title = (hit[2] || '').trim() || body;
        const who = hit[1].trim();
        const p = team.find(t => t.status === 'approved' && (t.name || '') === who);
        if (p) owners = [p.id];
      }
      return { title, owner_ids: owners, priority: '보통',
               meeting_id: isNew ? null : m.id, created_by: me.id };
    }).filter(r => r.title && r.title !== '없음');

    if (!rows.length) return mtMsg('옮길 액션이 없습니다.');
    if (!await uiConfirm(`${rows.length}개를 할 일로 보냅니다.`, { ok: '보내기' })) return;
    const { error } = await sb.from('todos').insert(rows);
    if (error) return mtMsg(cleanErr(error.message));
    mtMsg(`${rows.length}개를 할 일 탭으로 보냈습니다.`, 'ok');
    await refresh();
  };

  if ($('#m-del')) $('#m-del').onclick = async () => {
    if (!await uiConfirm('이 회의록을 삭제합니다. 되돌릴 수 없습니다.', { ok: '삭제', danger: true })) return;
    const { error } = await sb.from('meetings').delete().eq('id', m.id);
    if (error) return uiAlert(cleanErr(error.message));
    forceClose(); await refresh();
  };
}

/* ---------------- 이미지가 들어가는 편집 영역 ----------------
   저장할 때는 주소 대신 파일 위치만 남긴다. 주소는 시간이 지나면 만료되기 때문이다.
   화면에 보여줄 때마다 새 주소를 받아 붙인다.
------------------------------------------------------------------ */

// 저장된 내용 → 편집 영역에 채우기 (이미지 주소를 새로 발급)
async function richIn(sel, stored){
  const box = $(sel);
  if (!box) return;
  const raw = stored || '';
  // 예전에 저장된 일반 텍스트는 줄바꿈만 살려서 보여준다
  box.innerHTML = raw.includes('<') ? raw : esc(raw).replace(/\n/g, '<br>');

  const imgs = [...box.querySelectorAll('img[data-path]')];
  for (const img of imgs) {
    try {
      const { data } = await sb.storage.from('meeting-files')
        .createSignedUrl(img.dataset.path, 60 * 60 * 24 * 7);
      if (data?.signedUrl) img.src = data.signedUrl;
    } catch { img.alt = '이미지를 불러오지 못했습니다'; }
  }
}

// 편집 영역 → 저장할 내용 (주소를 지우고 위치만 남김)
function richOut(sel){
  const box = $(sel);
  if (!box) return null;
  const tmp = document.createElement('div');
  tmp.innerHTML = box.innerHTML;
  tmp.querySelectorAll('img').forEach(img => {
    if (img.dataset.path) img.removeAttribute('src');
    else img.remove();               // 위치를 모르는 이미지는 버린다
  });
  tmp.querySelectorAll('script,style,iframe,object,embed').forEach(el => el.remove());
  const html = tmp.innerHTML.trim();
  return html || null;
}

// 편집 영역에 붙여넣기·이미지 넣기 연결
function wireRich(sel, onMsg){
  const box = $(sel);
  if (!box) return;

  const insertImage = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 10 * 1024 * 1024) { onMsg('이미지는 10MB까지 넣을 수 있습니다.'); return; }

    const ext = (file.type.split('/')[1] || 'png').replace('jpeg','jpg');
    const path = `img_${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
    onMsg('이미지 올리는 중…', 'ok');

    const { error } = await sb.storage.from('meeting-files')
      .upload(path, file, { contentType: file.type });
    if (error) { onMsg('이미지 업로드 실패: ' + cleanErr(error.message)); return; }

    const { data } = await sb.storage.from('meeting-files')
      .createSignedUrl(path, 60 * 60 * 24 * 7);

    const img = document.createElement('img');
    img.dataset.path = path;
    img.src = data?.signedUrl || '';
    img.alt = '';

    // 커서 위치에 넣는다. 위치를 모르면 맨 뒤에 붙인다.
    const selNow = window.getSelection();
    if (selNow && selNow.rangeCount && box.contains(selNow.anchorNode)) {
      const r = selNow.getRangeAt(0);
      r.deleteContents();
      r.insertNode(img);
      r.setStartAfter(img); r.collapse(true);
      selNow.removeAllRanges(); selNow.addRange(r);
    } else {
      box.appendChild(img);
    }
    box.appendChild(document.createElement('br'));
    onMsg('이미지를 넣었습니다. 저장을 눌러야 남습니다.', 'ok');
  };

  // Ctrl+V 로 클립보드 이미지 붙여넣기
  box.onpaste = async e => {
    const items = [...(e.clipboardData?.items || [])];
    const imgItem = items.find(i => i.type.startsWith('image/'));
    if (imgItem) {
      e.preventDefault();
      await insertImage(imgItem.getAsFile());
      return;
    }
    // 글자는 서식을 떼고 넣는다
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  // 파일을 끌어다 놓아도 들어간다
  box.ondragover = e => { e.preventDefault(); box.classList.add('dragging'); };
  box.ondragleave = () => box.classList.remove('dragging');
  box.ondrop = async e => {
    e.preventDefault(); box.classList.remove('dragging');
    const f = [...(e.dataTransfer?.files || [])].find(x => x.type.startsWith('image/'));
    if (f) await insertImage(f);
  };

  return insertImage;
}

function filesHTML(files){
  if (!files.length) return '<div class="u-sm2">첨부된 파일이 없습니다.</div>';
  return files.map(f => `<div class="filerow">
    <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">${esc(f.name)}</span>
    <span style="font-size:11.5px;color:var(--muted)">${Math.round((f.size||0)/1024).toLocaleString()}KB</span>
    <button class="btn sm ghost" data-dl="${esc(f.path)}">열기</button>
    <button class="btn sm danger" data-rm="${esc(f.path)}">삭제</button>
  </div>`).join('');
}

/* ---------------- 드랍 게시판 ---------------- */
function renderDrops(){
  const rows = cards.filter(c => c.stage === DROP)
    .sort((a,b) => (b.dropped_at || b.updated_at || '').localeCompare(a.dropped_at || a.updated_at || ''));

  $('#drop-list').innerHTML = rows.length ? `<table>
    <tr><th>드랍한 날</th><th>콘텐츠</th><th>채널</th><th>담당</th><th></th></tr>
    ${rows.map(c => {
      const when = (c.dropped_at || c.updated_at || '').slice(0,10);
      return `<tr>
        <td style="font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--muted)">${when || '—'}</td>
        <td data-open="${c.id}" style="cursor:pointer">${tagHTML(c)}<b>${esc(c.title)}</b>
          ${c.key_message ? `<br><span class="u-sm">${esc(c.key_message)}</span>` : ''}</td>
        <td class="u-sm">${esc((c.channels || []).join(', ') || '—')}</td>
        <td style="font-size:12.5px">${esc(ownerNames(c.owner_ids))}</td>
        <td class="u-nowrap"><button class="btn sm" data-restore="${c.id}">아이디어 단계로 복구</button></td>
      </tr>`;
    }).join('')}
  </table>
  <p class="note">복구하면 생산 라인의 아이디어 칸으로 돌아갑니다. 적어둔 내용은 그대로 남아 있습니다.</p>`
  : '<div class="empty">드랍한 기획이 없습니다.<br>카드를 열면 아래쪽에 드랍 버튼이 있습니다.</div>';

  $$('#drop-list [data-open]').forEach(el =>
    el.onclick = () => openCard(cards.find(c => c.id === el.dataset.open)));
  $$('#drop-list [data-restore]').forEach(b => b.onclick = async () => {
    const c = cards.find(x => x.id === b.dataset.restore);   // v101 되돌릴 수 있는 일은 묻지 않는다
    await moveStage(c.id, IDEA);
    uiToast('되살림: ' + String(c.title || '').slice(0, 24) + ' · 아이디어에 있습니다',
      { action: { label: '되돌리기', run: () => moveStage(c.id, DROP) } });
  });
}

/* ---------------- 팀 관리 ---------------- */
function renderTeam(){
  if (!isAdmin()) return;
  const order = { pending:0, approved:1, suspended:2, rejected:3 };
  const rows = [...team].sort((a,b) =>
    (order[a.status]-order[b.status]) || a.created_at.localeCompare(b.created_at));

  $('#team-list').innerHTML = `<table>
    <tr><th>이름 · 아이디</th><th>회사 · 직책</th><th>권한</th><th>상태</th><th></th></tr>
    ${rows.map(t => {
      const locked = (t.role === 'master' && !isMaster()) || t.id === me.id;
      return `<tr>
      <td data-edit="${t.id}" style="cursor:pointer">
        <b>${esc(t.name || '(이름 없음)')}</b>
        <br><span style="color:var(--muted);font-size:12px">${esc(t.email)}</span></td>
      <td data-edit="${t.id}" style="cursor:pointer">${esc(t.company || '—')}
        <br><span style="color:var(--muted);font-size:12px">${esc(t.role_title || '')}</span></td>
      <td><select class="mini" data-role="${t.id}" ${locked?'disabled':''}>
        ${Object.entries(ROLES).filter(([k]) => k !== 'master' || isMaster())
          .map(([k,v]) => `<option value="${k}" ${t.role===k?'selected':''}>${v}</option>`).join('')}
      </select></td>
      <td><span class="pill ${t.status}">${STATUS_KO[t.status]}</span></td>
      <td class="u-nowrap">
        ${(t.status !== 'approved' && !locked) ? `<button class="btn sm" data-approve="${t.id}">승인</button>` : ''}
        <button class="btn sm ghost" data-edit2="${t.id}">정보 수정</button>
        ${(t.status === 'approved' && !locked) ? `<button class="btn sm danger" data-suspend="${t.id}">중지</button>` : ''}
      </td></tr>`;
    }).join('')}
  </table>
  <p class="note">
    이름이나 회사를 누르면 <b>정보 수정</b> 창이 열립니다. 비밀번호 재설정과 계정 삭제도 그 안에 있습니다.<br>
    <b>중지</b> 는 접근만 막습니다. 나중에 다시 승인하면 그대로 돌아옵니다. 잠깐 쉬는 사람은 중지를 쓰세요.<br>
    부관리자는 관리자와 같은 기능을 모두 씁니다. 마스터 계정은 마스터 본인만 바꿀 수 있습니다.</p>`;

  $$('#team-list [data-approve]').forEach(b => b.onclick = () => setStatus(b.dataset.approve, 'approved'));
  $$('#team-list [data-suspend]').forEach(b => b.onclick = () => setStatus(b.dataset.suspend, 'suspended'));
  $$('#team-list [data-role]').forEach(sel => sel.onchange = async () => {
    const { error } = await sb.from('profiles').update({ role: sel.value }).eq('id', sel.dataset.role);
    if (error) uiAlert(cleanErr(error.message));
    await refresh();
  });
  $$('#team-list [data-edit], #team-list [data-edit2]').forEach(el =>
    el.onclick = () => openMember(team.find(t => t.id === (el.dataset.edit || el.dataset.edit2))));
}

/* ---------------- 팀원 정보 수정 ---------------- */
function openMember(t){
  if (!t) return;
  const locked   = (t.role === 'master' && !isMaster());
  const isSelf   = t.id === me.id;
  const canTouch = !locked;

  const body = `
    <h2>${esc(t.name || t.email)}</h2>
    <div class="sub">${esc(t.email)} · ${ROLES[t.role] || t.role} · ${STATUS_KO[t.status]}</div>
    <div id="dr-msg"></div>

    <div class="field"><label>이름</label><input id="p-name" value="${esc(t.name)}"></div>
    <div class="grid2">
      <div class="field"><label>회사</label><input id="p-company" value="${esc(t.company)}"></div>
      <div class="field"><label>직책</label><input id="p-title" value="${esc(t.role_title)}"></div>
    </div>
    <div class="grid2">
      <div class="field"><label>권한</label><select id="p-role" ${canTouch?'':'disabled'}>
        ${Object.entries(ROLES).filter(([k]) => k !== 'master' || isMaster())
          .map(([k,v]) => `<option value="${k}" ${t.role===k?'selected':''}>${v}</option>`).join('')}
      </select></div>
      <div class="field"><label>접근 상태</label><select id="p-status" ${(canTouch && !isSelf)?'':'disabled'}>
        ${Object.entries(STATUS_KO).map(([k,v]) => `<option value="${k}" ${t.status===k?'selected':''}>${v}</option>`).join('')}
      </select></div>
    </div>

    <div class="sect">아이디 (이메일)</div>
    <div class="field"><label>로그인에 쓰는 이메일</label><input id="p-email" value="${esc(t.email)}"></div>
    <button class="btn sm ghost" id="p-email-btn" ${canTouch?'':'disabled'}>이메일 바꾸기</button>
    <p class="note">바꾸면 이 사람은 <b>새 이메일로 로그인</b>해야 합니다. 반드시 알려주세요.</p>

    <div class="sect">비밀번호</div>
    <div class="msg ok" style="margin-bottom:12px">
      비밀번호는 암호화되어 저장되므로 <b>보여드릴 수 없습니다.</b> 대표님도, 시스템 관리자도 볼 수 없습니다.<br>
      팀원이 비밀번호를 잊었으면 아래에서 새로 지정해 알려주세요.
    </div>
    <div class="field"><label>새 비밀번호 (8자 이상)</label>
      <input id="p-pw" type="text" placeholder="예: kimjejo2026!" autocomplete="off"></div>
    <button class="btn sm ghost" id="p-pw-btn" ${canTouch?'':'disabled'}>비밀번호 새로 지정</button>
    <button class="btn sm ghost" id="p-pw-gen">임시 비밀번호 만들기</button>
    <p class="note">지정한 비밀번호를 카톡 등으로 전달하고, 받은 사람이 바로 바꾸도록 안내하세요.</p>

    ${(!isSelf && t.role !== 'master') ? `
    <div class="sect">계정 삭제</div>
    <button class="btn danger sm" id="p-del">이 사람 완전히 삭제</button>
    <p class="note">명단과 로그인 계정을 함께 지웁니다. 담당하던 카드는 사라지지 않고 담당자 자리만 비웁니다.</p>` : ''}

    <div class="drawer-actions">
      <button class="btn" id="p-save">저장</button>
      <button class="btn ghost" id="p-cancel">저장 안 함</button>
    </div>`;

  const collect = () => ({
    name: $('#p-name').value.trim(),
    company: $('#p-company').value.trim(),
    role_title: $('#p-title').value.trim(),
    role: $('#p-role').value,
    status: $('#p-status').value
  });

  const msg = (x, k='err') => $('#dr-msg').innerHTML = `<div class="msg ${k}">${esc(x)}</div>`;

  const save = async () => {
    const { error } = await sb.from('profiles').update(collect()).eq('id', t.id);
    if (error) { msg(cleanErr(error.message)); return false; }
    return true;
  };

  const ctl = mountDrawer({ body, collect, save });
  $('#p-save').onclick = () => ctl.saveAndClose();
  $('#p-cancel').onclick = () => ctl.discard();

  // 계정 기능은 서버 함수를 거친다
  const callAdmin = (payload) => callFn('admin-user', { ...payload, userId: t.id });
  const adminFail = e => msg('처리하지 못했습니다.\n\n' + (e.message || e));

  $('#p-pw-gen').onclick = () => {
    const pool = 'abcdefghijkmnpqrstuvwxyz23456789';
    let pw = 'kim';
    for (let i = 0; i < 7; i++) pw += pool[Math.floor(Math.random() * pool.length)];
    $('#p-pw').value = pw + '!';
  };

  $('#p-pw-btn').onclick = async () => {
    const pw = $('#p-pw').value.trim();
    if (pw.length < 8) return msg('비밀번호는 8자 이상이어야 합니다.');
    if (!await uiConfirm(`${t.name || t.email} 님의 비밀번호를 아래로 바꿉니다.\n\n${pw}\n\n이 값을 본인에게 전달하세요.`)) return;
    try {
      await callAdmin({ action: 'password', password: pw });
      msg(`비밀번호를 바꿨습니다.\n새 비밀번호: ${pw}\n본인에게 전달하고 바로 변경하도록 안내하세요.`, 'ok');
    } catch (e) { adminFail(e); }
  };

  $('#p-email-btn').onclick = async () => {
    const em = $('#p-email').value.trim();
    if (!em.includes('@')) return msg('이메일 형식이 올바르지 않습니다.');
    if (em === t.email) return msg('기존과 같은 이메일입니다.');
    if (!await uiConfirm(`로그인 아이디를 ${em} 으로 바꿉니다.\n이 사람은 앞으로 새 이메일로 로그인해야 합니다.`)) return;
    try {
      await callAdmin({ action: 'email', email: em });
      msg('이메일을 바꿨습니다. 본인에게 알려주세요.', 'ok');
      await refresh();
    } catch (e) { adminFail(e); }
  };

  if ($('#p-del')) $('#p-del').onclick = async () => {
    const who = t.name || t.email;
    const nCards = cards.filter(c => (c.owner_ids || []).includes(t.id)).length;
    const nTodos = todos.filter(x => (x.owner_ids || []).includes(t.id)).length;
    const detail = [];
    if (nCards) detail.push(`담당 콘텐츠 ${nCards}개`);
    if (nTodos) detail.push(`담당 할 일 ${nTodos}개`);

    if (!await uiConfirm(
      `${who} 님을 완전히 삭제합니다.\n` +
      (detail.length ? `\n${detail.join(' · ')} 에서 담당자만 빠지고 내용은 남습니다.\n` : '') +
      `\n잠시 쉬는 것뿐이라면 삭제 대신 접근 상태를 [중지] 로 바꾸세요.\n계속할까요?`
    )) return;

    const { error } = await sb.from('profiles').delete().eq('id', t.id);
    if (error) return msg(cleanErr(error.message));
    try { await callAdmin({ action: 'delete' }); }
    catch { /* 로그인 계정은 남을 수 있음 */ }
    ctl.forceClose(); await refresh();
  };
}

/* ---------------- 내 계정 ---------------- */
function openMyAccount(){
  const body = `
    <h2>내 계정</h2>
    <div class="sub">${esc(profile.email)} · ${ROLES[profile.role] || profile.role}</div>
    <div id="dr-msg"></div>

    <div class="field"><label>이름</label><input id="me-n" value="${esc(profile.name)}"></div>
    <div class="grid2">
      <div class="field"><label>회사</label><input id="me-c" value="${esc(profile.company)}"></div>
      <div class="field"><label>직책</label><input id="me-t" value="${esc(profile.role_title)}"></div>
    </div>

    <div class="sect">비밀번호 바꾸기</div>
    <div class="field"><label>새 비밀번호 (8자 이상)</label>
      <input id="me-pw" type="password" autocomplete="new-password"></div>
    <div class="field"><label>한 번 더 입력</label>
      <input id="me-pw2" type="password" autocomplete="new-password"></div>
    <button class="btn sm ghost" id="me-pw-btn">비밀번호 바꾸기</button>
    <p class="note">본인 비밀번호는 언제든 여기서 바꿀 수 있습니다.</p>

    <div class="drawer-actions">
      <button class="btn" id="me-save">저장</button>
      <button class="btn ghost" id="me-cancel">저장 안 함</button>
    </div>`;

  const collect = () => ({
    name: $('#me-n').value.trim(),
    company: $('#me-c').value.trim(),
    role_title: $('#me-t').value.trim()
  });
  const msg = (x, k='err') => $('#dr-msg').innerHTML = `<div class="msg ${k}">${esc(x)}</div>`;

  const save = async () => {
    const { error } = await sb.from('profiles').update(collect()).eq('id', me.id);
    if (error) { msg(cleanErr(error.message)); return false; }
    profile = { ...profile, ...collect() };
    $('#me-name').textContent = profile.name || profile.email;
    return true;
  };

  const ctl = mountDrawer({ body, collect, save });
  $('#me-save').onclick = () => ctl.saveAndClose();
  $('#me-cancel').onclick = () => ctl.discard();

  $('#me-pw-btn').onclick = async () => {
    const a = $('#me-pw').value, b = $('#me-pw2').value;
    if (a.length < 8) return msg('비밀번호는 8자 이상이어야 합니다.');
    if (a !== b) return msg('두 번 입력한 비밀번호가 다릅니다.');
    const { error } = await sb.auth.updateUser({ password: a });
    if (error) return msg(cleanErr(error.message));
    $('#me-pw').value = ''; $('#me-pw2').value = '';
    msg('비밀번호를 바꿨습니다.', 'ok');
  };
}

async function setStatus(id, status){
  const { error } = await sb.from('profiles').update({ status }).eq('id', id);
  if (error) return uiAlert(cleanErr(error.message));
  await refresh();
}

/* ---------------- 설정: 채널 + 연동 ---------------- */
function renderSettings(){ renderChannels(); renderSync(); }

let appSettings = {};

async function loadSettings(){
  if (!isAdmin()) return;
  const { data } = await sb.from('app_settings').select('key, value');
  appSettings = {};
  (data || []).forEach(r => appSettings[r.key] = r.value || '');
}

function renderSync(){
  if (!isAdmin()) return;
  const yk = appSettings.youtube_api_key || '';
  const it = appSettings.instagram_token || '';
  const at = appSettings.instagram_token_at || '';
  const mask = v => v ? v.slice(0,6) + '…' + v.slice(-4) + ` (${v.length}자)` : '';
  const days = at ? Math.floor((Date.now() - new Date(at).getTime()) / 864e5) : null;

  $('#sync-box').innerHTML = `
    <div class="field"><label>유튜브 API 키
      ${yk ? `<span style="color:var(--blue);font-weight:700">· 저장됨 ${mask(yk)}</span>` : ''}</label>
      <input id="cfg-yt" type="text" placeholder="${yk ? '바꾸려면 새 키를 넣으세요' : 'AIza... 로 시작하는 키'}"></div>

    <div class="field"><label>GitHub 저장소
      ${appSettings.github_repo
        ? `<span style="color:var(--blue);font-weight:700">· 지금 ${esc(appSettings.github_repo)}</span>`
        : '<span style="color:var(--warn);font-weight:700">· 아직 안 넣었습니다</span>'}</label>
      <input id="cfg-gh" type="text" placeholder="아이디/저장소이름 — 예: dduwas/kimjejoops">
      <p class="note">GitHub 주소가 <b>github.com/dduwas/kimjejoops</b> 라면
        <b>dduwas/kimjejoops</b> 라고 넣습니다. 하이픈(-)이 있고 없고를 정확히 맞춰야 합니다.</p></div>

    <div class="field"><label>인스타그램 액세스 토큰
      ${it ? `<span style="color:var(--blue);font-weight:700">· 저장됨 ${mask(it)}</span>` : ''}
      ${days !== null ? `<span style="color:${days > 50 ? 'var(--warn)' : 'var(--muted)'}"> · 발급 ${days}일 전${days > 50 ? ' — 곧 만료됩니다' : ''}</span>` : ''}</label>
      <input id="cfg-ig" type="text" placeholder="${it ? '바꾸려면 새 토큰을 넣으세요' : 'IGAA... 로 시작하는 긴 문자열'}"></div>

    <button class="btn sm" id="cfg-save">연동 정보 저장</button>
    <button class="btn sm ghost" id="cfg-run">성과 지금 전체 수집</button>
    <button class="btn sm ghost" id="cfg-prev">미리보기 전체 다시 만들기</button>
    <div id="cfg-msg" style="margin-top:12px"></div>
    <p class="note">
      인스타 토큰은 60일마다 만료됩니다. 수집할 때 자동으로 연장되니 30일 안에 한 번씩만 수집을 돌리면 됩니다.<br>
      <b>저장·공유·링크클릭은 자동으로 못 가져옵니다.</b> 계정 소유자만 볼 수 있는 값이라 인스타 인사이트에서 직접 옮겨 적으셔야 합니다.</p>`;

  $('#cfg-save').onclick = async () => {
    const rows = [];
    const yv = $('#cfg-yt').value.trim();
    const iv = $('#cfg-ig').value.trim();
    const gv = $('#cfg-gh').value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
    const now = new Date().toISOString();
    if (gv) rows.push({ key:'github_repo', value: gv, updated_at: now });
    if (yv) rows.push({ key:'youtube_api_key', value: yv, updated_at: now });
    if (iv) {
      rows.push({ key:'instagram_token', value: iv, updated_at: now });
      rows.push({ key:'instagram_token_at', value: now, updated_at: now });
    }
    if (!rows.length) return syncMsg('바꿀 내용을 입력해 주세요.');
    const { error } = await sb.from('app_settings').upsert(rows);
    if (error) return syncMsg(cleanErr(error.message));
    await loadSettings(); renderSync();
    syncMsg('저장했습니다.', 'ok');
  };

  $('#cfg-run').onclick = () => runSync(null, '#cfg-msg');
  $('#cfg-prev').onclick = () => {
    syncMsg('미리보기를 만드는 중…', 'ok');
    pushPreview(null, (t, k) => syncMsg(t, k));
  };
}

function syncMsg(t, k='err', sel='#cfg-msg'){
  const el = $(sel); if (el) el.innerHTML = `<div class="msg ${k}">${esc(t)}</div>`;
}

// 성과 수집 실행 — ids 가 null 이면 전체
async function runSync(ids, msgSel='#cfg-msg'){
  syncMsg('가져오는 중… 건수가 많으면 1분쯤 걸립니다.', 'ok', msgSel);
  try {
    const data = await callFn('fetch-stats', ids ? { ids } : {});
    syncMsg((data.log || []).join('\n'), data.updated ? 'ok' : 'err', msgSel);
    await refresh();
  } catch (e) {
    syncMsg('가져오지 못했습니다.\n\n' + (e.message || e), 'err', msgSel);
  }
}

function renderChannels(){
  if (!isAdmin()) return;
  const used = label => cards.filter(c => (c.channels || []).includes(label)).length;

  $('#channel-list').innerHTML = `<table>
    <tr><th>순서</th><th>채널 이름</th><th>사용 중</th><th>노출</th><th></th></tr>
    ${channels.map(c => `<tr>
      <td><input class="mini" type="number" style="width:60px" value="${c.sort_order}" data-corder="${c.id}"></td>
      <td><input class="mini" style="width:100%" value="${esc(c.label)}" data-clabel="${c.id}"></td>
      <td class="u-muted">${used(c.label)}개</td>
      <td><input type="checkbox" ${c.active?'checked':''} data-cactive="${c.id}"></td>
      <td class="u-nowrap">
        <button class="btn sm" data-csave="${c.id}">저장</button>
        <button class="btn sm danger" data-cdel="${c.id}">삭제</button>
      </td></tr>`).join('')}
    <tr>
      <td><input class="mini" type="number" style="width:60px" id="new-corder" value="${channels.length+1}"></td>
      <td><input class="mini" style="width:100%" id="new-clabel" placeholder="새 채널 이름"></td>
      <td colspan="2"></td>
      <td><button class="btn sm" id="channel-add">추가</button></td>
    </tr>
  </table>
  <p class="note">이름을 바꾸면 그 채널이 붙어 있던 콘텐츠 카드도 함께 따라갑니다.
    사용 중인 채널은 삭제할 수 없습니다. 더 안 쓸 거면 노출을 꺼두세요. 노출을 끄면 새 카드에서만 안 보이고, 이미 쓰던 카드는 그대로 유지됩니다.</p>`;

  $$('#channel-list [data-csave]').forEach(b => b.onclick = async () => {
    const id = b.dataset.csave;
    const old = channels.find(c => c.id === id);
    const label = $(`#channel-list [data-clabel="${id}"]`).value.trim();
    if (!label) return uiAlert('채널 이름을 비울 수 없습니다.');
    const { error } = await sb.from('channels').update({
      label,
      sort_order: Number($(`#channel-list [data-corder="${id}"]`).value) || 0,
      active: $(`#channel-list [data-cactive="${id}"]`).checked
    }).eq('id', id);
    if (error) return uiAlert(cleanErr(error.message));

    if (old.label !== label) {
      const targets = cards.filter(c => (c.channels || []).includes(old.label));
      for (const t of targets) {
        const next = (t.channels || []).map(x => x === old.label ? label : x);
        const r = await sb.from('contents').update({ channels: next }).eq('id', t.id);
        if (r.error) { uiAlert('카드 반영 중 오류: ' + cleanErr(r.error.message)); break; }
      }
      if (channelFilter.has(old.label)) { channelFilter.delete(old.label); channelFilter.add(label); }
    }
    await refresh();
  });

  $$('#channel-list [data-cdel]').forEach(b => b.onclick = async () => {
    const c = channels.find(x => x.id === b.dataset.cdel);
    if (used(c.label)) return uiAlert(`이 채널을 쓰는 카드가 ${used(c.label)}개 있습니다. 삭제 대신 노출을 꺼주세요.`);
    if (!await uiConfirm(`"${c.label}" 채널을 삭제합니다.`, { ok: '삭제', danger: true })) return;
    const { error } = await sb.from('channels').delete().eq('id', c.id);
    if (error) return uiAlert(cleanErr(error.message));
    await refresh();
  });

  $('#channel-add').onclick = async () => {
    const label = $('#new-clabel').value.trim();
    if (!label) return uiAlert('채널 이름을 입력해 주세요.');
    const { error } = await sb.from('channels').insert({
      label, sort_order: Number($('#new-corder').value) || 0 });
    if (error) return uiAlert(cleanErr(error.message));
    await refresh();
  };
}

