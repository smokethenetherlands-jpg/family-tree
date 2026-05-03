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

function handleBackButton() {
  if (state.overlay) {
    state.overlay = null;
    render();
  } else if (state.popup) {
    state.popup = null;
    render();
  } else if (state.view !== 'tree') {
    state.view = 'tree';
    state.popup = null;
    render();
  }
  if (state.overlay || state.popup || state.view !== 'tree') {
    history.pushState({ isNav: true }, '');
  }
}

function initParticles(canvas) {
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const COUNT = 60;
  const particles = Array.from({ length: COUNT }, () => ({
    x:     Math.random() * window.innerWidth,
    y:     Math.random() * window.innerHeight,
    r:     Math.random() * 1.4 + 0.4,
    vx:    (Math.random() - 0.5) * 0.18,
    vy:    -(Math.random() * 0.28 + 0.08),
    alpha: Math.random() * 0.32 + 0.12,
    phase: Math.random() * Math.PI * 2,
    speed: Math.random() * 0.0004 + 0.0002,
  }));

  function frame(t) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const dark = document.documentElement.classList.contains('dark');

    particles.forEach(p => {
      p.x += p.vx + Math.sin(t * p.speed + p.phase) * 0.22;
      p.y += p.vy;

      if (p.y < -4)               { p.y = canvas.height + 4; p.x = Math.random() * canvas.width; }
      if (p.x < -4)               p.x = canvas.width + 4;
      if (p.x > canvas.width + 4) p.x = -4;

      const pulse = 0.7 + 0.3 * Math.sin(t * p.speed * 3 + p.phase);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = dark
        ? `rgba(136,152,232,${p.alpha * pulse})`
        : `rgba(168,90,79,${p.alpha * pulse})`;
      ctx.fill();
    });

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  render();
}

async function init() {
  history.replaceState({ isBase: true }, '');
  window.addEventListener('popstate', handleBackButton);

  if (localStorage.getItem('theme') !== 'light') {
    document.documentElement.classList.add('dark');
  }

  if (!document.getElementById('bg-anim')) {
    const canvas = document.createElement('canvas');
    canvas.id = 'bg-anim';
    document.body.insertBefore(canvas, document.getElementById('app'));
    initParticles(canvas);
  }

  try {
    const res = await fetch('data.json?v=' + Date.now());
    DATA = await res.json();
  } catch (e) {
    document.getElementById('app').textContent = 'Ошибка загрузки data.json';
    return;
  }

  if (!localStorage.getItem('onboarded')) {
    state.overlay = 'onboarding';
    history.pushState({ isNav: true }, '');
  }

  render();
}

// ── State helpers ─────────────────────────────────────────────────

function navigate(view) {
  state.view = view;
  state.popup = null;
  state.overlay = null;
  if (view !== 'tree') history.pushState({ isNav: true }, '');
  render();
}

function openPopup(id) {
  state.popup = id;
  state.overlay = null;
  history.pushState({ isNav: true }, '');
  render();
}

function openPopupDirect(id) {
  state.popup = id;
  state.overlay = null;
  history.pushState({ isNav: true }, '');
  const root = document.getElementById('overlay-root');
  const nav  = document.getElementById('nav');
  if (!root) { render(); return; }
  root.innerHTML = buildPopup(id);
  nav.innerHTML  = buildNav();
  document.getElementById('backdrop')?.addEventListener('click', closeAll);
  document.getElementById('popup-profile-btn')?.addEventListener('click', e => {
    state.popup = null;
    navigate('profile:' + e.currentTarget.dataset.id);
  });
}

function openOverlay(name) {
  state.overlay = name;
  state.popup = null;
  history.pushState({ isNav: true }, '');
  render();
}

function closeAll() {
  state.popup = null;
  state.overlay = null;
  render();
}

