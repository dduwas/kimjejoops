'use strict';
// 김제조 웍스 — 글쓰기  (v88에서 index.html 에서 분리)
/* --- 안전하게 표시하기 (스크립트 제거) --- */
function cleanHTML(html){
  const box = document.createElement('div');
  box.innerHTML = html || '';

  // 위험한 태그 제거
  box.querySelectorAll('script,style,iframe,object,embed,link,meta,noscript').forEach(n => n.remove());

  // 주석 제거 (노션의 notionvc, StartFragment 등)
  const walker = document.createTreeWalker(box, NodeFilter.SHOW_COMMENT);
  const comments = [];
  while (walker.nextNode()) comments.push(walker.currentNode);
  comments.forEach(n => n.remove());

  box.querySelectorAll('*').forEach(n => {
    [...n.attributes].forEach(a => {
      const nm = a.name.toLowerCase();
      // 위험 속성
      if (nm.startsWith('on')) n.removeAttribute(a.name);
      if ((nm === 'href' || nm === 'src') && /^\s*javascript:/i.test(a.value)) n.removeAttribute(a.name);
      // 외부에서 딸려온 잡다한 속성 정리
      if (nm === 'class' && /notion|css-|Mso/i.test(a.value)) n.removeAttribute(a.name);
      if (nm.startsWith('data-') && !['data-ph','data-p'].includes(nm)) n.removeAttribute(a.name);
      if (['id','lang','dir','role','style','width','height','align'].includes(nm)
          && n.tagName !== 'IMG') n.removeAttribute(a.name);
    });
  });

  // 내용 없는 껍데기 태그 정리 (빈 span, 빈 div 등)
  for (let pass = 0; pass < 3; pass++) {
    box.querySelectorAll('span,font,div,p,section,b,i,strong,em').forEach(n => {
      const empty = !n.textContent.trim() && !n.querySelector('img,hr,br,table,input');
      if (empty) { n.remove(); return; }
      // 껍데기만 씌운 span/font 는 안쪽 내용만 남긴다
      if (['SPAN','FONT'].includes(n.tagName)) n.replaceWith(...n.childNodes);
    });
  }

  // 줄바꿈만 잔뜩 있는 문단 정리
  box.querySelectorAll('p').forEach(n => {
    if (n.querySelectorAll('br').length > 2 && !n.textContent.trim()) n.remove();
  });

  return box.innerHTML;
}

// 붙여넣기 전용 — 위 정리에 더해 다른 서비스의 흔적을 걷어낸다
function cleanPaste(html){
  let t = String(html || '')
    // 워드·노션이 넣는 조건부 주석
    .replace(/<!--[\s\S]*?-->/g, '')
    // 붙여넣기로 넘어온 태그 이름이 글자로 굳은 경우 (&lt;aside&gt; 등)
    .replace(/&lt;\/?(aside|div|section|figure|details|summary)&gt;/gi, '');
  const out = cleanHTML(t);
  // 연속된 빈 줄 압축
  return out.replace(/(<p>(\s|&nbsp;|<br\s*\/?>)*<\/p>\s*){2,}/gi, '<p><br></p>');
}

