// Layout constants
const CARD_W   = 130;
const CARD_H   = 180;
const COL_W    = 120;
const ROW_H    = 260;
const PAD_L    = 88;   // left padding - space for generation labels
const PAD_T    = 40;
const PAD_B    = 60;
const PHOTO_CY = 45;   // photo circle center Y from card top
const VIRTUAL_PAD = 2000; // empty scrollable space around the tree on each side

let DATA = null;

const state = {
  view: 'tree',          // 'tree' | 'overview' | 'search' | 'profile:{id}'
  popup: null,           // member id
  overlay: null,         // 'birthdays' | 'legend'
  searchQuery: '',
  overviewScale: null,   // computed on first open
  treeScrollLeft: null,
  treeScrollTop: 0,
  treeScale: 1,
};

// ── Boot ─────────────────────────────────────────────────────────

async function init() {
  try {
    const res = await fetch('data.json');
    DATA = await res.json();
  } catch (e) {
    document.getElementById('app').textContent = 'Ошибка загрузки data.json';
    return;
  }

  render();
}

// ── State helpers ─────────────────────────────────────────────────

function navigate(view) {
  state.view = view;
  state.popup = null;
  state.overlay = null;
  render();
}

function openPopup(id) {
  state.popup = id;
  state.overlay = null;
  render();
}

function openOverlay(name) {
  state.overlay = name;
  state.popup = null;
  render();
}

function closeAll() {
  state.popup = null;
  state.overlay = null;
  render();
}

// ── Main render ───────────────────────────────────────────────────

function render() {
  const app = document.getElementById('app');
  const nav = document.getElementById('nav');
  const root = document.getElementById('overlay-root');

  if (state.view === 'tree') {
    if (state.treeScrollLeft === null) {
      const { w, h } = canvasSize();
      state.treeScale = Math.min(window.innerWidth / w, (window.innerHeight - 88) / h);
    }
    app.innerHTML = buildTree();
  } else if (state.view === 'overview') {
    app.innerHTML = buildOverview();
  } else if (state.view === 'search') {
    app.innerHTML = buildSearch();
  } else if (state.view.startsWith('profile:')) {
    app.innerHTML = buildProfile(state.view.slice(8));
  }

  nav.innerHTML = buildNav();

  root.innerHTML = state.popup ? buildPopup(state.popup)
    : state.overlay === 'birthdays' ? buildBirthdays()
    : state.overlay === 'legend' ? buildLegend()
    : '';

  bindEvents();

  if (state.view === 'tree' || state.view === 'overview') {
    requestAnimationFrame(drawLines);
  }

  if (state.view === 'tree') {
    requestAnimationFrame(restoreTreeScroll);
  }

  if (state.view === 'overview') {
    requestAnimationFrame(applyOverviewScale);
  }
}

// ── Canvas helpers ────────────────────────────────────────────────

function canvasSize() {
  const maxCol = Math.max(...DATA.members.map(m => m.col));
  const maxRow = Math.max(...DATA.members.map(m => m.row));

  return {
    w: PAD_L + (maxCol + 1) * COL_W + 40,
    h: PAD_T + (maxRow + 1) * ROW_H + PAD_B,
    maxRow,
  };
}

function cardPos(m) {
  const x = PAD_L + m.col * COL_W;
  const y = PAD_T + m.row * ROW_H;

  return {
    x,
    y,
    cx: x + CARD_W / 2,
    top: y,
    bottom: y + CARD_H
  };
}

function buildCardHtml(m) {
  const { x, y } = cardPos(m);

  const isDeceased  = !!m.deathDate;
  const isDashed    = /отчим|мачеха/i.test(m.role || '');
  const photoClass  = isDashed ? 'card-photo card-photo--dashed' : 'card-photo';
  const cardClass   = isDeceased ? 'card card--deceased' : 'card';

  const photo = m.photo
    ? `<img src="${m.photo}" alt="${m.name}">`
    : `<div class="photo-placeholder"></div>`;

  return `
    <div class="${cardClass}" data-id="${m.id}" style="left:${x}px;top:${y}px;width:${CARD_W}px">
      <div class="${photoClass}">${photo}</div>
      <div class="card-name">${m.name}</div>
      <div class="card-dates">${fmtDates(m)}</div>
      ${m.role ? `<div class="card-role">${m.role.toUpperCase()}</div>` : ''}
    </div>`;
}

