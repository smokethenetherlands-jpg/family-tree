// ============================================================
// СЕМЕЙНОЕ ДЕРЕВО — логика рендеринга
// ============================================================

(function () {

  // ── Константы ─────────────────────────────────────────────
  const NODE_W   = 110;   // ширина карточки
  const NODE_H   = 150;   // высота карточки (с текстом)
  const PAIR_GAP = 20;    // зазор между супругами в паре
  const H_GAP    = 40;    // горизонтальный зазор между группами
  const GEN_H    = 300;   // высота поколения (между центрами)
  const PHOTO_R  = 32;    // радиус фото (половина диаметра 64px)

  // ── Состояние ─────────────────────────────────────────────
  let transform = { x: 0, y: 0, k: 1 };
  let activePersonId = null;
  let panelOpen = false;
  let typewriterTimer = null;
  let currentStarRgb = '100,130,200';
  let _zoom = null;
  let _svgLinesGroup = null;

  // ── DOM ───────────────────────────────────────────────────
  const viewport        = document.getElementById('tree-viewport');
  const nodesLayer      = document.getElementById('nodes-layer');
  const svg             = document.getElementById('connections-svg');
  const panel           = document.getElementById('person-panel');
  const panelClose      = document.getElementById('panel-close');
  const panelPhoto      = document.getElementById('panel-photo');
  const panelPhotoPlaceholder = document.getElementById('panel-photo-placeholder');
  const panelName       = document.getElementById('panel-name');
  const panelMeta       = document.getElementById('panel-meta');
  const panelRelatives  = document.getElementById('panel-relatives');
  const searchInput     = document.getElementById('search-input');
  const searchClear     = document.getElementById('search-clear');
  const toast           = document.getElementById('toast');

  // ── Построение дерева (иерархия для layout) ───────────────
  // Описываем только основное дерево (без in-law веток)
  const MAIN_TREE = {
    coupleId: 'c_kucherenko',
    children: [{
      coupleId: 'c_levkin',
      children: [
        { soloId: 'vladimir_levkin' },
        {
          coupleId: 'c_natalya',
          children: [
            {
              coupleId: 'c_marina_z',
              children: [{ soloId: 'kalentev_timofey' }]
            },
            {
              coupleId: 'c_oksana',
              children: [
                { soloId: 'yana_zhurbina' },
                { soloId: 'inna_zhurbina' }
              ]
            }
          ]
        },
        {
          coupleId: 'c_irina_bio',
          children: [
            {
              coupleId: 'c_valentina_b',
              children: [
                { coupleId: 'c_anna_b', children: [] }
              ]
            },
            {
              coupleId: 'c_olga',
              children: [
                { soloId: 'krutkin_roman' },
                { soloId: 'rudichev_fedor' }
              ]
            }
          ]
        }
      ]
    }]
  };

  // ── Алгоритм позиционирования ─────────────────────────────
  // positions[personId] = {x, y}
  const positions = {};

  function subtreeWidth(node) {
    if (node.soloId) return NODE_W + H_GAP;
    const couple = getCoupleById(node.coupleId);
    const pairW = (couple.p2 ? NODE_W * 2 + PAIR_GAP : NODE_W);
    if (!node.children || node.children.length === 0) return pairW + H_GAP;
    const childrenW = node.children.reduce((s, c) => s + subtreeWidth(c), 0);
    return Math.max(pairW + H_GAP, childrenW);
  }

  function placeNode(node, cx, y) {
    if (node.soloId) {
      positions[node.soloId] = { x: cx, y };
      return;
    }
    const couple = getCoupleById(node.coupleId);
    if (couple.p2) {
      positions[couple.p1] = { x: cx - (NODE_W / 2 + PAIR_GAP / 2), y };
      positions[couple.p2] = { x: cx + (NODE_W / 2 + PAIR_GAP / 2), y };
    } else {
      positions[couple.p1] = { x: cx, y };
    }

    if (!node.children || node.children.length === 0) return;

    const totalW = node.children.reduce((s, c) => s + subtreeWidth(c), 0);
    let childX = cx - totalW / 2;
    for (const child of node.children) {
      const cw = subtreeWidth(child);
      placeNode(child, childX + cw / 2, y + GEN_H);
      childX += cw;
    }
  }

  // ── Валидация данных ─────────────────────────────────────
  function validateData() {
    for (const c of COUPLES) {
      if (c.p1 && !PEOPLE[c.p1]) {
        console.warn(`[family-tree] Couple '${c.id}': p1='${c.p1}' не найден в PEOPLE`);
      }
      if (c.p2 && !PEOPLE[c.p2]) {
        console.warn(`[family-tree] Couple '${c.id}': p2='${c.p2}' не найден в PEOPLE`);
      }
      if (c.children) {
        for (const childId of c.children) {
          if (!PEOPLE[childId]) {
            console.warn(`[family-tree] Couple '${c.id}': children содержит '${childId}', не найден в PEOPLE`);
          }
        }
      }
    }
  }

  // ── Запуск расчёта позиций ────────────────────────────────
  function buildLayout() {
    const rootW = subtreeWidth(MAIN_TREE);
    placeNode(MAIN_TREE, rootW / 2, 80);

    // ── Ветка Калентьевых (слева от Петра) ───────────────────
    const petrPos = positions['kalentev_petr'];
    if (petrPos) {
      const elenaX = petrPos.x - 280;
      const elenaY = petrPos.y;
      positions['kalenteva_elena'] = { x: elenaX, y: elenaY };

      const evgenyX = elenaX - 140;
      const evgenyY = elenaY + GEN_H;
      positions['evgeny_kalentev']  = { x: evgenyX, y: evgenyY };

      const egorX = elenaX + 80;
      const egorY = elenaY + GEN_H;
      positions['egor_kiselev']     = { x: egorX, y: egorY };
      positions['marina_zhuravleva']= { x: egorX + NODE_W + PAIR_GAP, y: egorY };

      positions['arseny_kalentev']  = { x: evgenyX, y: evgenyY + GEN_H };
      positions['avrora_kiseleva']  = { x: egorX + (NODE_W + PAIR_GAP) / 2, y: egorY + GEN_H };

      // Киселев Дмитрий — бывший муж Елены (правее Елены)
      positions['kiselev_dmitry'] = { x: elenaX + NODE_W + PAIR_GAP, y: elenaY };
    }

    // Зинченко Михаил — брат Виктора; общий отец над ними
    const victorPos = positions['zinchenko_victor'];
    if (victorPos) {
      positions['zinchenko_mikhail']    = { x: victorPos.x + NODE_W + H_GAP, y: victorPos.y };
      positions['zinchenko_mikhail_sr'] = {
        x: (victorPos.x + victorPos.x + NODE_W + H_GAP) / 2,
        y: victorPos.y - GEN_H * 0.5
      };
    }

    // ── Боронин (отчим) — левее Ирины; Ивлев остаётся справа от Ирины (из layout) ──
    const irinaPos = positions['irina_levkina'];
    const ivlevPos = positions['ivlev_gennady'];
    if (irinaPos && ivlevPos) {
      positions['koronin_vladimir'] = { x: irinaPos.x - (NODE_W + H_GAP), y: irinaPos.y };
    }

    // ── Родители супругов — размещаем правее своего поколения ─
    // Родители Журбина Сергея — над ребёнком, промежуточный Y
    const zhurbinPos = positions['zhurbin_sergei'];
    if (zhurbinPos) {
      const cy = zhurbinPos.y - GEN_H * 0.5;
      const cx = zhurbinPos.x;
      positions['zhurbin_vladimir_sr'] = { x: cx - (NODE_W / 2 + PAIR_GAP / 2), y: cy };
      positions['rudakova_tatiana']    = { x: cx + (NODE_W / 2 + PAIR_GAP / 2), y: cy };
    }

    // Родители Бондаренко Михаила — над ребёнком, промежуточный Y
    const bondarenkoPos = positions['bondarenko_mikhail'];
    if (bondarenkoPos) {
      const cy = bondarenkoPos.y - GEN_H * 0.5;
      const cx = bondarenkoPos.x;
      positions['bondarenko_vladimir_sr'] = { x: cx - (NODE_W / 2 + PAIR_GAP / 2), y: cy };
      positions['kapikova_natalya']       = { x: cx + (NODE_W / 2 + PAIR_GAP / 2), y: cy };
    }

    // Родители Рудичева Никиты — над ребёнком, промежуточный Y
    const rudichevNikitaPos = positions['rudichev_nikita'];
    if (rudichevNikitaPos) {
      const cy = rudichevNikitaPos.y - GEN_H * 0.5;
      const cx = rudichevNikitaPos.x;
      positions['rudichev_gennady_sr'] = { x: cx - (NODE_W / 2 + PAIR_GAP / 2), y: cy };
      positions['rudicheva_galina']    = { x: cx + (NODE_W / 2 + PAIR_GAP / 2), y: cy };
    }

    // Родители Журавлёвой Марины — над ребёнком, промежуточный Y
    const marinaZPos = positions['marina_zhuravleva'];
    if (marinaZPos) {
      const cy = marinaZPos.y - GEN_H * 0.5;
      const cx = marinaZPos.x;
      positions['zhuravlev_andrei'] = { x: cx - (NODE_W / 2 + PAIR_GAP / 2), y: cy };
      const gunNatalyaX = cx + (NODE_W / 2 + PAIR_GAP / 2);
      positions['gun_natalya'] = { x: gunNatalyaX, y: cy };
      positions['gun_marina']  = { x: gunNatalyaX + NODE_W + H_GAP, y: cy };
      positions['zhuravlev_egor'] = { x: marinaZPos.x + NODE_W + H_GAP, y: marinaZPos.y };
    }

    // Загружаем сохранённые позиции поверх дефолтных (с валидацией)
    try {
      const saved = localStorage.getItem('ft-positions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          for (const [id, pos] of Object.entries(parsed)) {
            if (PEOPLE[id] &&
                pos !== null && typeof pos === 'object' &&
                typeof pos.x === 'number' && typeof pos.y === 'number' &&
                isFinite(pos.x) && isFinite(pos.y)) {
              positions[id] = { x: pos.x, y: pos.y };
            }
          }
        }
      }
    } catch (e) {
      console.warn('[family-tree] ft-positions в localStorage повреждены, сбрасываем', e);
      try { localStorage.removeItem('ft-positions'); } catch (_) {}
    }
  }

  // ── Отображение имени в карточке ─────────────────────────
  function shortName(person) {
    const parts = person.name.trim().split(' ');
    // Если есть девичья в скобках — убираем "(Зинченко)"
    const cleanParts = parts.filter(p => !p.startsWith('(') && !p.endsWith(')'));
    if (cleanParts.length >= 2) {
      // Фамилия + Имя
      return cleanParts[0] + '\n' + cleanParts.slice(1).join(' ');
    }
    return cleanParts.join(' ');
  }

  function formatDates(person) {
    if (!person.born && !person.died) return '';
    if (person.born && person.died) return person.born + ' — ' + person.died;
    if (person.born) return 'р. ' + person.born;
    return '';
  }

  // ── Рендеринг узлов ───────────────────────────────────────
  function renderNodes() {
    for (const [id, pos] of Object.entries(positions)) {
      const person = PEOPLE[id];
      if (!person) continue;

      const div = document.createElement('div');
      div.className = 'person-node';
      div.dataset.id = id;
      if (person.died)          div.classList.add('deceased');
      if (person.isEmpty)       div.classList.add('empty');
      if (person.isStepparent)  div.classList.add('stepparent');
      if (person.isMain)        div.classList.add('main-person');

      div.style.left = pos.x + 'px';
      div.style.top  = pos.y + 'px';

      // Фото
      const photoWrap = document.createElement('div');
      photoWrap.className = 'node-photo-wrap';

      if (person.photo) {
        const img = document.createElement('img');
        img.className = 'node-photo';
        img.src = person.photo;
        img.alt = person.name;
        const placeholder = makePlaceholderSvg();
        placeholder.style.display = 'none';
        img.onerror = () => { img.style.display = 'none'; placeholder.style.display = 'flex'; };
        photoWrap.appendChild(img);
        photoWrap.appendChild(placeholder);
      } else {
        photoWrap.appendChild(makePlaceholderSvg());
      }

      // Имя
      const nameParts = shortName(person).split('\n');
      const nameEl = document.createElement('div');
      nameEl.className = 'node-name';
      if (nameParts.length === 2) {
        const surname = document.createElement('span');
        surname.style.color = 'var(--text-muted)';
        surname.textContent = nameParts[0];
        nameEl.appendChild(surname);
        nameEl.appendChild(document.createElement('br'));
        nameEl.appendChild(document.createTextNode(nameParts[1]));
      } else {
        nameEl.textContent = nameParts[0];
      }

      // Даты
      const datesEl = document.createElement('div');
      datesEl.className = 'node-dates';
      datesEl.textContent = formatDates(person);

      const card = document.createElement('div');
      card.className = 'node-card';
      card.appendChild(photoWrap);
      card.appendChild(nameEl);
      card.appendChild(datesEl);
      div.appendChild(card);

      div.addEventListener('click', (e) => { if (!e.ctrlKey && !e.metaKey) openPanel(id); });
      div.addEventListener('mouseenter', () => { if (!panelOpen) applyFocus(id); });
      div.addEventListener('mouseleave', () => { if (!panelOpen) clearFocus(); });
      nodesLayer.appendChild(div);
    }
  }

  function makePlaceholderIcon() {
    const NS = 'http://www.w3.org/2000/svg';
    const svgEl = document.createElementNS(NS, 'svg');
    svgEl.setAttribute('viewBox', '0 0 60 60');
    svgEl.setAttribute('fill', 'none');
    const circle = document.createElementNS(NS, 'circle');
    circle.setAttribute('cx', '30'); circle.setAttribute('cy', '22'); circle.setAttribute('r', '10');
    circle.setAttribute('stroke', 'currentColor'); circle.setAttribute('stroke-width', '1.5');
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', 'M10 54c0-11 9-18 20-18s20 7 20 18');
    path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', '1.5');
    svgEl.appendChild(circle);
    svgEl.appendChild(path);
    return svgEl;
  }

  function makePlaceholderSvg() {
    const wrap = document.createElement('div');
    wrap.className = 'node-photo-placeholder';
    wrap.appendChild(makePlaceholderIcon());
    return wrap;
  }

  // ── Анимация появления узлов ──────────────────────────────
  function animateNodes() {
    const nodes = nodesLayer.querySelectorAll('.person-node');
    // Группируем по Y (поколениям)
    const byY = {};
    nodes.forEach(n => {
      const y = Math.round(parseFloat(n.style.top) / 50) * 50;
      if (!byY[y]) byY[y] = [];
      byY[y].push(n);
    });
    const sortedYs = Object.keys(byY).map(Number).sort((a, b) => a - b);
    sortedYs.forEach((y, i) => {
      byY[y].forEach(n => {
        setTimeout(() => n.classList.add('visible'), i * 120 + 100);
      });
    });
  }

  // ── Полосы поколений — рисуются один раз ─────────────────
  function renderBands() {
    const posVals = Object.values(positions);
    const labelX = posVals.length
      ? Math.min(...posVals.map(p => p.x)) - NODE_W - 8
      : 0;
    const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];
    const minGenY = posVals.length ? Math.min(...posVals.map(p => p.y)) : 0;
    const maxGenY = posVals.length ? Math.max(...posVals.map(p => p.y)) : 0;
    const genLines = [];
    for (let i = 0; minGenY + i * GEN_H <= maxGenY + GEN_H; i++) {
      genLines.push({ y: minGenY + i * GEN_H, label: `Поколение ${ROMAN[i] || i + 1}` });
    }
    const bandsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    genLines.forEach((ln, i) => {
      const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      r.setAttribute('x', labelX - 4); r.setAttribute('y', ln.y - 100);
      r.setAttribute('width', 6400); r.setAttribute('height', 200);
      r.setAttribute('fill', i % 2 ? 'rgba(255,255,255,0.022)' : 'rgba(255,255,255,0.011)');
      bandsGroup.appendChild(r);
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('x', labelX); t.setAttribute('y', ln.y - 80);
      t.setAttribute('fill', 'rgba(180,190,210,0.35)');
      t.setAttribute('font-size', '11'); t.setAttribute('font-family', 'Inter,sans-serif');
      t.textContent = ln.label;
      bandsGroup.appendChild(t);
    });
    svg.appendChild(bandsGroup);

    _svgLinesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svg.appendChild(_svgLinesGroup);
  }

  // ── Рендеринг линий соединений ────────────────────────────
  function renderLines(animated = true) {
    if (!_svgLinesGroup) renderBands();
    while (_svgLinesGroup.firstChild) _svgLinesGroup.removeChild(_svgLinesGroup.firstChild);

    const lines = [];
    const symbols = [];

    // ── 1. Горизонтальные линии между супругами ────────────────
    for (const couple of COUPLES) {
      if (!couple.p2 || couple.isStep) continue;
      const p1 = positions[couple.p1];
      const p2 = positions[couple.p2];
      if (!p1 || !p2) continue;
      const ly = p1.y + PHOTO_R;
      const x1 = Math.min(p1.x, p2.x) + PHOTO_R;
      const x2 = Math.max(p1.x, p2.x) - PHOTO_R;
      if (x1 >= x2) continue;
      lines.push({ d: `M${x1},${ly} H${x2}`, cls: 'conn-line couple-line', delay: 0, persons: [couple.p1, couple.p2] });
      symbols.push({ x: (x1 + x2) / 2, y: ly - 4 });
    }

    // ── 2. S-кривые Безье: пара → каждый ребёнок ─────────────
    for (const couple of COUPLES) {
      if (!couple.children || couple.children.length === 0) continue;
      if (couple.isInlaw) continue;
      if (couple.p1 === 'kalenteva_elena') continue;

      const p1pos = positions[couple.p1];
      if (!p1pos) continue;
      const p2pos = couple.p2 ? positions[couple.p2] : null;
      const pairCX = p2pos ? (p1pos.x + p2pos.x) / 2 : p1pos.x;
      const startY  = p1pos.y + PHOTO_R;
      const branchY = p1pos.y + Math.round(NODE_H * 0.45);

      const stemPersons = couple.p2 ? [couple.p1, couple.p2] : [couple.p1];
      // Короткий вертикальный отрезок от пары до точки ветвления
      lines.push({ d: `M${pairCX},${startY} V${branchY}`, cls: 'conn-line', delay: 150, persons: stemPersons });

      // S-кривая к каждому ребёнку
      for (const childId of couple.children) {
        const cp = positions[childId];
        if (!cp) continue;
        const endY = cp.y - 8;
        const midY = Math.round((branchY + endY) / 2);
        lines.push({
          d: `M${pairCX},${branchY} C${pairCX},${midY} ${cp.x},${midY} ${cp.x},${endY}`,
          cls: 'conn-line',
          delay: 350,
          persons: [...stemPersons, childId]
        });
      }
    }

    // ── 3. Безье от родителей супругов к их детям ────────────
    const inlawPairs = [
      { child: 'zhurbin_sergei',     coupleId: 'c_zhurbin_parents' },
      { child: 'bondarenko_mikhail', coupleId: 'c_bondarenko_parents' },
      { child: 'marina_zhuravleva',  coupleId: 'c_zhuravlev_parents' },
      { child: 'zhuravlev_egor',     coupleId: 'c_zhuravlev_parents' },
      { child: 'rudichev_nikita',    coupleId: 'c_rudichev_parents' },
    ];
    for (const { child, coupleId } of inlawPairs) {
      const childPos = positions[child];
      const cpl = getCoupleById(coupleId);
      if (!childPos || !cpl) continue;
      const p1p = positions[cpl.p1];
      const p2p = cpl.p2 ? positions[cpl.p2] : null;
      if (!p1p) continue;
      const parentCX = p2p ? (p1p.x + p2p.x) / 2 : p1p.x;
      const startY = p1p.y + PHOTO_R;
      const endY   = childPos.y - 8;
      const midY   = Math.round((startY + endY) / 2);
      lines.push({
        d: `M${parentCX},${startY} C${parentCX},${midY} ${childPos.x},${midY} ${childPos.x},${endY}`,
        cls: 'conn-line',
        delay: 500,
        persons: [cpl.p1, ...(cpl.p2 ? [cpl.p2] : []), child]
      });
    }

    // ── 4а. Киселев Дмитрий (бывший муж Елены) — пунктир ────
    const kiselev_dmitryP = positions['kiselev_dmitry'];
    const elenaPos0 = positions['kalenteva_elena'];
    if (elenaPos0 && kiselev_dmitryP) {
      const ly = elenaPos0.y + PHOTO_R;
      const x1 = Math.min(elenaPos0.x, kiselev_dmitryP.x) + PHOTO_R;
      const x2 = Math.max(elenaPos0.x, kiselev_dmitryP.x) - PHOTO_R;
      if (x1 < x2) {
        lines.push({
          d: `M${x1},${ly} H${x2}`,
          cls: 'conn-line step-line',
          delay: 100,
          persons: ['kalenteva_elena', 'kiselev_dmitry']
        });
      }
    }

    // ── 4б. Зинченко: отец → Виктор и Михаил ────────────────
    const zinSrPos = positions['zinchenko_mikhail_sr'];
    const zinVicPos = positions['zinchenko_victor'];
    const zinMikPos = positions['zinchenko_mikhail'];
    if (zinSrPos && zinVicPos && zinMikPos) {
      const startX = zinSrPos.x;
      const startY = zinSrPos.y + PHOTO_R;
      const branchY = zinSrPos.y + Math.round(NODE_H * 0.45);
      lines.push({ d: `M${startX},${startY} V${branchY}`, cls: 'conn-line', delay: 500, persons: ['zinchenko_mikhail_sr'] });
      for (const [childId, cp] of [['zinchenko_victor', zinVicPos], ['zinchenko_mikhail', zinMikPos]]) {
        const endY = cp.y - 8;
        const midY = Math.round((branchY + endY) / 2);
        lines.push({
          d: `M${startX},${branchY} C${startX},${midY} ${cp.x},${midY} ${cp.x},${endY}`,
          cls: 'conn-line',
          delay: 600,
          persons: ['zinchenko_mikhail_sr', childId]
        });
      }
    }

    // ── 4. Ивлев (бывший муж Ирины) — пунктир от Боронина к Ивлеву ──
    const ivlevP   = positions['ivlev_gennady'];
    const koroninP = positions['koronin_vladimir'];
    const irinaP2  = positions['irina_levkina'];
    if (ivlevP && irinaP2) {
      const ly = irinaP2.y + PHOTO_R;
      const startX = irinaP2.x + PHOTO_R;
      const endX   = ivlevP.x - PHOTO_R;
      if (startX < endX) {
        lines.push({
          d: `M${startX},${ly} H${endX}`,
          cls: 'conn-line step-line',
          delay: 100,
          persons: ['irina_levkina', 'ivlev_gennady']
        });
      }
    }

    // ── 4. Елена → Евгений и Егор (S-кривые) ─────────────────
    const elenaPos = positions['kalenteva_elena'];
    if (elenaPos) {
      const branchY = elenaPos.y + PHOTO_R;
      for (const cId of ['c_elena_evgeny', 'c_elena_egor']) {
        const cpl = getCoupleById(cId);
        if (!cpl) continue;
        for (const childId of cpl.children) {
          const cp = positions[childId];
          if (!cp) continue;
          const endY = cp.y - 8;
          const midY = Math.round((branchY + endY) / 2);
          lines.push({
            d: `M${elenaPos.x},${branchY} C${elenaPos.x},${midY} ${cp.x},${midY} ${cp.x},${endY}`,
            cls: 'conn-line',
            delay: 400,
            persons: ['kalenteva_elena', childId]
          });
        }
      }
    }

    // ── 5. Пётр ↔ Елена (братская пунктирная линия) ──────────
    const petrPos = positions['kalentev_petr'];
    if (petrPos && elenaPos) {
      lines.push({
        d: `M${petrPos.x},${petrPos.y + PHOTO_R} L${elenaPos.x},${elenaPos.y + PHOTO_R}`,
        cls: 'conn-line sibling-line',
        delay: 600,
        persons: ['kalentev_petr', 'kalenteva_elena']
      });
    }

    // ── 6. Гунь Марина ↔ Гунь Наталья (сёстры) ───────────────
    const gunNatalyaP = positions['gun_natalya'];
    const gunMarinaP  = positions['gun_marina'];
    if (gunNatalyaP && gunMarinaP) {
      const ly = gunNatalyaP.y + PHOTO_R;
      lines.push({
        d: `M${gunNatalyaP.x + PHOTO_R},${ly} H${gunMarinaP.x - PHOTO_R}`,
        cls: 'conn-line sibling-line',
        delay: 600,
        persons: ['gun_natalya', 'gun_marina']
      });
    }

    // ── Рисуем все линии с анимацией ──────────────────────────
    let animIndex = 0;
    for (const line of lines) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('class', line.cls);
      _svgLinesGroup.appendChild(path);
      path.setAttribute('d', line.d);
      if (line.persons) path.setAttribute('data-persons', line.persons.join(','));
      try {
        const len = path.getTotalLength() || 200;
        if (animated) {
          path.style.strokeDasharray = len;
          path.style.strokeDashoffset = len;
          path.style.opacity = '0';
          const delay = 300 + animIndex * 30 + line.delay;
          setTimeout(() => {
            path.style.transition = `stroke-dashoffset 0.6s ease ${delay}ms, opacity 0.1s ease ${delay}ms`;
            path.style.strokeDashoffset = '0';
            path.style.opacity = '1';
          }, 0);
          animIndex++;
        } else {
          path.style.opacity = '1';
        }
      } catch (e) {
        path.style.opacity = '1';
      }
    }

    for (const sym of symbols) {
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('x', sym.x); t.setAttribute('y', sym.y);
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('font-size', '14'); t.setAttribute('fill', 'rgba(212,168,75,0.75)');
      t.setAttribute('font-family', 'Inter,sans-serif');
      t.textContent = '♥';
      _svgLinesGroup.appendChild(t);
    }
  }

  function renderConnections(animated = true) {
    if (!_svgLinesGroup) renderBands();
    renderLines(animated);
  }

  // ── D3 Zoom + Pan ─────────────────────────────────────────
  function initZoom() {
    _zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        const t = event.transform;
        transform = { x: t.x, y: t.y, k: t.k };
        nodesLayer.style.transform = `translate(${t.x}px,${t.y}px) scale(${t.k})`;
        svg.style.transform        = `translate(${t.x}px,${t.y}px) scale(${t.k})`;
      });
    const zoom = _zoom;

    d3.select(viewport).call(zoom);

    // Fit-to-screen при загрузке — только основное дерево (без родителей свойственников)
    const INLAW_IDS = new Set([
      'zhurbin_vladimir_sr', 'rudakova_tatiana',
      'bondarenko_vladimir_sr', 'kapikova_natalya',
      'zhuravlev_andrei', 'gun_natalya', 'gun_marina', 'zhuravlev_egor',
      'rudichev_gennady_sr', 'rudicheva_galina',
      'zinchenko_mikhail_sr'
    ]);
    const corePositions = Object.entries(positions)
      .filter(([id]) => !INLAW_IDS.has(id))
      .map(([, p]) => p);
    if (corePositions.length === 0) return;

    const xs = corePositions.map(p => p.x);
    const ys = corePositions.map(p => p.y);
    const minX = Math.min(...xs) - NODE_W;
    const maxX = Math.max(...xs) + NODE_W;
    const minY = Math.min(...ys) - 20;
    const maxY = Math.max(...ys) + NODE_H;

    const vpW = viewport.clientWidth;
    const vpH = viewport.clientHeight;
    const treeW = maxX - minX;
    const treeH = maxY - minY;

    const k = Math.min(vpW / treeW, vpH / treeH, 1) * 0.88;
    const tx = (vpW - treeW * k) / 2 - minX * k;
    const ty = (vpH - treeH * k) / 2 - minY * k;

    d3.select(viewport)
      .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(k));

    // Кнопки навигации
    document.getElementById('btn-roots').addEventListener('click', () => {
      const rootPerson = PEOPLE['ivan_kucherenko'];
      const pos = positions['ivan_kucherenko'] || positions['valentina_levkina'];
      if (!pos) return;
      zoomTo(pos.x, pos.y, 1.2, zoom);
    });

    document.getElementById('btn-latest').addEventListener('click', () => {
      const latestY = Math.max(...Object.values(positions).map(p => p.y));
      const latestNodes = Object.entries(positions).filter(([, p]) => p.y === latestY);
      if (latestNodes.length === 0) return;
      const avgX = latestNodes.reduce((s, [, p]) => s + p.x, 0) / latestNodes.length;
      zoomTo(avgX, latestY, 1.2, zoom);
    });

    // Двойной клик на фон — сброс
    viewport.addEventListener('dblclick', (e) => {
      if (e.target === viewport || e.target === svg || e.target.tagName === 'path') {
        d3.select(viewport).transition().duration(400)
          .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(k));
      }
    });

  }

  function zoomTo(x, y, scale, zoom) {
    const vpW = viewport.clientWidth;
    const vpH = viewport.clientHeight;
    const tx = vpW / 2 - x * scale;
    const ty = vpH / 2 - y * scale;
    d3.select(viewport).transition().duration(600)
      .call((zoom || _zoom).transform,
        d3.zoomIdentity.translate(tx, ty).scale(scale));
  }

  // ── Статистика по дереву ──────────────────────────────────
  let _treeStats = null;
  function calcTreeStats() {
    const lifespans = [], livingAges = [];
    const now = new Date().getFullYear();
    for (const p of Object.values(PEOPLE)) {
      if (!p.born) continue;
      const bp = p.born.split('.');
      const bYear = parseInt(bp.length === 3 ? bp[2] : bp[0]);
      if (isNaN(bYear) || bYear <= 0) continue;
      if (p.died) {
        const dYear = parseInt(p.died.split('.').pop()) || parseInt(p.died);
        if (!isNaN(dYear)) { const age = dYear - bYear; if (age > 0 && age < 130) lifespans.push(age); }
      } else {
        const age = now - bYear;
        if (age > 0 && age < 130) livingAges.push(age);
      }
    }
    const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
    return { avgLifespan: avg(lifespans), avgCurrentAge: avg(livingAges) };
  }

  // ── Подсветка связей ──────────────────────────────────────
  function applyFocus(personId) {
    const rel = getRelatives(personId);
    const lit = new Set([personId]);
    if (rel.parents) { if (rel.parents.p1) lit.add(rel.parents.p1); if (rel.parents.p2) lit.add(rel.parents.p2); }
    if (rel.spouse) lit.add(rel.spouse);
    rel.children.forEach(id => lit.add(id));
    nodesLayer.querySelectorAll('.person-node').forEach(n => {
      n.classList.toggle('dimmed', !lit.has(n.dataset.id));
      n.classList.toggle('highlighted', lit.has(n.dataset.id));
    });
    svg.querySelectorAll('.conn-line').forEach(path => {
      const persons = (path.dataset.persons || '').split(',').filter(Boolean);
      path.classList.toggle('dimmed-line', !persons.some(id => lit.has(id)));
    });
  }

  function clearFocus() {
    nodesLayer.querySelectorAll('.person-node').forEach(n => {
      n.classList.remove('dimmed', 'highlighted');
    });
    svg.querySelectorAll('.conn-line').forEach(path => path.classList.remove('dimmed-line'));
    const q = searchInput.value.trim().toLowerCase();
    if (q) {
      nodesLayer.querySelectorAll('.person-node').forEach(n => {
        const person = PEOPLE[n.dataset.id];
        const match = person && person.name.toLowerCase().includes(q);
        n.classList.toggle('dimmed', !match);
        n.classList.toggle('highlighted', !!match);
      });
    }
  }

  // ── Боковая панель ────────────────────────────────────────
  function openPanel(personId) {
    const person = PEOPLE[personId];
    if (!person) return;

    const alreadyOpen = panelOpen && activePersonId === personId;
    if (alreadyOpen) return;

    const wasOpen = panelOpen;
    activePersonId = personId;
    panelOpen = true;

    // Фото
    if (person.photo) {
      panelPhoto.src = person.photo;
      panelPhoto.style.display = 'block';
      panelPhotoPlaceholder.style.display = 'none';
      panelPhoto.onerror = () => { panelPhoto.style.display = 'none'; panelPhotoPlaceholder.style.display = 'flex'; };
    } else {
      panelPhoto.style.display = 'none';
      panelPhotoPlaceholder.style.display = 'flex';
    }

    // Имя с эффектом печатания (только при первом открытии)
    if (!wasOpen) {
      typewriterEffect(panelName, person.name);
    } else {
      panelName.textContent = person.name;
    }

    // Метаданные
    panelMeta.innerHTML = '';
    const metaRows = [];
    if (person.born)   metaRows.push(['Дата рождения', person.born]);
    if (person.died)   metaRows.push(['Дата смерти', person.died]);
    if (person.maiden) metaRows.push(['Девичья фамилия', person.maiden]);

    // Дата свадьбы / развода из пары
    const ownCouples = getCouplesForPerson(personId).filter(c => c.weddingDate || c.divorceDate);
    if (ownCouples.length > 0) {
      const mc = ownCouples[0];
      if (mc.weddingDate) metaRows.push(['Дата свадьбы', mc.weddingDate]);
      if (mc.divorceDate) metaRows.push(['Дата развода', mc.divorceDate]);
    }

    metaRows.forEach(([label, value]) => {
      panelMeta.appendChild(makeMetaRow(label, value));
    });

    if (person.born) {
      const bp = person.born.split('.');
      const bYear = parseInt(bp.length === 3 ? bp[2] : bp[0]);
      if (!isNaN(bYear)) {
        const eYear = person.died
          ? (parseInt(person.died.split('.').pop()) || parseInt(person.died))
          : new Date().getFullYear();
        const age = eYear - bYear;
        if (age > 0 && age < 130) {
          panelMeta.appendChild(makeMetaRow(
            person.died ? 'Прожил(а)' : 'Возраст',
            `${age} лет`
          ));
        }
      }
    }

    if (_treeStats === null) _treeStats = calcTreeStats();
    if (_treeStats.avgLifespan) {
      panelMeta.appendChild(makeMetaRow('Ср. продолжит. жизни', `${_treeStats.avgLifespan} лет`, 'panel-meta-stat'));
    }
    if (_treeStats.avgCurrentAge) {
      panelMeta.appendChild(makeMetaRow('Ср. возраст живых', `${_treeStats.avgCurrentAge} лет`, 'panel-meta-stat'));
    }

    // Родственники
    panelRelatives.innerHTML = '';
    const rel = getRelatives(personId);

    if (rel.parents && (rel.parents.p1 || rel.parents.p2)) {
      const group = makeRelGroup('Родители');
      if (rel.parents.p1) group.appendChild(makeChip(rel.parents.p1));
      if (rel.parents.p2) group.appendChild(makeChip(rel.parents.p2));
      panelRelatives.appendChild(group);
    }

    if (rel.spouse) {
      const group = makeRelGroup('Супруг / Супруга');
      group.appendChild(makeChip(rel.spouse));
      panelRelatives.appendChild(group);
    }

    if (rel.children.length > 0) {
      const group = makeRelGroup('Дети');
      rel.children.forEach(id => group.appendChild(makeChip(id)));
      panelRelatives.appendChild(group);
    }

    if (rel.siblings.length > 0) {
      const group = makeRelGroup('Братья / Сёстры');
      rel.siblings.forEach(id => group.appendChild(makeChip(id)));
      panelRelatives.appendChild(group);
    }

    // Отчим отметка
    if (person.isStepparent) {
      const note = document.createElement('p');
      note.style.cssText = 'font-size:12px;color:var(--text-muted);margin-top:8px;';
      note.textContent = '* Отчим / Мачеха';
      panelRelatives.appendChild(note);
    }

    nodesLayer.querySelectorAll('.person-node.active').forEach(n => n.classList.remove('active'));
    const activeNode = nodesLayer.querySelector(`[data-id="${personId}"]`);
    if (activeNode) activeNode.classList.add('active');

    applyFocus(personId);
    panel.classList.add('open');
  }

  function makeMetaRow(label, value, extraClass) {
    const row = document.createElement('div');
    row.className = 'panel-meta-row' + (extraClass ? ' ' + extraClass : '');
    const ls = document.createElement('span');
    ls.className = 'meta-label';
    ls.textContent = label;
    const vs = document.createElement('span');
    vs.className = 'meta-value';
    vs.textContent = value;
    row.appendChild(ls);
    row.appendChild(vs);
    return row;
  }

  function makeRelGroup(title) {
    const group = document.createElement('div');
    group.className = 'relatives-group';
    const titleEl = document.createElement('div');
    titleEl.className = 'relatives-group-title';
    titleEl.textContent = title;
    group.appendChild(titleEl);
    return group;
  }

  function makeChip(personId) {
    const person = PEOPLE[personId];
    if (!person) return document.createTextNode('');

    const chip = document.createElement('div');
    chip.className = 'relative-chip';

    const photoWrap = document.createElement('div');
    photoWrap.className = 'relative-chip-photo';
    if (person.photo) {
      const img = document.createElement('img');
      img.src = person.photo; img.alt = '';
      img.onerror = () => { img.style.display = 'none'; photoWrap.appendChild(makePlaceholderIcon()); };
      photoWrap.appendChild(img);
    } else {
      photoWrap.appendChild(makePlaceholderIcon());
    }

    const name = document.createElement('span');
    name.textContent = person.name.split(' ').slice(0, 2).join(' ');

    chip.appendChild(photoWrap);
    chip.appendChild(name);
    chip.addEventListener('click', () => {
      openPanel(personId);
      const pos = positions[personId];
      if (pos) zoomTo(pos.x, pos.y, 1.4);
    });
    return chip;
  }

  function typewriterEffect(el, text) {
    clearTimeout(typewriterTimer);
    el.textContent = '';
    let i = 0;
    function tick() {
      if (i <= text.length) {
        el.textContent = text.slice(0, i);
        i++;
        typewriterTimer = setTimeout(tick, 28);
      }
    }
    tick();
  }

  panelClose.addEventListener('click', () => {
    clearTimeout(typewriterTimer);
    panel.classList.remove('open');
    panelOpen = false;
    activePersonId = null;
    nodesLayer.querySelectorAll('.person-node.active').forEach(n => n.classList.remove('active'));
    clearFocus();
  });

  viewport.addEventListener('click', (e) => {
    if (panelOpen && !panel.contains(e.target) && !e.target.closest('.person-node')) {
      panel.classList.remove('open');
      panelOpen = false;
      activePersonId = null;
      nodesLayer.querySelectorAll('.person-node.active').forEach(n => n.classList.remove('active'));
      clearFocus();
    }
  });

  // ── Поиск ─────────────────────────────────────────────────
  function initSearch() {
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      searchClear.style.display = q ? 'block' : 'none';
      const nodes = nodesLayer.querySelectorAll('.person-node');
      if (!q) {
        nodes.forEach(n => { n.classList.remove('dimmed', 'highlighted'); });
        return;
      }
      nodes.forEach(n => {
        const person = PEOPLE[n.dataset.id];
        const match = person && person.name.toLowerCase().includes(q);
        n.classList.toggle('dimmed', !match);
        n.classList.toggle('highlighted', !!match);
      });
    });
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      searchClear.style.display = 'none';
      nodesLayer.querySelectorAll('.person-node').forEach(n => {
        n.classList.remove('dimmed', 'highlighted');
      });
      if (panelOpen && activePersonId) applyFocus(activePersonId);
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const q = searchInput.value.trim().toLowerCase();
      if (!q) return;
      const found = Object.entries(PEOPLE).find(([, p]) => p.name.toLowerCase().includes(q));
      if (!found) return;
      const [id] = found;
      const pos = positions[id];
      if (pos) zoomTo(pos.x, pos.y, 1.4);
      openPanel(id);
    });
  }

  // ── Статистика ────────────────────────────────────────────
  function initStats() {
    const total = Object.keys(PEOPLE).length;
    const ys = Object.values(positions).map(p => p.y);
    const genCount = new Set(ys.map(y => Math.round(y / GEN_H))).size;
    document.getElementById('toolbar-stats').textContent =
      `${total} чел. · ${genCount} поколений`;
  }

  // ── Дни рождения: полный список (dropdown) ────────────────
  function initBirthday() {
    const btn = document.getElementById('btn-birthday');
    if (!btn) return;

    const MONTHS_RU = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
    const today = new Date();

    // Собираем всех с полной датой рождения (живых)
    const list = [];
    for (const [id, person] of Object.entries(PEOPLE)) {
      if (!person.born || person.died) continue;
      const parts = person.born.split('.');
      if (parts.length < 3 || !parseInt(parts[2])) continue;
      const day   = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      let next = new Date(today.getFullYear(), month, day);
      if (next <= today) next = new Date(today.getFullYear() + 1, month, day);
      const daysLeft = Math.ceil((next - today) / 86400000);
      list.push({ id, person, day, month, daysLeft });
    }
    list.sort((a, b) => a.daysLeft - b.daysLeft);

    // Строим dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'bd-dropdown';

    const header = document.createElement('div');
    header.className = 'bd-dropdown-header';
    header.textContent = 'Дни рождения';
    dropdown.appendChild(header);

    for (const item of list) {
      const row = document.createElement('div');
      row.className = 'bd-item' + (item.daysLeft <= 30 ? ' soon' : '');

      const info = document.createElement('div');
      info.className = 'bd-item-info';

      const nameEl = document.createElement('div');
      nameEl.className = 'bd-item-name';
      nameEl.textContent = item.person.name.split(' ').slice(0, 2).join(' ');

      const dateEl = document.createElement('div');
      dateEl.className = 'bd-item-date';
      dateEl.textContent = `${item.day} ${MONTHS_RU[item.month]}`;

      info.appendChild(nameEl);
      info.appendChild(dateEl);

      const badge = document.createElement('div');
      badge.className = 'bd-item-badge';
      if (item.daysLeft === 0)      badge.textContent = 'Сегодня!';
      else if (item.daysLeft === 1) badge.textContent = 'Завтра';
      else if (item.daysLeft <= 14) badge.textContent = `через ${item.daysLeft} дн.`;
      else if (item.daysLeft <= 60) badge.textContent = `через ${item.daysLeft} дн.`;
      else                          badge.textContent = `через ${Math.round(item.daysLeft / 30)} мес.`;

      row.appendChild(info);
      row.appendChild(badge);

      row.addEventListener('click', () => {
        dropdown.classList.remove('open');
        openPanel(item.id);
        const pos = positions[item.id];
        if (pos) zoomTo(pos.x, pos.y, 1.4);
      });

      dropdown.appendChild(row);
    }

    document.body.appendChild(dropdown);

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const rect = btn.getBoundingClientRect();
      dropdown.style.top   = (rect.bottom + 6) + 'px';
      dropdown.style.right = (window.innerWidth - rect.right) + 'px';
      dropdown.style.left  = 'auto';
      dropdown.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && e.target !== btn) {
        dropdown.classList.remove('open');
      }
    });
  }

  // ── Кнопки тулбара ────────────────────────────────────────
  function initToolbar() {
    // PNG
    document.getElementById('btn-png').addEventListener('click', downloadPNG);

    // Поделиться
    document.getElementById('btn-share').addEventListener('click', () => {
      navigator.clipboard.writeText(window.location.href)
        .then(() => showToast('Ссылка скопирована!'))
        .catch(() => showToast('Не удалось скопировать'));
    });

    document.getElementById('btn-suggest').addEventListener('click', () => {
      if (!YANDEX_FORM_URL || YANDEX_FORM_URL.endsWith('/u/')) {
        showToast('Форма для правок ещё не настроена');
        return;
      }
      window.open(YANDEX_FORM_URL, '_blank', 'noopener,noreferrer');
    });

    document.getElementById('btn-reset').addEventListener('click', () => {
      if (confirm('Сбросить позиции всех узлов к исходным?')) {
        localStorage.removeItem('ft-positions');
        location.reload();
      }
    });
  }

  function downloadPNG() {
    if (typeof html2canvas === 'undefined') {
      showToast('Библиотека экспорта не загружена');
      return;
    }
    showToast('Подготовка изображения...');
    const starsCanvas = document.getElementById('stars-canvas');
    html2canvas(viewport, {
      backgroundColor: '#0c0f1a',
      useCORS: true,
      logging: false,
      scale: window.devicePixelRatio || 1,
      ignoreElements: el => el === starsCanvas
    }).then(canvas => {
      const link = document.createElement('a');
      link.download = 'family-tree-levkiny.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('Сохранено!');
    }).catch(() => showToast('Ошибка экспорта'));
  }

  // ── Toast ──────────────────────────────────────────────────
  let toastTimer;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2500);
  }

  // ── Звёздный фон ──────────────────────────────────────────
  function initStars() {
    const canvas = document.getElementById('stars-canvas');
    const ctx = canvas.getContext('2d');
    let stars = [];
    let raf;

    function resize() {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      stars = Array.from({ length: 80 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.2 + 0.2,
        a: Math.random(),
        da: (Math.random() - 0.5) * 0.005
      }));
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach(s => {
        s.a = Math.max(0.05, Math.min(0.6, s.a + s.da));
        if (s.a <= 0.05 || s.a >= 0.6) s.da *= -1;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${currentStarRgb},${s.a})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else draw();
    });
    draw();
  }


  // ── Drag-and-drop позиционирование (с мультиселектом) ────
  function initDragDrop() {
    const style = document.createElement('style');
    style.textContent = [
      '.person-node{cursor:grab;touch-action:none}',
      '.person-node.dragging{cursor:grabbing;opacity:.85;z-index:1000}',
      '.person-node.selected .node-card{border-color:rgba(100,165,255,0.65)!important;box-shadow:0 0 0 2px rgba(80,145,240,0.25),0 4px 18px rgba(0,0,0,0.55)!important}',
      '.person-node.selected .node-photo-wrap{border-color:rgba(100,165,255,0.70)!important}'
    ].join('');
    document.head.appendChild(style);

    const selectedIds = new Set();
    let dragging = null;
    let suppressNextClick = false;

    function selectNode(id) {
      selectedIds.add(id);
      const el = nodesLayer.querySelector(`[data-id="${id}"]`);
      if (el) el.classList.add('selected');
    }

    function deselectNode(id) {
      selectedIds.delete(id);
      const el = nodesLayer.querySelector(`[data-id="${id}"]`);
      if (el) el.classList.remove('selected');
    }

    function toggleSelect(id) {
      if (selectedIds.has(id)) deselectNode(id);
      else selectNode(id);
    }

    function clearSelection() {
      for (const id of [...selectedIds]) deselectNode(id);
    }

    function startDrag(id, clientX, clientY) {
      // Если перетаскиваем уже выбранный узел — двигаем всю группу
      const ids = (selectedIds.has(id) && selectedIds.size > 1)
        ? [...selectedIds]
        : [id];
      const nodes = ids.map(nId => {
        const pos = positions[nId];
        const div = nodesLayer.querySelector(`[data-id="${nId}"]`);
        return (pos && div) ? { id: nId, div, startX: pos.x, startY: pos.y } : null;
      }).filter(Boolean);
      if (nodes.length === 0) return;
      dragging = { nodes, startMouseX: clientX, startMouseY: clientY, moved: false };
    }

    let dragRafId = null;
    function moveDrag(clientX, clientY) {
      if (!dragging) return;
      const dx = (clientX - dragging.startMouseX) / transform.k;
      const dy = (clientY - dragging.startMouseY) / transform.k;
      if (!dragging.moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      dragging.moved = true;
      for (const node of dragging.nodes) {
        node.div.classList.add('dragging');
        positions[node.id] = { x: node.startX + dx, y: node.startY + dy };
        node.div.style.left = positions[node.id].x + 'px';
        node.div.style.top  = positions[node.id].y + 'px';
      }
      if (!dragRafId) {
        dragRafId = requestAnimationFrame(() => {
          renderLines(false);
          dragRafId = null;
        });
      }
    }

    function endDrag() {
      if (!dragging) return;
      if (dragRafId) { cancelAnimationFrame(dragRafId); dragRafId = null; }
      for (const node of dragging.nodes) node.div.classList.remove('dragging');
      if (dragging.moved) {
        suppressNextClick = true;
        try { localStorage.setItem('ft-positions', JSON.stringify(positions)); } catch (e) {}
      }
      dragging = null;
    }

    nodesLayer.addEventListener('mousedown', (e) => {
      const node = e.target.closest('.person-node');
      if (!node) return;
      e.stopPropagation();
      const id = node.dataset.id;
      if (e.ctrlKey || e.metaKey) {
        toggleSelect(id);
        return;
      }
      // Обычный клик: если узел не выбран — снять выделение и тащить только его
      if (!selectedIds.has(id)) clearSelection();
      startDrag(id, e.clientX, e.clientY);
    });

    document.addEventListener('mousemove', (e) => moveDrag(e.clientX, e.clientY));
    document.addEventListener('mouseup', endDrag);

    // Клик на пустой фон — снять выделение
    viewport.addEventListener('click', (e) => {
      if (suppressNextClick) { suppressNextClick = false; return; }
      if (!e.target.closest('.person-node') && !e.ctrlKey && !e.metaKey) clearSelection();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') clearSelection();
    });

    nodesLayer.addEventListener('touchstart', (e) => {
      const node = e.target.closest('.person-node');
      if (!node) return;
      e.stopPropagation();
      const id = node.dataset.id;
      if (!selectedIds.has(id)) clearSelection();
      const t = e.touches[0];
      startDrag(id, t.clientX, t.clientY);
    }, { passive: false });
    document.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      e.preventDefault();
      const t = e.touches[0];
      moveDrag(t.clientX, t.clientY);
    }, { passive: false });
    document.addEventListener('touchend', endDrag);

    nodesLayer.addEventListener('click', (e) => {
      if (suppressNextClick) { e.stopPropagation(); suppressNextClick = false; }
    }, true);

    window.resetPositions = () => { localStorage.removeItem('ft-positions'); location.reload(); };
  }

  // ── Мобильный backdrop для панели ────────────────────────
  function initBackdrop() {
    const backdrop = document.createElement('div');
    backdrop.className = 'panel-backdrop';
    document.body.appendChild(backdrop);

    function closePanel() {
      clearTimeout(typewriterTimer);
      panel.classList.remove('open');
      backdrop.classList.remove('active');
      panelOpen = false;
      activePersonId = null;
      nodesLayer.querySelectorAll('.person-node.active').forEach(n => n.classList.remove('active'));
      clearFocus();
    }

    backdrop.addEventListener('click', closePanel);

    const _origOpen = panel.classList.add.bind(panel.classList);
    const _origRemove = panel.classList.remove.bind(panel.classList);

    const observer = new MutationObserver(() => {
      if (panel.classList.contains('open')) backdrop.classList.add('active');
      else backdrop.classList.remove('active');
    });
    observer.observe(panel, { attributes: true, attributeFilter: ['class'] });
  }

  // ── Инициализация ─────────────────────────────────────────
  function init() {
    validateData();
    initStars();
    buildLayout();
    renderNodes();
    renderConnections();
    initZoom();
    animateNodes();
    initSearch();
    initStats();
    initBirthday();
    initToolbar();
    initDragDrop();
    initBackdrop();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