function zoomToCard(id, callback) {
  const m = DATA.members.find(x => x.id === id);
  const scroller = document.getElementById('tree-scroll');
  if (!m || !scroller) { callback?.(); return; }

  const vpW      = scroller.clientWidth  || window.innerWidth;
  const vpH      = scroller.clientHeight || (window.innerHeight - 88);
  const fromScale = state.treeScale;
  const toScale   = Math.max(state.treeScale, 0.8);
  const { w, h }  = canvasSize();
  const cardCX    = PAD_L + m.col * COL_W + CARD_W / 2;
  const cardCY    = PAD_T + m.row * ROW_H + CARD_H / 2;
  const fromLeft  = scroller.scrollLeft;
  const fromTop   = scroller.scrollTop;
  const toLeft    = Math.max(0, VIRTUAL_PAD + cardCX * toScale - vpW / 2);
  const toTop     = Math.max(0, VIRTUAL_PAD + cardCY * toScale - vpH / 2);
  const fromSW    = w * fromScale + VIRTUAL_PAD * 2;
  const fromSH    = h * fromScale + VIRTUAL_PAD * 2;
  const toSW      = w * toScale   + VIRTUAL_PAD * 2;
  const toSH      = h * toScale   + VIRTUAL_PAD * 2;

  state.treeScale      = toScale;
  state.treeScrollLeft = toLeft;
  state.treeScrollTop  = toTop;

  const inner  = document.getElementById('tree-scale-inner');
  const spacer = document.querySelector('.tree-scale-spacer');

  // Scale + spacer + scroll all in one rAF loop — perfectly in sync
  const DURATION = 400;
  const start    = performance.now();
  function frame(now) {
    const t = Math.min((now - start) / DURATION, 1);
    const e = t < 0.5 ? 2*t*t : -1 + (4-2*t)*t;
    const sc = fromScale + (toScale - fromScale) * e;
    if (inner)  inner.style.transform = `scale(${sc})`;
    if (spacer) {
      spacer.style.width  = (fromSW + (toSW - fromSW) * e) + 'px';
      spacer.style.height = (fromSH + (toSH - fromSH) * e) + 'px';
    }
    scroller.scrollLeft = fromLeft + (toLeft - fromLeft) * e;
    scroller.scrollTop  = fromTop  + (toTop  - fromTop)  * e;
    if (t < 1) requestAnimationFrame(frame);
    else callback?.();
  }
  requestAnimationFrame(frame);
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
    : state.overlay === 'birthdays' ? buildBirthdaySheet('birthdays')
    : state.overlay === 'memorial'  ? buildBirthdaySheet('memorial')
    : state.overlay === 'legend'    ? buildLegend()
    : state.overlay === 'onboarding' ? buildOnboarding()
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

const AVATAR_SVG = '<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%" overflow="hidden"><circle cx="20" cy="14" r="8" fill="rgba(255,255,255,0.55)"/><path d="M0 40 C0 24 40 24 40 40 Z" fill="rgba(255,255,255,0.55)"/></svg>';

function buildCardHtml(m) {
  const { x, y } = cardPos(m);

  const isDeceased = !!m.deathDate;
  const isDashed   = /отчим|мачеха/i.test(m.role || '');
  const photoClass = isDashed ? 'card-photo card-photo--dashed' : 'card-photo';
  const cardClass  = isDeceased ? 'card card--deceased' : 'card';

  const photo = m.photo
    ? `<img src="${m.photo}" alt="${m.name}">`
    : `<div class="photo-placeholder">${AVATAR_SVG}</div>`;

  return `
    <div class="${cardClass}" data-id="${m.id}" style="left:${x}px;top:${y}px;width:${CARD_W}px">
      <div class="${photoClass}">${photo}</div>
      <div class="card-name">${m.name}</div>
      <div class="card-dates">${fmtDates(m).replace('р. ', '')}</div>
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
  const people = DATA.members.length;
  const gens   = maxRow + 1;

  return `
    <div class="tree-view-wrap">
      <div class="tree-hud-left">Семейное дерево</div>
      <div class="tree-hud-right">${people} чел. · ${gens} пок.</div>
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
            <div class="result-photo">${m.photo ? `<img src="${m.photo}">` : `<div class="photo-placeholder" style="width:100%;height:100%">${AVATAR_SVG}</div>`}</div>
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
        <button class="search-close-btn" id="search-close-btn" aria-label="Закрыть">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
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
    const parts = mem.name.trim().split(/\s+/);
    const patronymic = parts[2] ?? '';
    if (/овна$|евна$|ична$|инична$/.test(patronymic)) return 'f';
    if (/ович$|евич$/.test(patronymic)) return 'm';
    const last = parts[0] ?? '';
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

  const photo = m.photo ? `<img src="${m.photo}" alt="${m.name}">` : `<div class="photo-placeholder" style="width:100%;height:100%">${AVATAR_SVG}</div>`;

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
            <div class="relative-photo">${r.photo ? `<img src="${r.photo}">` : `<div class="photo-placeholder" style="width:100%;height:100%">${AVATAR_SVG}</div>`}</div>
            <div class="relative-name">${r.name.split(' ').slice(0, 2).join(' ')}</div>
          </button>`).join('')}
      </div>
    </div>` : '';

  const infoRows = [];
  if (m.birthDate) infoRows.push(['Дата рождения', fmtFullDate(m.birthDate)]);
  if (m.deathDate)  infoRows.push(['Дата смерти',   fmtFullDate(m.deathDate)]);
  if (m.maiden)     infoRows.push(['Девичья фамилия', m.maiden]);
  const weddingFamily = DATA.families.find(f => f.weddingDate && f.parents.includes(id) && (f.coupleType === 'spouse' || f.coupleType === 'divorced'));
  if (weddingFamily) infoRows.push(['Дата свадьбы', fmtFullDate(weddingFamily.weddingDate)]);
  if (weddingFamily?.divorceDate) infoRows.push(['Дата развода', fmtFullDate(weddingFamily.divorceDate)]);
  const age = calcAge(m);
  if (age !== null) infoRows.push([m.deathDate ? 'Прожил(а)' : 'Возраст', `${age} лет`]);
  const infoHtml = infoRows.length ? `
    <div class="profile-info">
      ${infoRows.map(([label, val]) => `
        <div class="info-row">
          <span class="info-label">${label}</span>
          <span class="info-val">${val}</span>
        </div>`).join('')}
    </div>` : '';

  const { avgLifespan, avgLivingAge } = calcFamilyStats();
  const statItems = [];
  if (avgLifespan !== null) statItems.push(`<div class="stat-item"><div class="stat-value">${avgLifespan} лет</div><div class="stat-label">Ср. продолжительность жизни</div></div>`);
  if (avgLivingAge !== null) statItems.push(`<div class="stat-item"><div class="stat-value">${avgLivingAge} лет</div><div class="stat-label">Ср. возраст живых</div></div>`);
  const statsHtml = statItems.length ? `<div class="profile-stats">${statItems.join('')}</div>` : '';

  return `
    <div class="profile-view">
      <div class="profile-cover">
        ${m.photo ? `<div class="profile-cover-bg" style="background-image:url('${m.photo}')"></div>` : ''}
        <div class="profile-cover-overlay"></div>
        <button class="back-btn" id="back-btn">←</button>
        <div class="profile-cover-photo">${photo}</div>
      </div>
      <div class="profile-body">
        <div class="profile-name">${m.name}</div>
        <div class="profile-dates">${fmtDates(m)}</div>
        ${m.role ? `<span class="profile-role-badge">${m.role.toUpperCase()}</span>` : ''}
        ${m.memorialUrl ? `
        <a class="memorial-btn" href="${m.memorialUrl}" target="_blank" rel="noopener noreferrer">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0"><path d="M12 2C9 5.5 7 8.5 7 11.5a5 5 0 0 0 10 0C17 8.5 15 5.5 12 2zm0 13.5a2.5 2.5 0 0 1-2.5-2.5c0-1.5.9-3.1 2.5-5.2 1.6 2.1 2.5 3.7 2.5 5.2a2.5 2.5 0 0 1-2.5 2.5z"/></svg>
          Страница памяти
        </a>` : ''}
        <button class="find-in-tree-btn" id="goto-tree-btn" data-id="${m.id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>
          Место в дереве
        </button>
        <div class="profile-tabs">
          <button class="profile-tab active" data-tab="bio">О человеке</button>
          <button class="profile-tab" data-tab="timeline">Хронология</button>
          ${relSorted.length ? '<button class="profile-tab" data-tab="relatives">Родственники</button>' : ''}
        </div>
        <div data-section="bio">
          ${infoHtml}
          ${statsHtml}
          <div class="profile-section">
            <div class="profile-section-title">Биография</div>
            <div class="profile-bio">${m.bio || 'Биография не добавлена.'}</div>
          </div>
        </div>
        <div data-section="timeline" style="display:none">
          <div class="profile-section">
            <div class="profile-section-title">Хронология</div>
            ${timelineHtml}
          </div>
        </div>
        ${relSorted.length ? `<div data-section="relatives" style="display:none">${relativesHtml}</div>` : ''}
        <div class="contribute-block">
          <div class="contribute-title">Помогите сохранить историю</div>
          <ul class="contribute-list">
            <li>Написать биографию</li>
            <li>Дополнить или исправить данные</li>
            <li>Передать фото или документ</li>
          </ul>
          <a class="contribute-btn" href="https://forms.yandex.ru/u/69f2201184227c5fbae998b9" target="_blank" rel="noopener noreferrer">Заполнить форму →</a>
        </div>
      </div>
    </div>`;
}

function buildNav() {
  const v = state.view;
  const isDark = document.documentElement.classList.contains('dark');

  const themeIcon = isDark
    ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`
    : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

  return `
    <button class="nav-btn ${v === 'search' ? 'active' : ''}" id="nav-search">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
    </button>
    <button class="nav-btn ${v === 'overview' ? 'active' : ''}" id="nav-home">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256"><path d="M200,152a31.84,31.84,0,0,0-19.53,6.68l-23.11-18A31.65,31.65,0,0,0,160,128c0-.74,0-1.48-.08-2.21l13.23-4.41A32,32,0,1,0,168,104c0,.74,0,1.48.08,2.21l-13.23,4.41A32,32,0,0,0,128,96a32.59,32.59,0,0,0-5.27.44L115.89,81A32,32,0,1,0,96,88a32.59,32.59,0,0,0,5.27-.44l6.84,15.4a31.92,31.92,0,0,0-8.57,39.64L73.83,165.44a32.06,32.06,0,1,0,10.63,12l25.71-22.84a31.91,31.91,0,0,0,37.36-1.24l23.11,18A31.65,31.65,0,0,0,168,184a32,32,0,1,0,32-32Zm0-64a16,16,0,1,1-16,16A16,16,0,0,1,200,88ZM80,56A16,16,0,1,1,96,72,16,16,0,0,1,80,56ZM56,208a16,16,0,1,1,16-16A16,16,0,0,1,56,208Zm56-80a16,16,0,1,1,16,16A16,16,0,0,1,112,128Zm88,72a16,16,0,1,1,16-16A16,16,0,0,1,200,200Z"/></svg>
    </button>
    <button class="nav-btn" id="nav-bday">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256"><path d="M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Zm-96-88v64a8,8,0,0,1-16,0V132.94l-4.42,2.22a8,8,0,0,1-7.16-14.32l16-8A8,8,0,0,1,112,120Zm59.16,30.45L152,176h16a8,8,0,0,1,0,16H136a8,8,0,0,1-6.4-12.8l28.78-38.37A8,8,0,1,0,145.07,132a8,8,0,1,1-13.85-8A24,24,0,0,1,176,136,23.76,23.76,0,0,1,171.16,150.45Z"/></svg>
    </button>
    <button class="nav-btn" id="nav-legend">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256"><path d="M140,180a12,12,0,1,1-12-12A12,12,0,0,1,140,180ZM128,72c-22.06,0-40,16.15-40,36v4a8,8,0,0,0,16,0v-4c0-11,10.77-20,24-20s24,9,24,20-10.77,20-24,20a8,8,0,0,0-8,8v8a8,8,0,0,0,16,0v-.72c18.24-3.35,32-17.9,32-35.28C168,88.15,150.06,72,128,72Zm104,56A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z"/></svg>
    </button>
    <button class="nav-btn" id="nav-theme">
      ${themeIcon}
    </button>`;
}

function buildPopup(id) {
  const m = DATA.members.find(x => x.id === id);

  if (!m) return '';

  const photo = m.photo
    ? `<img src="${m.photo}" alt="${m.name}">`
    : `<div class="photo-placeholder" style="width:100%;height:100%">${AVATAR_SVG}</div>`;

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
          ${m.maiden ? `<div class="popup-maiden">урожд. ${m.maiden}</div>` : ''}
          <div class="popup-dates">${fmtDates(m)}</div>
          ${m.role ? `<div class="popup-role">${m.role.toUpperCase()}</div>` : ''}
        </div>
      </div>
      ${bioShort ? `<p class="popup-bio">${bioShort}</p>` : ''}
      <button class="btn-primary" id="popup-profile-btn" data-id="${m.id}">Полный профиль →</button>
    </div>`;
}

function buildBirthdaySheet(tab) {
  const now = new Date();
  const todayDoy = doy(now);
  const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

  let items = '';

  if (tab === 'birthdays') {
    items = DATA.members
      .filter(m => m.birthDate && !m.deathDate && /^\d{4}-\d{2}-\d{2}$/.test(m.birthDate))
      .map(m => {
        const d = new Date(m.birthDate);
        const bd = new Date(now.getFullYear(), d.getMonth(), d.getDate());
        const diff = (doy(bd) - todayDoy + 366) % 366;
        return { m, diff, month: d.getMonth(), day: d.getDate() };
      })
      .sort((a, b) => a.diff - b.diff)
      .map(({ m, diff, month, day }) => {
        const pillClass = diff === 0 ? 'today' : diff <= 7 ? 'week' : diff <= 30 ? 'month' : 'far';
        const pillText  = diff === 0 ? 'сегодня' : diff === 1 ? 'завтра' : `через ${diff} дн.`;
        return `
        <div class="birthday-item birthday-item--${pillClass}" data-id="${m.id}">
          <div class="birthday-info">
            <span class="birthday-name">${m.name}</span>
            <span class="birthday-date">${day} ${MONTHS[month]}</span>
          </div>
          <span class="birthday-pill birthday-pill--${pillClass}">${pillText}</span>
        </div>`;
      }).join('');
  } else {
    const withDate = DATA.members
      .filter(m => m.deathDate && /^\d{4}-\d{2}-\d{2}$/.test(m.deathDate))
      .map(m => {
        const d = new Date(m.deathDate);
        const ann = new Date(now.getFullYear(), d.getMonth(), d.getDate());
        const diff = (doy(ann) - todayDoy + 366) % 366;
        return { m, diff, month: d.getMonth(), day: d.getDate() };
      })
      .sort((a, b) => a.diff - b.diff)
      .map(({ m, diff, month, day }) => {
        const pillClass = diff === 0 ? 'today' : diff <= 7 ? 'week' : diff <= 30 ? 'month' : 'far';
        const pillText  = diff === 0 ? 'сегодня' : diff === 1 ? 'завтра' : `через ${diff} дн.`;
        return `
        <div class="birthday-item birthday-item--${pillClass}" data-id="${m.id}">
          <div class="birthday-info">
            <span class="birthday-name">${m.name}</span>
            <span class="birthday-date">${day} ${MONTHS[month]}</span>
          </div>
          <span class="birthday-pill birthday-pill--${pillClass}">${pillText}</span>
        </div>`;
      }).join('');

    const noDate = DATA.members
      .filter(m => m.deathDate && !/^\d{4}-\d{2}-\d{2}$/.test(m.deathDate))
      .map(m => `
        <div class="birthday-item birthday-item--far" data-id="${m.id}">
          <div class="birthday-info">
            <span class="birthday-name">${m.name}</span>
            <span class="birthday-date">${m.deathDate && m.deathDate !== '?' ? m.deathDate + ' г.' : 'дата неизвестна'}</span>
          </div>
        </div>`).join('');

    const sep = withDate && noDate
      ? `<p style="font-size:12px;color:var(--muted);margin:14px 0 6px">Точная дата неизвестна</p>`
      : '';
    items = withDate + sep + noDate;
  }

  const tabs = `
    <div class="sheet-tabs">
      <button class="sheet-tab ${tab === 'birthdays' ? 'active' : ''}" id="tab-bday">Дни рождения</button>
      <button class="sheet-tab ${tab === 'memorial' ? 'active' : ''}" id="tab-memorial">Поминовение</button>
    </div>`;

  return `
    <div class="backdrop" id="backdrop"></div>
    <div class="bottom-sheet">
      <div class="sheet-handle"></div>
      <div class="sheet-header">
        ${tabs}
        <button class="sheet-close-btn" id="sheet-close-btn" aria-label="Закрыть">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="birthday-list">${items || '<p class="no-results">Нет данных</p>'}</div>
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

function buildOnboarding() {
  const tips = [
    {
      icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11V6a2 2 0 1 1 4 0v5"/><path d="M13 11V9a2 2 0 1 1 4 0v3"/><path d="M17 12a2 2 0 1 1 4 0v3a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6v-1a2 2 0 1 1 4 0"/></svg>`,
      text: 'Нажмите на карточку — откроется информация о человеке'
    },
    {
      icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3"/></svg>`,
      text: 'Листайте пальцем, чтобы перемещаться по дереву. Два пальца — масштаб'
    },
    {
      icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`,
      text: 'Кнопка поиска внизу — найти человека по имени'
    },
    {
      icon: `<svg width="22" height="22" viewBox="0 0 256 256" fill="currentColor"><path d="M200,152a31.84,31.84,0,0,0-19.53,6.68l-23.11-18A31.65,31.65,0,0,0,160,128c0-.74,0-1.48-.08-2.21l13.23-4.41A32,32,0,1,0,168,104c0,.74,0,1.48.08,2.21l-13.23,4.41A32,32,0,0,0,128,96a32.59,32.59,0,0,0-5.27.44L115.89,81A32,32,0,1,0,96,88a32.59,32.59,0,0,0,5.27-.44l6.84,15.4a31.92,31.92,0,0,0-8.57,39.64L73.83,165.44a32.06,32.06,0,1,0,10.63,12l25.71-22.84a31.91,31.91,0,0,0,37.36-1.24l23.11,18A31.65,31.65,0,0,0,168,184a32,32,0,1,0,32-32Z"/></svg>`,
      text: 'Кнопка «Обзор» внизу — показывает всё дерево целиком, удобно для общей картины'
    },
    {
      icon: `<svg width="22" height="22" viewBox="0 0 256 256" fill="currentColor"><path d="M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Zm-96-88v64a8,8,0,0,1-16,0V132.94l-4.42,2.22a8,8,0,0,1-7.16-14.32l16-8A8,8,0,0,1,112,120Zm59.16,30.45L152,176h16a8,8,0,0,1,0,16H136a8,8,0,0,1-6.4-12.8l28.78-38.37A8,8,0,1,0,145.07,132a8,8,0,1,1-13.85-8A24,24,0,0,1,176,136,23.76,23.76,0,0,1,171.16,150.45Z"/></svg>`,
      text: 'Кнопка «Дни рождения» внизу — список всех дат рождения с ближайшими сверху'
    },
  ];

  const rows = tips.map(t => `
    <div class="onboarding-tip">
      <div class="onboarding-tip-icon">${t.icon}</div>
      <span class="onboarding-tip-text">${t.text}</span>
    </div>`).join('');

  return `
    <div class="backdrop" id="backdrop"></div>
    <div class="bottom-sheet">
      <div class="sheet-handle"></div>
      <h3 style="font-size:17px;font-weight:700;margin-bottom:4px">Как пользоваться</h3>
      <p style="font-size:13px;color:var(--muted);margin-bottom:18px">Несколько подсказок для навигации</p>
      <div class="onboarding-tips">${rows}</div>
      <div class="onboarding-cta">
        <div class="onboarding-cta-text">Помогите сохранить историю семьи — расскажите о себе и близких</div>
        <a class="onboarding-cta-btn" href="https://forms.yandex.ru/u/69f2201184227c5fbae998b9" target="_blank" rel="noopener noreferrer">Заполнить карточку →</a>
      </div>
      <button class="btn-primary" id="close-onboarding-btn" style="margin-top:14px">Понятно!</button>
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

      out += `<line x1="${lx}" y1="${ly}" x2="${rx}" y2="${ly}" stroke="rgba(168,90,79,0.38)" stroke-width="2" stroke-linecap="round" ${dash}/>`;

      if (fam.coupleType === 'spouse') {
        const hx = (lx + rx) / 2;
        out += `<text x="${hx}" y="${ly + 6}" text-anchor="middle" fill="var(--accent)" font-size="16">♡</text>`;
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

    out += `<line x1="${dropX}" y1="${dropY}" x2="${dropX}" y2="${stemEndY}" stroke="rgba(168,90,79,0.25)" stroke-width="1.6" stroke-linecap="round"/>`;

    children.forEach(child => {
      const c = cardPos(child);
      const cp1Y = stemEndY + (c.top - stemEndY) * 0.45;
      const cp2Y = c.top - (c.top - stemEndY) * 0.3;

      out += `<path d="M${dropX},${stemEndY} C${dropX},${cp1Y} ${c.cx},${cp2Y} ${c.cx},${c.top}" fill="none" stroke="rgba(168,90,79,0.25)" stroke-width="1.6" stroke-linecap="round"/>`;
    });
  });

  svg.innerHTML = out;
}

