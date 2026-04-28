// Layout constants
const CARD_W   = 130;
const CARD_H   = 180;
const COL_W    = 190;
const ROW_H    = 290;
const PAD_L    = 88;   // left padding — space for generation labels
const PAD_T    = 40;
const PAD_B    = 60;
const PHOTO_CY = 45;   // photo circle center Y from card top

let DATA = null;

const state = {
  view: 'tree',          // 'tree' | 'overview' | 'search' | 'profile:{id}'
  popup: null,           // member id
  overlay: null,         // 'birthdays' | 'legend'
  searchQuery: '',
  overviewScale: null,   // computed on first open
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
  state.view   = view;
  state.popup  = null;
  state.overlay = null;
  render();
}

function openPopup(id) {
  state.popup   = id;
  state.overlay = null;
  render();
}

function openOverlay(name) {
  state.overlay = name;
  state.popup   = null;
  render();
}

function closeAll() {
  state.popup   = null;
  state.overlay = null;
  render();
}

// ── Main render ───────────────────────────────────────────────────

function render() {
  const app  = document.getElementById('app');
  const nav  = document.getElementById('nav');
  const root = document.getElementById('overlay-root');

  if      (state.view === 'tree')     app.innerHTML = buildTree();
  else if (state.view === 'overview') app.innerHTML = buildOverview();
  else if (state.view === 'search')   app.innerHTML = buildSearch();
  else if (state.view.startsWith('profile:')) app.innerHTML = buildProfile(state.view.slice(8));

  nav.innerHTML  = buildNav();
  root.innerHTML = state.popup                  ? buildPopup(state.popup)
                 : state.overlay === 'birthdays' ? buildBirthdays()
                 : state.overlay === 'legend'    ? buildLegend()
                 : '';

  bindEvents();

  if (state.view === 'tree' || state.view === 'overview') {
    requestAnimationFrame(drawLines);
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
  return { x, y, cx: x + CARD_W / 2, top: y, bottom: y + CARD_H };
}

function buildCardHtml(m) {
  const { x, y } = cardPos(m);
  const photo = m.photo
    ? `<img src="${m.photo}" alt="${m.name}">`
    : `<div class="photo-placeholder"></div>`;
  return `
    <div class="card" data-id="${m.id}" style="left:${x}px;top:${y}px;width:${CARD_W}px">
      <div class="card-photo">${photo}</div>
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
  return `<div class="tree-scroll" id="tree-scroll">${buildCanvasInner(w, h, maxRow)}</div>`;
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
  const q       = state.searchQuery;
  const recent  = JSON.parse(localStorage.getItem('ft-recent') || '[]');
  const results = q ? DATA.members.filter(m => m.name.toLowerCase().includes(q.toLowerCase())) : [];

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
        <input class="search-input" id="search-input" type="search" placeholder="Поиск по имени…" value="${q}">
      </div>
      ${recentHtml}
      ${resultsHtml}
    </div>`;
}

function buildProfile(id) {
  const m = DATA.members.find(x => x.id === id);
  if (!m) return '<div style="padding:24px;color:var(--muted)">Не найдено</div>';

  const byId = Object.fromEntries(DATA.members.map(x => [x.id, x]));
  const related = new Set();
  DATA.families.forEach(f => {
    const inParents  = f.parents.includes(id);
    const inChildren = f.children.includes(id);
    if (inParents)  f.children.forEach(c => related.add(c));
    if (inChildren) { f.parents.forEach(p => related.add(p)); f.children.forEach(s => related.add(s)); }
  });
  related.delete(id);
  const relMembers = [...related].map(rid => byId[rid]).filter(Boolean);

  const photo = m.photo ? `<img src="${m.photo}" alt="${m.name}">` : '<div class="photo-placeholder" style="width:100%;height:100%"></div>';

  const timelineHtml = m.timeline && m.timeline.length
    ? m.timeline.map(t => `
        <div class="timeline-entry">
          <div class="timeline-dot-col"><div class="timeline-dot"></div></div>
          <div><div class="timeline-year">${t.year}</div><div class="timeline-text">${t.text}</div></div>
        </div>`).join('')
    : '<p class="timeline-placeholder">Хронология будет добавлена позже</p>';

  const relativesHtml = relMembers.length ? `
    <div class="profile-section">
      <div class="profile-section-title">Родственники</div>
      <div class="relatives-grid">
        ${relMembers.map(r => `
          <button class="relative-card" data-id="${r.id}">
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
  const photo    = m.photo ? `<img src="${m.photo}" alt="${m.name}">` : '<div class="photo-placeholder" style="width:100%;height:100%"></div>';
  const bioShort = m.bio ? (m.bio.match(/[^.!?]+[.!?]+/g) || [m.bio]).slice(0, 2).join(' ') : '';
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
  const now    = new Date();
  const todoDoy = doy(now);
  const MONTHS  = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

  const items = DATA.members
    .filter(m => m.birthDate)
    .map(m => {
      const d    = new Date(m.birthDate);
      const bd   = new Date(now.getFullYear(), d.getMonth(), d.getDate());
      const diff = (doy(bd) - todoDoy + 366) % 366;
      return { m, diff, month: d.getMonth(), day: d.getDate() };
    })
    .sort((a, b) => a.diff - b.diff)
    .map(({ m, diff, month, day }) => `
      <div class="birthday-item ${diff <= 30 ? 'soon' : ''}">
        <span class="birthday-date">${day} ${MONTHS[month]}</span>
        <span class="birthday-name">${m.name}</span>
      </div>`).join('');

  return `
    <div class="backdrop" id="backdrop"></div>
    <div class="bottom-sheet">
      <div class="sheet-handle"></div>
      <h3 style="font-size:17px;font-weight:700;margin-bottom:16px">Дни рождения</h3>
      <div class="birthday-list">${items}</div>
    </div>`;
}

function buildLegend() {
  return `
    <div class="backdrop" id="backdrop"></div>
    <div class="bottom-sheet">
      <div class="sheet-handle"></div>
      <h3 style="font-size:17px;font-weight:700;margin-bottom:18px">Связи</h3>
      <div class="legend-items">
        <div class="legend-item"><div class="legend-line solid"></div><span class="legend-label">Родитель / Ребёнок</span></div>
        <div class="legend-item"><div class="legend-line dashed"></div><span class="legend-label">Бывший супруг(а)</span></div>
        <div class="legend-item"><div class="legend-line dotted"></div><span class="legend-label">Отчим / Мачеха</span></div>
        <div class="legend-item"><div class="legend-line teal"></div><span class="legend-label">Усыновление</span></div>
      </div>
      <button class="btn-outline" id="backdrop">Закрыть</button>
    </div>`;
}

// ── SVG lines ─────────────────────────────────────────────────────

function drawLines() {
  const svg = document.getElementById('lines-svg');
  if (!svg) return;

  const byId = Object.fromEntries(DATA.members.map(m => [m.id, m]));
  let out = '';

  DATA.families.forEach(fam => {
    const parents  = fam.parents.map(id => byId[id]).filter(Boolean);
    const children = fam.children.map(id => byId[id]).filter(Boolean);
    if (!parents.length || !children.length) return;

    let dropX, dropY;

    if (parents.length >= 2) {
      const p1 = cardPos(parents[0]);
      const p2 = cardPos(parents[1]);
      const lx  = Math.min(p1.cx, p2.cx);
      const rx  = Math.max(p1.cx, p2.cx);
      const ly  = ((p1.top + p2.top) / 2) + PHOTO_CY;

      const dash = fam.coupleType === 'divorced' ? 'stroke-dasharray="8 5"' : '';
      out += `<line x1="${lx}" y1="${ly}" x2="${rx}" y2="${ly}" stroke="var(--line)" stroke-width="2.5" stroke-linecap="round" ${dash}/>`;

      if (fam.coupleType === 'spouse') {
        const hx = (lx + rx) / 2;
        out += `<text x="${hx}" y="${ly + 5}" text-anchor="middle" fill="var(--accent)" font-size="12">♡</text>`;
      }

      dropX = (lx + rx) / 2;
      dropY = ly;
    } else {
      const p = cardPos(parents[0]);
      dropX = p.cx;
      dropY = p.bottom;
    }

    // vertical stem before branching
    if (children.length) {
      const firstChild = cardPos(children[0]);
      const stemEndY = dropY + (firstChild.top - dropY) * 0.45;
      out += `<line x1="${dropX}" y1="${dropY}" x2="${dropX}" y2="${stemEndY}" stroke="var(--line)" stroke-width="1.8" stroke-linecap="round"/>`;

      children.forEach(child => {
        const c   = cardPos(child);
        const midY = dropY + (c.top - dropY) * 0.5;
        out += `<path d="M${dropX},${stemEndY} C${dropX},${midY} ${c.cx},${midY} ${c.cx},${c.top}" fill="none" stroke="var(--line)" stroke-width="1.8" stroke-linecap="round"/>`;
      });
    }
  });

  svg.innerHTML = out;
}

// ── Events ────────────────────────────────────────────────────────

function bindEvents() {
  // Cards
  document.querySelectorAll('.card').forEach(el =>
    el.addEventListener('click', () => openPopup(el.dataset.id))
  );

  // Nav
  document.getElementById('nav-search')?.addEventListener('click', () => navigate('search'));
  document.getElementById('nav-home')?.addEventListener('click',   () => navigate('overview'));
  document.getElementById('nav-bday')?.addEventListener('click',   () => openOverlay('birthdays'));
  document.getElementById('nav-legend')?.addEventListener('click', () => openOverlay('legend'));

  // Backdrop / close
  document.getElementById('backdrop')?.addEventListener('click', closeAll);

  // Popup → profile
  document.getElementById('popup-profile-btn')?.addEventListener('click', e => {
    const id = e.currentTarget.dataset.id;
    state.popup = null;
    navigate('profile:' + id);
  });

  // Profile back
  document.getElementById('back-btn')?.addEventListener('click', () => navigate('tree'));

  // Relative cards in profile
  document.querySelectorAll('.relative-card').forEach(el =>
    el.addEventListener('click', () => navigate('profile:' + el.dataset.id))
  );

  // Search input
  const searchEl = document.getElementById('search-input');
  if (searchEl) {
    searchEl.focus();
    searchEl.addEventListener('input', e => {
      state.searchQuery = e.target.value;
      render();
    });
  }

  // Search results
  document.querySelectorAll('.result-item').forEach(el =>
    el.addEventListener('click', () => {
      saveRecent(state.searchQuery);
      openPopup(el.dataset.id);
    })
  );

  // Recent tags
  document.querySelectorAll('.recent-tag').forEach(el =>
    el.addEventListener('click', () => {
      state.searchQuery = el.dataset.recent;
      render();
    })
  );

  // Zoom
  document.getElementById('zoom-in')?.addEventListener('click', () => {
    state.overviewScale = Math.min((state.overviewScale || 0.4) + 0.08, 1.4);
    applyOverviewScale();
  });
  document.getElementById('zoom-out')?.addEventListener('click', () => {
    state.overviewScale = Math.max((state.overviewScale || 0.4) - 0.08, 0.12);
    applyOverviewScale();
  });
}

// ── Helpers ───────────────────────────────────────────────────────

function applyOverviewScale() {
  const wrap  = document.getElementById('ov-wrap');
  const inner = document.getElementById('ov-inner');
  if (!inner || !wrap) return;

  if (state.overviewScale === null) {
    const { w, h }  = canvasSize();
    const vpW       = wrap.clientWidth  || window.innerWidth;
    const vpH       = wrap.clientHeight || (window.innerHeight - 120);
    state.overviewScale = Math.min(vpW / w, vpH / h, 0.75);
  }

  inner.style.transform       = `scale(${state.overviewScale})`;
  inner.style.transformOrigin = 'top center';
}

function fmtDates(m) {
  const b = m.birthDate ? m.birthDate.slice(0, 4) : '?';
  return m.deathDate ? `${b} — ${m.deathDate.slice(0, 4)}` : `род. ${b}`;
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
