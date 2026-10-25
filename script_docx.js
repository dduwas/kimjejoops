// v40 대본 초안 docx 만들기 — 1022 촬영 최종 대본 양식(제목 N: … / 장면 구성 / 표 [장면 설명 | 대사/자막])
// 카드의 '대본 · 메모'(script)를 표로 옮기고, 비어 있으면 핵심 메시지·CTA로 뼈대를 채운다.
// 브라우저: window.KJScript.download(cards, fileName)  /  node 테스트: KJScript.build(cards, docxLib) → Document
(function (root) {
  const CDN = 'https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js';
  const OUTRO = '[자막] 영양제 지식은? 김제조 팔로우!';

  async function loadLib() {
    if (root.docx) return root.docx;
    await new Promise((ok, no) => {
      const s = document.createElement('script'); s.src = CDN; s.onload = ok;
      s.onerror = () => no(new Error('docx 도구를 불러오지 못했습니다(인터넷 연결 확인).'));
      document.head.appendChild(s);
    });
    return root.docx;
  }

  // '대본 · 메모' 글 → 표 줄. 줄바꿈 1번 = 다음 줄(행), 2번 = 같은 칸 안 줄바꿈. "장면 | 대사" 는 왼쪽·오른쪽 칸
  function parseRows(script) {
    const text = String(script || '').replace(/\r\n?/g, '\n').trim();
    if (!text) return [];
    const rows = text.split(/(?<!\n)\n(?!\n)/).map(r => r.trim()).filter(Boolean).map(r => {
      const i = r.indexOf(' | ');
      return i >= 0 ? { scene: r.slice(0, i).trim(), line: r.slice(i + 3).trim() } : { scene: '', line: r };
    });
    // "※ 준비물" 같은 메모 줄은 왼쪽 칸으로
    rows.forEach(r => { if (!r.scene && /^(※|카메라 구도|동작|컷 ?\d)/.test(r.line) && !/\n/.test(r.line)) { r.scene = r.line; r.line = ''; } });
    // 장면만 있고 대사가 비어 있으면 다음 줄 대사와 합침
    const out = [];
    // 장면 칸이 있는 줄 바로 다음의 대사 줄은 같은 칸(원래 한 칸 안 줄바꿈)으로 합침 — 빈 줄(\n\n)이 이미 있으면 합치지 않음
    rows.forEach(r => { const p = out[out.length - 1];
      if (p && p.scene && !r.scene && !/^(※|카메라 구도|동작|컷 ?\d)/.test(r.line) && !/\n\n/.test(p.line || '')) p.line = p.line ? p.line + '\n' + r.line : r.line;
      else out.push(r); });
    return out;
  }

  // 대본이 비어 있는 카드 → 뼈대
  function skeleton(c) {
    const key = (c.key_message || '').trim();
    const rows = [
      { scene: '도입부 — 카메라 구도: 주인공 정면, 상반신', line: (key || c.title || '') + '\n\n(첫 3초 훅 — 질문형 한 줄로 바꿔 쓰기)' },
      { scene: '', line: '(본문 1)' },
      { scene: '', line: '(본문 2)' },
      { scene: '', line: '(본문 3)' },
      { scene: '마무리', line: c.cta_keyword ? `더 자세한 자료는 댓글에 "${c.cta_keyword}" 남겨주세요!` : '(마무리 한 줄)' },
    ];
    if (c.next_action) rows.unshift({ scene: '※ 메모: ' + c.next_action, line: '' });
    return rows;
  }

  function build(cards, D) {
    const { Document, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, AlignmentType, PageBreak, TableLayoutType, LineRuleType } = D;
    const B = { style: BorderStyle.SINGLE, size: 6, color: 'D9D9D9' };
    const borders = { top: B, bottom: B, left: B, right: B };
    const margins = { top: 140, bottom: 140, left: 110, right: 110 };
    const paras = (txt, opts) => {
      const parts = String(txt || '').split('\n').map(s => s.trim()).filter(Boolean);
      return parts.length ? parts.map(p => new Paragraph({ children: [new TextRun({ text: p, ...(opts || {}) })], ...(opts && opts.center ? { alignment: AlignmentType.CENTER } : {}) })) : [new Paragraph('')];
    };
    const cell = (txt, w, extra) => new TableCell({ width: { size: w, type: WidthType.DXA }, borders, margins, children: paras(txt, extra && extra.run), ...(extra || {}) });
    const body = [];
    cards.forEach((c, i) => {
      if (i) body.push(new Paragraph({ children: [new PageBreak()] }));
      body.push(new Paragraph({ children: [
        new TextRun({ text: `제목 ${i + 1}: ${c.title || '제목 없음'}`, bold: true, size: 36 }),
        new TextRun({ text: '장면 구성', bold: true, size: 36, break: 1 }) ] }));
      let rows = parseRows(c.script);
      const isDraft = !rows.length;
      if (isDraft) rows = skeleton(c);
      if (!rows.some(r => (r.line || '').includes('김제조 팔로우'))) rows.push({ scene: '', line: OUTRO });
      const head = new TableRow({ tableHeader: true, children: [
        new TableCell({ width: { size: 4680, type: WidthType.DXA }, borders, margins, shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F2F2F2' }, children: [new Paragraph('장면 설명')] }),
        new TableCell({ width: { size: 5645, type: WidthType.DXA }, borders, margins, shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F2F2F2' }, children: [new Paragraph('대사/자막')] }) ] });
      const refTxt = [c.reference_url ? '레퍼런스: ' + c.reference_url : '', isDraft ? '※ 대본 초안(뼈대) — 괄호 부분을 채워 주세요' : ''].filter(Boolean).join('\n');
      const ref = new TableRow({ children: [new TableCell({ columnSpan: 2, width: { size: 10325, type: WidthType.DXA }, borders, margins,
        children: refTxt ? paras(refTxt, { color: '6B7A90', center: true }) : [new Paragraph('')] })] });
      const lines = rows.map(r => new TableRow({ children: [cell(r.scene, 4680), cell(r.line, 5645)] }));
      body.push(new Table({ columnWidths: [4680, 5645], layout: TableLayoutType.FIXED, alignment: AlignmentType.CENTER, rows: [head, ref, ...lines] }));
    });
    return new Document({
      creator: '약공장 김제조 워크스페이스',
      styles: { default: { document: { run: { font: { ascii: 'Calibri', hAnsi: 'Calibri', eastAsia: '맑은 고딕' }, size: 22 }, paragraph: { spacing: { after: 200, line: 276, lineRule: LineRuleType.AUTO } } } } },
      sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 720, bottom: 720, left: 720, right: 720 } } }, children: body }]
    });
  }

  async function download(cards, fileName) {
    const D = await loadLib();
    const blob = await D.Packer.toBlob(build(cards, D));
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fileName;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }

  root.KJScript = { parseRows, skeleton, build, download };
})(typeof window !== 'undefined' ? window : globalThis);