function buildGenLabels(maxRow) {
  return Array.from({ length: maxRow + 1 }, (_, row) => {
    const y = PAD_T + row * ROW_H + CARD_H / 2;
    return `<div class="gen-label" style="top:${y}px;left:8px">${row + 1}-е поколение</div>`;
  }).join('');
}

function buildCanvasInner(w, h, maxRow) {
  return `
    <div class="tree-canvas" id="tree-canvas" style="width:${w}px;height:${h}px">
      <svg id="lines-svg" style="position:absolute;top:0;left:0;width:${w}px;height:${h}px;pointer-events:none;overflow:visible"></svg>
      ${buildGenLabels(maxRow)}
      ${DATA.members.map(buildCardHtml).join('')}
    </div>`;
}

// ── View builders ─────────────────────────────────────────────────

function buildTree() {
  const { w, h, maxRow } = canvasSize();
  const scaledW = w * state.treeScale;
  const scaledH = h * state.treeScale;

  return `
    <div class="tree-view-wrap">
      <div class="tree-scroll" id="tree-scroll">
        <div class="tree-scale-spacer" style="width:${scaledW + VIRTUAL_PAD * 2}px;height:${scaledH + VIRTUAL_PAD * 2}px;position:relative">
          <div
            id="tree-scale-inner"
            style="position:absolute;left:${VIRTUAL_PAD}px;top:${VIRTUAL_PAD}px;width:${w}px;height:${h}px;transform:scale(${state.treeScale});transform-origin:top left"
          >
            ${buildCanvasInner(w, h, maxRow)}
          </div>
        </div>
      </div>
    </div>`;
}

function buildOverview() {
  const { w, h, maxRow } = canvasSize();
  const rows = maxRow + 1;

  return `
    <div class="overview-wrap">
      <div class="overview-header">
        <span class="overview-title">обзор дерева</span>
        <span class="overview-count">${rows} поколений</span>
      </div>
      <div class="overview-canvas-wrap" id="ov-wrap">
        <div class="overview-canvas-inner" id="ov-inner">
          ${buildCanvasInner(w, h, maxRow)}
        </div>
      </div>
      <div class="overview-zoom">
        <button class="zoom-btn" id="zoom-in">+</button>
        <button class="zoom-btn" id="zoom-out">−</button>
      </div>
    </div>`;
}

function buildSearch() {
  const q = state.searchQuery;
  const recent = JSON.parse(localStorage.getItem('ft-recent') || '[]');

  const results = q
    ? DATA.members.filter(m => m.name.toLowerCase().includes(q.toLowerCase()))
    : [];

  const recentHtml = !q && recent.length ? `
    <div>
      <div class="section-label">НЕДАВНИЕ ПОИСКИ</div>
      <div class="recent-tags">
        ${recent.map(r => `<button class="recent-tag" data-recent="${r}">${r}</button>`).join('')}
      </div>
    </div>` : '';

  const resultsHtml = q ? (results.length ? `
    <div>
      <div class="section-label">РЕЗУЛЬТАТЫ</div>
      <div class="search-results">
        ${results.map(m => `
          <button class="result-item" data-id="${m.id}">
            <div class="result-photo">${m.photo ? `<img src="${m.photo}">` : '<div class="photo-placeholder" style="width:100%;height:100%"></div>'}</div>
            <div>
              <div class="result-name">${m.name}</div>
              <div class="result-dates">${fmtDates(m)}</div>
            </div>
            <span class="result-arrow">›</span>
          </button>`).join('')}
      </div>
    </div>` : `<p class="no-results">Ничего не найдено</p>`) : '';

  return `
    <div class="search-view">
      <div class="search-bar">
        <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input class="search-input" id="search-input" type="search" dir="ltr" placeholder="Поиск по имени…" value="${q}">
      </div>
      ${recentHtml}
      ${resultsHtml}
    </div>`;
}