// ── Events ────────────────────────────────────────────────────────

function bindEvents() {
  document.querySelectorAll('.card').forEach(el =>
    el.addEventListener('click', () => zoomToCard(el.dataset.id, () => openPopupDirect(el.dataset.id)))
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
  document.getElementById('tab-bday')?.addEventListener('click', () => openOverlay('birthdays'));
  document.getElementById('tab-memorial')?.addEventListener('click', () => openOverlay('memorial'));
  document.getElementById('nav-legend')?.addEventListener('click', () => openOverlay('legend'));

  document.getElementById('backdrop')?.addEventListener('click', closeAll);
  document.getElementById('close-legend-btn')?.addEventListener('click', closeAll);
  document.getElementById('sheet-close-btn')?.addEventListener('click', closeAll);
  document.getElementById('close-onboarding-btn')?.addEventListener('click', () => {
    localStorage.setItem('onboarded', '1');
    closeAll();
  });
  document.getElementById('search-close-btn')?.addEventListener('click', () => navigate('tree'));

  document.querySelectorAll('.birthday-item[data-id]').forEach(el =>
    el.addEventListener('click', () => openPopup(el.dataset.id))
  );

  document.getElementById('popup-profile-btn')?.addEventListener('click', e => {
    const id = e.currentTarget.dataset.id;
    state.popup = null;
    navigate('profile:' + id);
  });

  document.getElementById('back-btn')?.addEventListener('click', () => navigate('tree'));

  document.getElementById('goto-tree-btn')?.addEventListener('click', e => {
    const id = e.currentTarget.dataset.id;
    navigate('tree');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      zoomToCard(id, () => {
        const card = document.querySelector(`.card[data-id="${id}"]`);
        card?.classList.add('card--highlight');
        setTimeout(() => card?.classList.remove('card--highlight'), 2100);
      });
    }));
  });

  document.querySelectorAll('.relative-card').forEach(el =>
    el.addEventListener('click', () => navigate('profile:' + el.dataset.id))
  );

  const profileTabs = document.querySelectorAll('.profile-tab');
  profileTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      profileTabs.forEach(t => t.classList.toggle('active', t === tab));
      document.querySelectorAll('[data-section]').forEach(s => {
        s.style.display = s.dataset.section === tab.dataset.tab ? '' : 'none';
      });
    });
  });

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

  document.getElementById('nav-theme')?.addEventListener('click', toggleTheme);

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
    // Use JS-tracked scroll position — DOM value may be stale on Android
    const sl = state.treeScrollLeft ?? scroller.scrollLeft;
    const st = state.treeScrollTop  ?? scroller.scrollTop;
    const contentX = (sl - VIRTUAL_PAD + centerX) / prev;
    const contentY = (st - VIRTUAL_PAD + centerY) / prev;
    state.treeScale = Math.max(0.12, Math.min(3, newScale));
    const { w, h } = canvasSize();
    const inner  = document.getElementById('tree-scale-inner');
    const spacer = document.querySelector('.tree-scale-spacer');
    if (inner)  inner.style.transform = `scale(${state.treeScale})`;
    if (spacer) {
      spacer.style.width  = (w * state.treeScale + VIRTUAL_PAD * 2) + 'px';
      spacer.style.height = (h * state.treeScale + VIRTUAL_PAD * 2) + 'px';
    }
    // Save intended value to state first — don't read back from DOM
    state.treeScrollLeft = contentX * state.treeScale + VIRTUAL_PAD - centerX;
    state.treeScrollTop  = contentY * state.treeScale + VIRTUAL_PAD - centerY;
    scroller.scrollLeft  = state.treeScrollLeft;
    scroller.scrollTop   = state.treeScrollTop;
  }

  // ── Touch (mobile) ───────────────────────────────────────────
  let touchPan       = null;
  let lastDist       = null;
  let touchStartCard = null; // card element under finger at touchstart
  let pinchRafId     = null;
  let pendingPinch   = null;

  scroller.addEventListener('touchstart', e => {
    e.preventDefault();
    moved = false;
    if (e.touches.length === 1) {
      touchStartCard = e.target?.closest('.card') ?? null;
      touchPan = { x: e.touches[0].clientX, y: e.touches[0].clientY,
                   sl: scroller.scrollLeft, st: scroller.scrollTop };
      lastDist = null;
    } else if (e.touches.length === 2) {
      touchStartCard = null;
      // Sync state scroll with DOM before pinch starts
      state.treeScrollLeft = scroller.scrollLeft;
      state.treeScrollTop  = scroller.scrollTop;
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
      // Update state immediately so next frame reads correct scale/center
      pendingPinch = { newScale: state.treeScale * (d / lastDist), cx, cy };
      lastDist = d;
      moved = true;
      if (!pinchRafId) {
        pinchRafId = requestAnimationFrame(() => {
          if (pendingPinch) applyScale(pendingPinch.newScale, pendingPinch.cx, pendingPinch.cy);
          pendingPinch = null;
          pinchRafId = null;
        });
      }
    } else if (e.touches.length === 1 && touchPan) {
      const dx = e.touches[0].clientX - touchPan.x;
      const dy = e.touches[0].clientY - touchPan.y;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) moved = true;
      scroller.scrollLeft = touchPan.sl - dx;
      scroller.scrollTop  = touchPan.st - dy;
      state.treeScrollLeft = scroller.scrollLeft;
      state.treeScrollTop  = scroller.scrollTop;
    }
  }, { passive: false });

  scroller.addEventListener('touchend', e => {
    const wasMoved = moved;
    const tapCard  = touchStartCard;
    touchStartCard = null;
    if (e.touches.length === 0) { touchPan = null; lastDist = null; }
    else if (e.touches.length === 1) {
      lastDist = null;
      touchPan = { x: e.touches[0].clientX, y: e.touches[0].clientY,
                   sl: scroller.scrollLeft, st: scroller.scrollTop };
    }
    if (!wasMoved && tapCard) {
      zoomToCard(tapCard.dataset.id, () => openPopupDirect(tapCard.dataset.id));
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