// 짧은 주소를 만든다 — 헷갈리는 글자(0,O,1,l,I)는 뺀다
// 클립보드 복사 — 보안 연결이 아니어도 되도록 대비책을 둔다
async function copyText(t){
  try {
    if (navigator.clipboard && window.isSecureContext) {
      // 권한 창 등으로 응답이 없으면 1.5초 뒤 아래 대체 방식으로 넘어간다
      const r = await Promise.race([navigator.clipboard.writeText(t).then(() => true), new Promise(res => setTimeout(() => res(false), 1500))]);
      if (r) return true;
    }
  } catch { /* 아래 방식으로 다시 시도한다 */ }

  try {
    const ta = document.createElement('textarea');
    ta.value = t;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, t.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

function slugify(){
  const pool = 'abcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 7; i++) out += pool[Math.floor(Math.random() * pool.length)];
  return out;
}

// 사람이 직접 넣은 주소를 정리한다
function cleanSlug(v){
  return (v || '').trim().toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function postUrl(slug){
  return `${location.origin}${location.pathname}?post=${encodeURIComponent(slug)}`;
}

// 카톡·SNS 에 붙여넣을 주소 — 미리보기 파일을 올려두면 이 주소가 된다
function shareUrl(slug){
  return `${location.origin}/p/${encodeURIComponent(slug)}.html`;
}

// 발행 미리보기를 GitHub 에 올린다
// 서버 함수를 부르고, 실패하면 서버가 보낸 진짜 이유를 꺼낸다
async function callFn(name, body){
  const { data, error } = await sb.functions.invoke(name, { body: body || {} });

  if (error) {
    let detail = '';
    try {
      if (error.context && typeof error.context.json === 'function') {
        const j = await error.context.json();
        detail = j?.error || j?.message || '';
      } else if (error.context && typeof error.context.text === 'function') {
        detail = await error.context.text();
      }
    } catch { /* 본문을 못 읽으면 아래 기본 문구를 쓴다 */ }

    if (!detail) {
      if (String(error.message || '').includes('Failed to send'))
        detail = '함수 ' + name + ' 을(를) 찾지 못했습니다. Supabase → Edge Functions 에서 이름을 확인하세요.';
      else detail = error.message || '알 수 없는 오류';
    }
    throw new Error(detail);
  }

  if (data?.error) throw new Error(data.error);
  return data;
}

async function pushPreview(postId, msg){
  try {
    const data = await callFn('publish-preview', postId ? { postId } : { all: true });
    if (msg) msg((data.log || []).join('\n'), data.done ? 'ok' : 'err');
    return true;
  } catch (e) {
    if (msg) msg('미리보기를 올리지 못했습니다.\n\n' + (e.message || e), 'err');
    return false;
  }
}

function renderPosts(){
  let rows = posts.filter(p => poFilter === 'all' || p.status === poFilter);
  rows.sort((a,b) => (b.updated_at || '').localeCompare(a.updated_at || ''));

  const pub = posts.filter(p => p.status === 'published').length;
  $('#post-count').textContent = `전체 ${posts.length}개 · 링크 있음 ${pub}개 · 팀 전용 ${posts.length - pub}개`;

  $('#post-list').innerHTML = rows.length ? rows.map(p => `
    <div class="pocard" data-po="${p.id}">
      ${p.cover_url ? `<div class="po-cover" style="background-image:url('${esc(p.cover_url)}')"></div>` : ''}
      <div class="po-body">
        <div class="po-head">
          <b>${esc(p.title || '(제목 없음)')}</b>
          <button class="po-copy" data-pocopy="${p.id}" title="보낼 링크 복사">🔗 링크 복사</button>
          <span class="pill ${p.status === 'published' ? 'approved' : 'pending'}">
            ${p.status === 'published' ? '링크 있음' : '팀 전용'}</span>
        </div>
        ${p.excerpt ? `<div class="po-ex">${esc(p.excerpt)}</div>` : ''}
        <div class="po-meta">
          <span>${esc(nameOf(p.author_id))}</span>
          <span>${(p.updated_at || '').slice(0,10)}</span>
          ${p.status === 'published' ? `<span>열람 ${p.view_count || 0}</span>` : ''}
          ${(p.tags || []).map(t => `<span class="badge">${esc(t)}</span>`).join('')}
        </div>
      </div>
    </div>`).join('')
    : '<div class="empty">아직 쓴 글이 없습니다.<br>위 버튼으로 첫 글을 써보세요.</div>';

  $$('#post-list [data-po]').forEach(el =>
    el.onclick = () => openPost(posts.find(p => p.id === el.dataset.po)));
  $$('#post-list [data-pocopy]').forEach(b => b.onclick = async ev => {
    ev.stopPropagation();
    copyPostLink(posts.find(p => p.id === b.dataset.pocopy));
  });
}

function poToast(t, ms){
  const old = document.querySelector('.po-toast'); if (old) old.remove();
  const el = document.createElement('div'); el.className = 'po-toast'; el.textContent = t;
  document.body.appendChild(el); setTimeout(() => el.remove(), ms || 3500);
}

// 목록의 🔗 버튼 — 링크가 없으면(팀 전용) 바로 만들고 복사한다
async function copyPostLink(p){
  if (!p) return;
  let fresh = false;
  if (p.status !== 'published' || !p.slug) {
    if (p.status !== 'published' && !await uiConfirm('이 글은 팀 전용입니다.\n링크를 만들면 링크를 아는 사람은 누구나 볼 수 있습니다.', { ok: '링크 만들기' })) return;
    const upd = { status: 'published', slug: p.slug || slugify() };
    const { data, error } = await sb.from('posts').update(upd).eq('id', p.id).select().maybeSingle();
    if (error) { poToast('링크를 만들지 못했습니다: ' + cleanErr(error.message), 5000); return; }
    Object.assign(p, data || upd); fresh = true;
    pushPreview(p.id, null);
    renderPosts();
  }
  const ok = await copyText(shareUrl(p.slug));
  poToast(ok ? (fresh ? '링크를 만들고 복사했습니다. 카톡 미리보기는 1~2분 뒤부터 보입니다.' : '링크를 복사했습니다.')
             : '복사하지 못했습니다: ' + shareUrl(p.slug), ok ? 3500 : 8000);
}

$('#po-new').onclick = () => openPost(null);
$$('.po-f').forEach(b => b.onclick = () => {
  $$('.po-f').forEach(x => x.classList.remove('on'));
  b.classList.add('on'); poFilter = b.dataset.f; renderPosts();
});

/* --- 글 편집 --- */
function openPost(p){
  const isNew = !p;
  const d = p || { title:'', content:'', excerpt:'', cover_url:'', tags:[], status:'published', slug:null };

  const body = `
    <h2>${isNew ? '새 글' : '글 편집'}</h2>
    <div class="sub">본문에서 <b>/</b> 를 치면 블록 메뉴가 열립니다. 이미지는 Ctrl+V 로 붙여넣습니다.</div>
    <div id="dr-msg"></div>

    <input id="po-title" class="po-title-in" placeholder="제목을 입력하세요" value="${esc(d.title)}">

    <div class="po-tools" id="po-tools">
      <button data-cmd="bold" title="굵게 (Ctrl+B)"><b>B</b></button>
      <button data-cmd="italic" title="기울임 (Ctrl+I)"><i>I</i></button>
      <button data-cmd="underline" title="밑줄 (Ctrl+U)"><u>U</u></button>
      <button data-cmd="strikeThrough" title="취소선"><s>S</s></button>
      <button data-cmd="hiliteColor" title="형광펜" class="hl">형광</button>
      <span class="po-sep"></span>
      <button data-blk="h1" title="제목 1">H1</button>
      <button data-blk="h2" title="제목 2">H2</button>
      <button data-blk="h3" title="제목 3">H3</button>
      <button data-blk="ul" title="글머리 목록">•</button>
      <button data-blk="ol" title="번호 목록">1.</button>
      <button data-blk="quote" title="인용">❝</button>
      <button data-blk="code" title="코드">&lt;/&gt;</button>
      <span class="po-sep"></span>
      <button data-act="link" title="링크">링크</button>
      <button data-act="image" title="이미지">이미지</button>
      <button data-act="clear" title="서식 지우기">서식↺</button>
      <button data-act="tidy" title="붙여넣기 찌꺼기 정리">본문 정리</button>
    </div>

    <div class="po-editor" id="po-body" contenteditable="true"
         data-ph="여기에 글을 쓰세요.  /  를 치면 블록 메뉴가 열립니다."></div>

    <div class="sect">발행 설정</div>
    <div class="field"><label>요약 — 목록과 공유 미리보기에 보입니다</label>
      <textarea id="po-ex" style="min-height:60px">${esc(d.excerpt)}</textarea></div>
    <div class="grid2">
      <div class="field"><label>태그 — 쉼표로 구분</label>
        <input id="po-tags" value="${esc((d.tags || []).join(', '))}"></div>
      <div class="field"><label>대표 이미지 주소</label>
        <input id="po-cover" value="${esc(d.cover_url)}" placeholder="본문 이미지를 우클릭해 주소 복사"></div>
    </div>
    <div class="grid2">
      <div class="field"><label>보내기 링크</label>
        <label style="display:flex;gap:7px;align-items:center;font-size:13px;font-weight:500;margin-top:6px;cursor:pointer">
          <input type="checkbox" id="po-team" style="width:auto;margin:0" ${(!isNew && d.status==='draft')?'checked':''}>
          팀 전용으로 두기 (링크 만들지 않음)</label>
        <div class="note" style="margin-top:4px">체크하지 않으면 저장할 때 보낼 링크가 바로 만들어집니다.</div></div>
      <div class="field"><label>주소 — 비워두면 짧은 주소가 자동으로 생깁니다</label>
        <input id="po-slug" value="${esc(d.slug)}" placeholder="예: berberine"></div>
    </div>
    <div id="po-link"></div>

    <div class="drawer-actions">
      <button class="btn" id="po-save">저장</button>
      <button class="btn ghost" id="po-cancel">저장 안 함</button>
      ${(!isNew && isAdmin()) ? '<button class="btn danger" id="po-del" style="margin-left:auto">삭제</button>' : ''}
    </div>`;

  const collect = () => ({
    title: $('#po-title').value.trim(),
    content: cleanHTML($('#po-body').innerHTML),
    excerpt: $('#po-ex').value.trim() || null,
    cover_url: $('#po-cover').value.trim() || null,
    tags: $('#po-tags').value.split(',').map(x => x.trim()).filter(Boolean),
    status: $('#po-team').checked ? 'draft' : 'published',
    slug: cleanSlug($('#po-slug').value) || null
  });

  const msg = (t, k='err') => $('#dr-msg').innerHTML = `<div class="msg ${k}">${esc(t)}</div>`;

  const save = async () => {
    const payload = collect();
    if (!payload.title) { msg('제목을 입력해 주세요.'); $('#po-title').focus(); return false; }
    if (!payload.slug) payload.slug = slugify();

    const res = isNew
      ? await sb.from('posts').insert({ ...payload, author_id: me.id, created_by: me.id }).select().maybeSingle()
      : await sb.from('posts').update(payload).eq('id', p.id).select().maybeSingle();

    if (res.error) {
      if ((res.error.message || '').includes('duplicate') || res.error.code === '23505') {
        msg('같은 주소를 쓰는 글이 이미 있습니다. 주소 칸을 비우면 자동으로 만들어집니다.');
        $('#po-slug').focus();
      } else msg(cleanErr(res.error.message));
      return false;
    }
    if (res.data?.slug) d.slug = res.data.slug;

    // 발행 상태면 카톡 미리보기를 자동으로 갱신한다
    if (payload.status === 'published' && (res.data?.id || p?.id)) {
      pushPreview(res.data?.id || p.id, null);
    }
    return true;
  };

  const ctl = mountDrawer({ body, collect, save });
  $('#po-save').onclick = () => ctl.saveAndClose();
  $('#po-cancel').onclick = () => ctl.discard();
  if ($('#po-del')) $('#po-del').onclick = async () => {
    if (!await uiConfirm('이 글을 삭제합니다. 되돌릴 수 없습니다.', { ok: '삭제', danger: true })) return;
    const { error } = await sb.from('posts').delete().eq('id', p.id);
    if (error) return msg(cleanErr(error.message));
    ctl.forceClose(); await refresh();
  };

  // 본문 채우기
  $('#po-body').innerHTML = cleanHTML(d.content) || '<p><br></p>';
  wireEditor('#po-body', msg);

  // 발행 주소 표시
  const showLink = () => {
    const box = $('#po-link');
    if ($('#po-team').checked) {
      box.innerHTML = '<p class="note">팀 전용 — 링크가 만들어지지 않습니다. 체크를 풀고 저장하면 링크가 생깁니다.</p>';
      return;
    }
    if (!d.slug) { box.innerHTML = '<p class="note">저장하면 공개 주소가 만들어집니다.</p>'; return; }
    const u = postUrl(d.slug);
    const sh = shareUrl(d.slug);
    box.innerHTML = `<div class="msg ok" style="line-height:1.75">
      <b>카톡·SNS 공유용</b> — 미리보기에 글 제목이 보입니다<br>
      <a href="${esc(sh)}" target="_blank" rel="noopener" style="word-break:break-all">${esc(sh)}</a><br>
      <button class="btn sm" id="po-copy2" style="margin:9px 0 4px">공유용 주소 복사</button>
    </div>
    <p class="note" style="margin-bottom:14px">
      저장할 때 미리보기가 자동으로 만들어집니다. 반영까지 1~2분 걸립니다.<br>
      제목이나 요약을 고쳤으면 다시 저장하면 갱신됩니다.
      <button class="btn ghost sm" id="po-refresh" style="margin-left:6px">지금 갱신</button>
    </p>
    <details style="margin-bottom:6px">
      <summary style="cursor:pointer;font-size:12.5px;color:var(--muted)">워크스페이스 안에서 보는 주소</summary>
      <div style="margin-top:8px">
        <a href="${esc(u)}" target="_blank" rel="noopener" style="word-break:break-all;font-size:13px">${esc(u)}</a><br>
        <button class="btn ghost sm" id="po-copy" style="margin-top:7px">이 주소 복사</button>
      </div>
    </details>`;

    $('#po-copy').onclick = async () => {
      const ok = await copyText(u);
      msg(ok ? '주소를 복사했습니다.'
             : '복사하지 못했습니다. 아래 주소를 길게 눌러 직접 복사해 주세요.\n' + u,
          ok ? 'ok' : 'err');
    };
    if ($('#po-copy2')) $('#po-copy2').onclick = async () => {
      const ok = await copyText(shareUrl(d.slug));
      msg(ok ? '공유용 주소를 복사했습니다. 미리보기 파일을 올린 뒤에 쓰세요.'
             : '복사하지 못했습니다.\n' + shareUrl(d.slug),
          ok ? 'ok' : 'err');
    };

    if ($('#po-refresh')) $('#po-refresh').onclick = () => pushPreview(p ? p.id : null, msg);
  };
  $('#po-team').onchange = showLink;
  showLink();
}

/* --- 편집기 동작 --- */
function wireEditor(sel, msg){
  const ed = $(sel);
  const exec = (cmd, val) => { ed.focus(); document.execCommand(cmd, false, val); };

  // 도구 막대
  $$('#po-tools [data-cmd]').forEach(b => b.onmousedown = e => {
    e.preventDefault();
    if (b.dataset.cmd === 'hiliteColor') exec('hiliteColor', '#FFF3B0');
    else exec(b.dataset.cmd);
  });
  $$('#po-tools [data-blk]').forEach(b => b.onmousedown = e => {
    e.preventDefault(); applyBlock(b.dataset.blk);
  });
  $$('#po-tools [data-act]').forEach(b => b.onmousedown = async e => {
    e.preventDefault();
    if (b.dataset.act === 'link') {
      const u = await uiPrompt('링크 주소를 넣으세요', 'https://');
      if (u) exec('createLink', u);
    }
    if (b.dataset.act === 'image') pickImage();
    if (b.dataset.act === 'clear') exec('removeFormat');
    if (b.dataset.act === 'tidy') {
      if (!await uiConfirm('노션·워드에서 붙여넣은 찌꺼기를 정리합니다.\n빈 줄과 숨은 표시가 사라집니다.', { ok: '정리' })) return;
      ed.innerHTML = cleanPaste(ed.innerHTML);
      msg('본문을 정리했습니다. 확인하고 저장하세요.', 'ok');
    }
  });

  function applyBlock(kind){
    ed.focus();
    if (kind === 'h1') exec('formatBlock', '<h1>');
    if (kind === 'h2') exec('formatBlock', '<h2>');
    if (kind === 'h3') exec('formatBlock', '<h3>');
    if (kind === 'p')  exec('formatBlock', '<p>');
    if (kind === 'ul') exec('insertUnorderedList');
    if (kind === 'ol') exec('insertOrderedList');
    if (kind === 'quote') exec('formatBlock', '<blockquote>');
    if (kind === 'code') insertHTML('<pre class="po-code">코드를 입력하세요</pre><p><br></p>');
    if (kind === 'divider') insertHTML('<hr><p><br></p>');
    if (kind === 'callout') insertHTML('<div class="po-callout">메모를 입력하세요</div><p><br></p>');
    if (kind === 'todo') insertHTML('<ul class="po-todo"><li>할 일</li></ul><p><br></p>');
    if (kind === 'table') insertHTML(
      '<table class="po-table"><tr><th>항목</th><th>내용</th></tr>' +
      '<tr><td>　</td><td>　</td></tr><tr><td>　</td><td>　</td></tr></table><p><br></p>');
    if (kind === 'image') pickImage();
  }

  function insertHTML(html){ ed.focus(); document.execCommand('insertHTML', false, html); }

  // 이미지 업로드
  async function upload(file){
    if (file.size > 10 * 1024 * 1024) { msg(`${file.name} 은 10MB를 넘습니다.`); return null; }
    const path = `${Date.now()}_${Math.random().toString(36).slice(2,8)}_${file.name.replace(/[^\w.-]/g,'_')}`;
    const { error } = await sb.storage.from('post-images').upload(path, file);
    if (error) { msg('이미지 업로드 실패: ' + cleanErr(error.message)); return null; }
    const { data } = sb.storage.from('post-images').getPublicUrl(path);
    return data.publicUrl;
  }

  function pickImage(){
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
    inp.onchange = async () => {
      for (const f of [...inp.files]) {
        msg(`${f.name} 올리는 중…`, 'ok');
        const url = await upload(f);
        if (url) insertHTML(`<img src="${url}" alt=""><p><br></p>`);
      }
      msg('이미지를 넣었습니다.', 'ok');
    };
    inp.click();
  }

  // 붙여넣기 — 이미지는 업로드, 글자는 서식 없이
  ed.addEventListener('paste', async e => {
    const items = [...(e.clipboardData?.items || [])];
    const img = items.find(i => i.type.startsWith('image/'));
    if (img) {
      e.preventDefault();
      const f = img.getAsFile();
      if (!f) return;
      msg('이미지 올리는 중…', 'ok');
      const url = await upload(f);
      if (url) insertHTML(`<img src="${url}" alt=""><p><br></p>`);
      else msg('이미지를 올리지 못했습니다.');
      return;
    }
    const html = e.clipboardData?.getData('text/html');
    if (html) { e.preventDefault(); insertHTML(cleanPaste(html)); }
  });

  // 마크다운 단축 입력
  ed.addEventListener('keydown', e => {
    if (e.key === ' ') {
      const sel = window.getSelection();
      if (!sel.rangeCount) return;
      const node = sel.anchorNode;
      const text = (node?.textContent || '').slice(0, sel.anchorOffset);
      const map = { '#':'h1', '##':'h2', '###':'h3', '-':'ul', '*':'ul', '1.':'ol', '>':'quote', '[]':'todo' };
      const kind = map[text.trim()];
      if (kind && text.trim() === text.replace(/^\s+/, '')) {
        e.preventDefault();
        node.textContent = node.textContent.slice(sel.anchorOffset);
        applyBlock(kind);
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); exec('bold'); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') { e.preventDefault(); exec('italic'); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') { e.preventDefault(); exec('underline'); }
    if (e.key === 'Escape' && $('#slash-menu')) { closeSlash(); e.stopPropagation(); }
  });

  // 슬래시 명령
  const SLASH = [
    ['제목 1', 'h1', '큰 제목'], ['제목 2', 'h2', '중간 제목'], ['제목 3', 'h3', '작은 제목'],
    ['본문', 'p', '보통 글'], ['글머리 목록', 'ul', '• 목록'], ['번호 목록', 'ol', '1. 목록'],
    ['체크박스', 'todo', '할 일 목록'], ['인용', 'quote', '인용문'],
    ['콜아웃', 'callout', '강조 상자'], ['구분선', 'divider', '가로줄'],
    ['코드', 'code', '코드 블록'], ['표', 'table', '2열 표'], ['이미지', 'image', '사진 넣기']
  ];

  function closeSlash(){ const m = $('#slash-menu'); if (m) m.remove(); }

  ed.addEventListener('keyup', e => {
    if (e.key === '/') openSlash();
    else if ($('#slash-menu') && !['ArrowDown','ArrowUp','Enter'].includes(e.key)) filterSlash();
  });

  function openSlash(){
    closeSlash();
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const r = sel.getRangeAt(0).getBoundingClientRect();
    const m = document.createElement('div');
    m.id = 'slash-menu';
    m.style.top  = (r.bottom + 6) + 'px';
    m.style.left = r.left + 'px';
    m.innerHTML = SLASH.map(([n,k,desc],i) =>
      `<div class="si ${i===0?'on':''}" data-k="${k}" data-n="${n}">
         <b>${n}</b><span>${desc}</span></div>`).join('');
    document.body.appendChild(m);
    m.querySelectorAll('.si').forEach(el => el.onmousedown = ev => {
      ev.preventDefault(); pickSlash(el.dataset.k);
    });
  }

  function filterSlash(){
    const m = $('#slash-menu'); if (!m) return;
    const sel = window.getSelection();
    const txt = (sel.anchorNode?.textContent || '');
    const q = (txt.slice(0, sel.anchorOffset).split('/').pop() || '').toLowerCase();
    let first = true;
    m.querySelectorAll('.si').forEach(el => {
      const hit = el.dataset.n.toLowerCase().includes(q);
      el.style.display = hit ? '' : 'none';
      el.classList.toggle('on', hit && first);
      if (hit) first = false;
    });
    if (first) closeSlash();   // 맞는 항목이 없으면 닫는다
  }

  function pickSlash(kind){
    // 입력해둔 "/..." 글자를 지운다
    const sel = window.getSelection();
    if (sel.rangeCount) {
      const node = sel.anchorNode;
      const before = (node.textContent || '').slice(0, sel.anchorOffset);
      const idx = before.lastIndexOf('/');
      if (idx > -1) {
        const r = document.createRange();
        r.setStart(node, idx); r.setEnd(node, sel.anchorOffset);
        r.deleteContents();
      }
    }
    closeSlash();
    applyBlock(kind);
  }

  ed.addEventListener('blur', () => setTimeout(closeSlash, 150));
}

/* --- 발행된 글 공개 보기 --- */
async function showPublicPost(slug){
  const wrap = $('#screen-public');
  wrap.classList.remove('hide');
  wrap.innerHTML = '<div class="pub"><p style="color:#6B7A90">불러오는 중…</p></div>';

  const { data, error } = await sb.from('posts')
    .select('title, content, excerpt, cover_url, tags, published_at, status')
    .eq('slug', slug).eq('status', 'published').maybeSingle();

  if (error || !data) {
    wrap.innerHTML = `<div class="pub">
      <h1>글을 찾을 수 없습니다</h1>
      <p style="color:#6B7A90">주소가 잘못됐거나, 발행이 취소된 글입니다.</p>
    </div>`;
    return;
  }

  document.title = data.title + ' · 약공장 김제조';
  try { const k = 'kjv:' + slug; if (!sessionStorage.getItem(k)) { sessionStorage.setItem(k, '1'); sb.rpc('bump_post_view', { p_slug: slug }).then(() => {}); } } catch (_) {}
  wrap.innerHTML = `<div class="pub">
    <div class="pub-kicker">약공장 김제조</div>
    <h1>${esc(data.title)}</h1>
    <div class="pub-meta">${(data.published_at || '').slice(0,10)}
      ${(data.tags || []).map(t => `<span class="badge">${esc(t)}</span>`).join('')}</div>
    ${data.cover_url ? `<img class="pub-cover" src="${esc(data.cover_url)}" alt="">` : ''}
    <div class="pub-body">${cleanHTML(data.content)}</div>
    <div class="pub-foot">모두가 건강한 오늘을 제조합니다</div>
  </div>`;
}