function buildProfile(id) {
  const m = DATA.members.find(x => x.id === id);

  if (!m) {
    return '<div style="padding:24px;color:var(--muted)">Не найдено</div>';
  }

  const byId = Object.fromEntries(DATA.members.map(x => [x.id, x]));

  function gender(mem) {
    const parts = mem.name.trim().split(' ');
    const last = parts[0];
    return (last.endsWith('а') || last.endsWith('я')) ? 'f' : 'm';
  }

  const relMap = new Map(); // id → {m, label, order}

  DATA.families.forEach(f => {
    const inParents  = f.parents.includes(id);
    const inChildren = f.children.includes(id);

    if (inParents) {
      f.parents.forEach(pid => {
        if (pid === id || relMap.has(pid)) return;
        const rel = byId[pid]; if (!rel) return;
        const g = gender(rel);
        const isDiv = f.coupleType === 'divorced';
        relMap.set(pid, { m: rel, order: isDiv ? 1 : 0, label: isDiv ? (g === 'f' ? 'Бывшая супруга' : 'Бывший супруг') : (g === 'f' ? 'Супруга' : 'Супруг') });
      });
      f.children.forEach(cid => {
        if (relMap.has(cid)) return;
        const rel = byId[cid]; if (!rel) return;
        relMap.set(cid, { m: rel, order: 2, label: gender(rel) === 'f' ? 'Дочь' : 'Сын' });
      });
    }

    if (inChildren) {
      f.parents.forEach(pid => {
        if (relMap.has(pid)) return;
        const rel = byId[pid]; if (!rel) return;
        relMap.set(pid, { m: rel, order: 3, label: gender(rel) === 'f' ? 'Мать' : 'Отец' });
      });
      f.children.forEach(sid => {
        if (sid === id || relMap.has(sid)) return;
        const rel = byId[sid]; if (!rel) return;
        relMap.set(sid, { m: rel, order: 4, label: gender(rel) === 'f' ? 'Сестра' : 'Брат' });
      });
    }
  });

  const relSorted = [...relMap.values()].sort((a, b) => a.order - b.order);

  const photo = m.photo ? `<img src="${m.photo}" alt="${m.name}">` : '<div class="photo-placeholder" style="width:100%;height:100%"></div>';

  const timelineHtml = m.timeline && m.timeline.length
    ? m.timeline.map(t => `
        <div class="timeline-entry">
          <div class="timeline-dot-col"><div class="timeline-dot"></div></div>
          <div><div class="timeline-year">${t.year}</div><div class="timeline-text">${t.text}</div></div>
        </div>`).join('')
    : '<p class="timeline-placeholder">Хронология будет добавлена позже</p>';

  const relativesHtml = relSorted.length ? `
    <div class="profile-section">
      <div class="profile-section-title">Родственники</div>
      <div class="relatives-grid">
        ${relSorted.map(({ m: r, label }) => `
          <button class="relative-card" data-id="${r.id}">
            <span class="relative-rel">${label}</span>
            <div class="relative-photo">${r.photo ? `<img src="${r.photo}">` : '<div class="photo-placeholder" style="width:100%;height:100%"></div>'}</div>
            <div class="relative-name">${r.name.split(' ').slice(0, 2).join(' ')}</div>
          </button>`).join('')}
      </div>
    </div>` : '';

  return `
    <div class="profile-view">
      <div class="profile-cover">
        <button class="back-btn" id="back-btn">←</button>
        <div class="profile-cover-photo">${photo}</div>
      </div>
      <div class="profile-body">
        <div class="profile-name">${m.name}</div>
        <div class="profile-dates">${fmtDates(m)}</div>
        ${m.role ? `<span class="profile-role-badge">${m.role.toUpperCase()}</span>` : ''}
        ${(() => {
          const rows = [];
          if (m.birthDate) rows.push(['Дата рождения', fmtFullDate(m.birthDate)]);
          if (m.deathDate)  rows.push(['Дата смерти',   fmtFullDate(m.deathDate)]);
          if (m.maiden)     rows.push(['Девичья фамилия', m.maiden]);
          const age = calcAge(m);
          if (age !== null) rows.push([m.deathDate ? 'Прожил(а)' : 'Возраст', `${age} лет`]);
          return rows.length ? `
            <div class="profile-info">
              ${rows.map(([label, val]) => `
                <div class="info-row">
                  <span class="info-label">${label}</span>
                  <span class="info-val">${val}</span>
                </div>`).join('')}
            </div>` : '';
        })()}
        ${(() => {
          const { avgLifespan, avgLivingAge } = calcFamilyStats();
          const items = [];
          if (avgLifespan !== null) items.push(`<div class="stat-item"><div class="stat-value">${avgLifespan} лет</div><div class="stat-label">Ср. продолжительность жизни</div></div>`);
          if (avgLivingAge !== null) items.push(`<div class="stat-item"><div class="stat-value">${avgLivingAge} лет</div><div class="stat-label">Ср. возраст живых</div></div>`);
          return items.length ? `<div class="profile-stats">${items.join('')}</div>` : '';
        })()}
        <div class="profile-section">
          <div class="profile-section-title">Биография</div>
          <div class="profile-bio">${m.bio || 'Биография не добавлена.'}</div>
        </div>
        <div class="profile-section">
          <div class="profile-section-title">Хронология</div>
          ${timelineHtml}
        </div>
        ${relativesHtml}
      </div>
    </div>`;
}

function buildNav() {
  const v = state.view;

  return `
    <button class="nav-btn ${v === 'search' ? 'active' : ''}" id="nav-search">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
    </button>
    <button class="nav-btn ${v === 'overview' ? 'active' : ''}" id="nav-home">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
        <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/>
      </svg>
    </button>
    <button class="nav-btn" id="nav-bday">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
        <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
      </svg>
    </button>
    <button class="nav-btn" id="nav-legend">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
        <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
      </svg>
    </button>`;
}

function buildPopup(id) {
  const m = DATA.members.find(x => x.id === id);

  if (!m) return '';

  const photo = m.photo
    ? `<img src="${m.photo}" alt="${m.name}">`
    : '<div class="photo-placeholder" style="width:100%;height:100%"></div>';

  const bioShort = m.bio
    ? (m.bio.match(/[^.!?]+[.!?]+/g) || [m.bio]).slice(0, 2).join(' ')
    : '';

  return `
    <div class="backdrop" id="backdrop"></div>
    <div class="bottom-sheet">
      <div class="sheet-handle"></div>
      <div class="popup-header">
        <div class="popup-photo">${photo}</div>
        <div>
          <div class="popup-name">${m.name}</div>
          <div class="popup-dates">${fmtDates(m)}</div>
          ${m.role ? `<div class="popup-role">${m.role.toUpperCase()}</div>` : ''}
        </div>
      </div>
      ${bioShort ? `<p class="popup-bio">${bioShort}</p>` : ''}
      <button class="btn-primary" id="popup-profile-btn" data-id="${m.id}">Полный профиль →</button>
    </div>`;
}

function buildBirthdays() {
  const now = new Date();
  const todayDoy = doy(now);
  const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

  const items = DATA.members
    .filter(m => m.birthDate && !m.deathDate && /^\d{4}-\d{2}-\d{2}$/.test(m.birthDate))
    .map(m => {
      const d = new Date(m.birthDate);
      const bd = new Date(now.getFullYear(), d.getMonth(), d.getDate());
      const diff = (doy(bd) - todayDoy + 366) % 366;

      return {
        m,
        diff,
        month: d.getMonth(),
        day: d.getDate()
      };
    })
    .sort((a, b) => a.diff - b.diff)
    .map(({ m, diff, month, day }) => {
      const pillClass = diff === 0 ? 'today' : diff <= 7 ? 'week' : diff <= 30 ? 'month' : 'far';
      const pillText  = diff === 0 ? 'сегодня' : diff === 1 ? 'завтра' : `через ${diff} дн.`;
      return `
      <div class="birthday-item">
        <div class="birthday-info">
          <span class="birthday-name">${m.name}</span>
          <span class="birthday-date">${day} ${MONTHS[month]}</span>
        </div>
        <span class="birthday-pill birthday-pill--${pillClass}">${pillText}</span>
      </div>`;
    }).join('');

  return `
    <div class="backdrop" id="backdrop"></div>
    <div class="bottom-sheet">
      <div class="sheet-handle"></div>
      <h3 style="font-size:17px;font-weight:700;margin-bottom:16px">Дни рождения</h3>
      <div class="birthday-list">${items || '<p class="no-results">Нет дат рождения</p>'}</div>
    </div>`;
}

function buildLegend() {
  return `
    <div class="backdrop" id="backdrop"></div>
    <div class="bottom-sheet">
      <div class="sheet-handle"></div>
      <h3 style="font-size:17px;font-weight:700;margin-bottom:18px">Связи</h3>
      <div class="legend-items">
        <div class="legend-item"><div class="legend-line marriage"></div><span class="legend-label">Брак</span></div>
        <div class="legend-item"><div class="legend-line dashed"></div><span class="legend-label">Бывший супруг(а)</span></div>
        <div class="legend-item"><div class="legend-line solid"></div><span class="legend-label">Родитель / Ребёнок</span></div>
      </div>
      <button class="btn-outline" id="close-legend-btn">Закрыть</button>
    </div>`;
}

// ── SVG lines ─────────────────────────────────────────────────────

function drawLines() {
  const svg = document.getElementById('lines-svg');

  if (!svg) return;

  const byId = Object.fromEntries(DATA.members.map(m => [m.id, m]));
  let out = '';

  DATA.families.forEach(fam => {
    const parents = fam.parents.map(id => byId[id]).filter(Boolean);
    const children = fam.children.map(id => byId[id]).filter(Boolean);

    if (!parents.length) return;

    let dropX;
    let dropY;

    if (parents.length >= 2) {
      const p1 = cardPos(parents[0]);
      const p2 = cardPos(parents[1]);

      const lx = Math.min(p1.cx, p2.cx);
      const rx = Math.max(p1.cx, p2.cx);
      const ly = ((p1.top + p2.top) / 2) + PHOTO_CY;

      const dash = fam.coupleType === 'divorced' ? 'stroke-dasharray="8 5"' : '';

      out += `<line x1="${lx}" y1="${ly}" x2="${rx}" y2="${ly}" stroke="var(--line)" stroke-width="2.5" stroke-linecap="round" ${dash}/>`;

      if (fam.coupleType === 'spouse') {
        const hx = (lx + rx) / 2;
        out += `<text x="${hx}" y="${ly + 7}" text-anchor="middle" fill="var(--accent)" font-size="30">♡</text>`;
      }

      dropX = (lx + rx) / 2;
      dropY = ly;
    } else {
      const p = cardPos(parents[0]);

      dropX = p.cx;
      dropY = p.bottom;
    }

    if (!children.length) return;

    const firstChild = cardPos(children[0]);
    const stemEndY = dropY + (firstChild.top - dropY) * 0.4;

    out += `<line x1="${dropX}" y1="${dropY}" x2="${dropX}" y2="${stemEndY}" stroke="var(--line)" stroke-width="1.8" stroke-linecap="round"/>`;

    children.forEach(child => {
      const c = cardPos(child);
      const cp1Y = stemEndY + (c.top - stemEndY) * 0.45;
      const cp2Y = c.top - (c.top - stemEndY) * 0.3;

      out += `<path d="M${dropX},${stemEndY} C${dropX},${cp1Y} ${c.cx},${cp2Y} ${c.cx},${c.top}" fill="none" stroke="var(--line)" stroke-width="1.8" stroke-linecap="round"/>`;
    });
  });

  svg.innerHTML = out;
}

// ── Events ────────────────────────────────────────────────────────

function bindEvents() {
  document.querySelectorAll('.card').forEach(el =>
    el.addEventListener('click', () => openPopup(el.dataset.id))
  );

  document.getElementById('nav-search')?.addEventListener('click', () => navigate('search'));
  document.getElementById('nav-home')?.addEventListener('click', () => {
    const { w, h } = canvasSize();
    const vpW = window.innerWidth;
    const vpH = window.innerHeight - 88;
    state.treeScale = Math.min(vpW / w, vpH / h);
    const scaledW = w * state.treeScale;
    const scaledH = h * state.treeScale;
    state.treeScrollLeft = VIRTUAL_PAD + (scaledW - vpW) / 2;
    state.treeScrollTop  = VIRTUAL_PAD + (scaledH - vpH) / 2;
    navigate('tree');
  });
  document.getElementById('nav-bday')?.addEventListener('click', () => openOverlay('birthdays'));
  document.getElementById('nav-legend')?.addEventListener('click', () => openOverlay('legend'));

  document.getElementById('backdrop')?.addEventListener('click', closeAll);
  document.getElementById('close-legend-btn')?.addEventListener('click', closeAll);

  document.getElementById('popup-profile-btn')?.addEventListener('click', e => {
    const id = e.currentTarget.dataset.id;
    state.popup = null;
    navigate('profile:' + id);
  });

  document.getElementById('back-btn')?.addEventListener('click', () => navigate('tree'));

  document.querySelectorAll('.relative-card').forEach(el =>
    el.addEventListener('click', () => navigate('profile:' + el.dataset.id))
  );

  const searchEl = document.getElementById('search-input');

  if (searchEl) {
    searchEl.focus();
    const len = searchEl.value.length;
    searchEl.setSelectionRange(len, len);

    searchEl.addEventListener('input', e => {
      state.searchQuery = e.target.value;
      render();
    });
  }

  document.querySelectorAll('.result-item').forEach(el =>
    el.addEventListener('click', () => {
      saveRecent(state.searchQuery);
      openPopup(el.dataset.id);
    })
  );

  document.querySelectorAll('.recent-tag').forEach(el =>
    el.addEventListener('click', () => {
      state.searchQuery = el.dataset.recent;
      render();
    })
  );

  document.getElementById('zoom-in')?.addEventListener('click', () => {
    state.overviewScale = Math.min((state.overviewScale || 0.4) + 0.08, 1.4);
    applyOverviewScale();
  });

  document.getElementById('zoom-out')?.addEventListener('click', () => {
    state.overviewScale = Math.max((state.overviewScale || 0.4) - 0.08, 0.12);
    applyOverviewScale();
  });

  bindTreeDrag();
}

// ── Tree drag / pan / pinch-zoom ─────────────────────────────────

function bindTreeDrag() {
  const scroller = document.getElementById('tree-scroll');
  if (!scroller) return;

  scroller.style.cursor = 'grab';
  scroller.style.touchAction = 'none';

  let moved = false;

  function applyScale(newScale, centerX, centerY) {
    const prev = state.treeScale;
    // subtract VIRTUAL_PAD to get position within the tree content
    const contentX = (scroller.scrollLeft - VIRTUAL_PAD + centerX) / prev;
    const contentY = (scroller.scrollTop  - VIRTUAL_PAD + centerY) / prev;
    state.treeScale = Math.max(0.12, Math.min(3, newScale));
    const { w, h } = canvasSize();
    const inner  = document.getElementById('tree-scale-inner');
    const spacer = document.querySelector('.tree-scale-spacer');
    if (inner)  inner.style.transform = `scale(${state.treeScale})`;
    if (spacer) {
      spacer.style.width  = (w * state.treeScale + VIRTUAL_PAD * 2) + 'px';
      spacer.style.height = (h * state.treeScale + VIRTUAL_PAD * 2) + 'px';
    }
    scroller.scrollLeft = contentX * state.treeScale + VIRTUAL_PAD - centerX;
    scroller.scrollTop  = contentY * state.treeScale + VIRTUAL_PAD - centerY;
    state.treeScrollLeft = scroller.scrollLeft;
    state.treeScrollTop  = scroller.scrollTop;
  }

  // ── Touch (mobile) ───────────────────────────────────────────
  let touchPan = null;
  let lastDist  = null;

  scroller.addEventListener('touchstart', e => {
    e.preventDefault();
    moved = false;
    if (e.touches.length === 1) {
      touchPan = { x: e.touches[0].clientX, y: e.touches[0].clientY,
                   sl: scroller.scrollLeft, st: scroller.scrollTop };
      lastDist = null;
    } else if (e.touches.length === 2) {
      lastDist = touchDist(e.touches);
      touchPan = null;
    }
  }, { passive: false });

  scroller.addEventListener('touchmove', e => {
    e.preventDefault();
    if (e.touches.length === 2 && lastDist) {
      const d  = touchDist(e.touches);
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const ratio = Math.max(0.85, Math.min(1.18, d / lastDist));
      applyScale(state.treeScale * ratio, cx, cy);
      lastDist = d;
      moved = true;
    } else if (e.touches.length === 1 && touchPan) {
      const dx = e.touches[0].clientX - touchPan.x;
      const dy = e.touches[0].clientY - touchPan.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
      scroller.scrollLeft = touchPan.sl - dx;
      scroller.scrollTop  = touchPan.st - dy;
      state.treeScrollLeft = scroller.scrollLeft;
      state.treeScrollTop  = scroller.scrollTop;
    }
  }, { passive: false });

  scroller.addEventListener('touchend', e => {
    const wasMoved = moved;
    if (e.touches.length === 0) { touchPan = null; lastDist = null; }
    else if (e.touches.length === 1) {
      lastDist = null;
      touchPan = { x: e.touches[0].clientX, y: e.touches[0].clientY,
                   sl: scroller.scrollLeft, st: scroller.scrollTop };
    }
    if (!wasMoved && e.changedTouches.length === 1) {
      const t = e.changedTouches[0];
      const el = document.elementFromPoint(t.clientX, t.clientY);
      const card = el?.closest('.card');
      if (card) openPopup(card.dataset.id);
    }
  }, { passive: false });

  // ── Mouse (desktop) ──────────────────────────────────────────
  let mousePan = null;

  function onMouseMove(e) {
    if (!mousePan) return;
    const dx = e.clientX - mousePan.x;
    const dy = e.clientY - mousePan.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
    scroller.scrollLeft = mousePan.sl - dx;
    scroller.scrollTop  = mousePan.st - dy;
    state.treeScrollLeft = scroller.scrollLeft;
    state.treeScrollTop  = scroller.scrollTop;
  }

  function onMouseUp() {
    if (!mousePan) return;
    mousePan = null;
    scroller.style.cursor = 'grab';
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  scroller.addEventListener('mousedown', e => {
    if (e.target.closest('.card')) return;
    moved = false;
    mousePan = { x: e.clientX, y: e.clientY, sl: scroller.scrollLeft, st: scroller.scrollTop };
    scroller.style.cursor = 'grabbing';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });

  // ── Wheel (desktop zoom) ─────────────────────────────────────
  scroller.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = scroller.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    applyScale(state.treeScale * factor, cx, cy);
  }, { passive: false });

  scroller.addEventListener('click', e => {
    if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; }
  }, true);

  scroller.addEventListener('scroll', () => {
    state.treeScrollLeft = scroller.scrollLeft;
    state.treeScrollTop  = scroller.scrollTop;
  });
}

function touchDist(touches) {
  return Math.hypot(
    touches[0].clientX - touches[1].clientX,
    touches[0].clientY - touches[1].clientY
  );
}

function restoreTreeScroll() {
  const scroller = document.getElementById('tree-scroll');

  if (!scroller) return;

  if (state.treeScrollLeft === null) {
    const { w, h } = canvasSize();
    const scaledW = w * state.treeScale;
    const scaledH = h * state.treeScale;
    state.treeScrollLeft = VIRTUAL_PAD + (scaledW - scroller.clientWidth)  / 2;
    state.treeScrollTop  = VIRTUAL_PAD + (scaledH - scroller.clientHeight) / 2;
  }

  scroller.scrollLeft = state.treeScrollLeft;
  scroller.scrollTop = state.treeScrollTop;
}

function keepTreeCenterAfterZoom() {
  const scroller = document.getElementById('tree-scroll');

  if (!scroller) return;

  const centerX = scroller.scrollLeft + scroller.clientWidth / 2;
  const centerY = scroller.scrollTop + scroller.clientHeight / 2;

  const oldScale = state.treeScale || 1;
  const normalizedX = centerX / oldScale;
  const normalizedY = centerY / oldScale;

  requestAnimationFrame(() => {
    const nextScroller = document.getElementById('tree-scroll');

    if (!nextScroller) return;

    state.treeScrollLeft = Math.max(0, normalizedX * state.treeScale - nextScroller.clientWidth / 2);
    state.treeScrollTop = Math.max(0, normalizedY * state.treeScale - nextScroller.clientHeight / 2);
  });
}

// ── Helpers ───────────────────────────────────────────────────────

function applyOverviewScale() {
  const wrap = document.getElementById('ov-wrap');
  const inner = document.getElementById('ov-inner');

  if (!inner || !wrap) return;

  if (state.overviewScale === null) {
    const { w, h } = canvasSize();
    const vpW = wrap.clientWidth || window.innerWidth;
    const vpH = wrap.clientHeight || (window.innerHeight - 120);

    state.overviewScale = Math.min(vpW / w, vpH / h, 0.75);
  }

  inner.style.transform = `scale(${state.overviewScale})`;
  inner.style.transformOrigin = 'top center';
}

function calcFamilyStats() {
  const currentYear = new Date().getFullYear();

  const died = DATA.members.filter(m => m.birthDate && m.deathDate && m.deathDate !== '?');
  const avgLifespan = died.length
    ? Math.round(died.reduce((s, m) => {
        const b = new Date(String(m.birthDate).slice(0, 10));
        const d = new Date(String(m.deathDate).slice(0, 10));
        return s + (d - b) / (1000 * 60 * 60 * 24 * 365.25);
      }, 0) / died.length)
    : null;

  const living = DATA.members.filter(m => m.birthDate && !m.deathDate);
  const avgLivingAge = living.length
    ? Math.round(living.reduce((s, m) => s + (currentYear - parseInt(m.birthDate)), 0) / living.length)
    : null;

  return { avgLifespan, avgLivingAge };
}

function fmtShortDate(s) {
  if (!s || s === '?') return s || '?';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, mo, d] = s.split('-');
    return `${d}.${mo}.${y}`;
  }
  return String(s).slice(0, 4);
}

function fmtDates(m) {
  const b = m.birthDate ? fmtShortDate(m.birthDate) : '?';
  if (!m.deathDate) return `р. ${b}`;
  const d = fmtShortDate(m.deathDate);
  return `р. ${b} — ${d}`;
}

function fmtFullDate(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr);
  if (/^\d{4}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d)) return s;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function calcAge(m) {
  if (!m.birthDate) return null;
  const birth = parseInt(m.birthDate);
  if (isNaN(birth)) return null;
  if (m.deathDate && m.deathDate !== '?') {
    const end = parseInt(m.deathDate);
    return isNaN(end) ? null : end - birth;
  }
  if (!m.deathDate) return new Date().getFullYear() - birth;
  return null;
}

function doy(d) {
  return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
}

function saveRecent(q) {
  if (!q) return;

  const r = JSON.parse(localStorage.getItem('ft-recent') || '[]');
  const updated = [q, ...r.filter(x => x !== q)].slice(0, 5);

  localStorage.setItem('ft-recent', JSON.stringify(updated));
}

init();