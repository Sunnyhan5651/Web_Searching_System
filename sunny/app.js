/**
 * app.js — 공개 검색 페이지 (index.html) 메인 로직
 * JSON 파일 로드 → 검색 · 필터 · 정렬 → 결과 렌더링
 */

(() => {
  /* ── 상태 ── */
  const state = {
    cases:    [],
    sources:  [],
    synonyms: {},
    query:    '',
    filters:  { category: '', audit_org: '', year: '', disposition: '' },
    sort:     'score',
    tab:      'cases',
    loaded:   { cases: false, sources: false, synonyms: false }
  };

  /* ── DOM 참조 ── */
  const $ = id => document.getElementById(id);
  const searchInput     = $('searchInput');
  const searchForm      = $('searchForm');
  const resetSearch     = $('resetSearch');
  const caseResults     = $('caseResults');
  const sourceResults   = $('sourceResults');
  const caseCount       = $('caseCount');
  const sourceCount     = $('sourceCount');
  const sortCases       = $('sortCases');
  const headerStats     = $('headerStats');
  const fCategory       = $('fCategory');
  const fOrg            = $('fOrg');
  const fYear           = $('fYear');
  const fDisposition    = $('fDisposition');
  const resetCaseFilter = $('resetCaseFilters');

  /* ── 데이터 로드 ── */
  async function loadData() {
    const base = location.pathname.endsWith('/') ? '.' : '.';

    const [casesRes, sourcesRes, synsRes] = await Promise.allSettled([
      fetch(`${base}/data/audit_cases.json`),
      fetch(`${base}/data/sources.json`),
      fetch(`${base}/data/synonyms.json`)
    ]);

    if (casesRes.status === 'fulfilled' && casesRes.value.ok) {
      state.cases = await casesRes.value.json();
      state.loaded.cases = true;
    } else {
      caseResults.innerHTML = errorMsg('감사사례 데이터를 불러오지 못했습니다. (data/audit_cases.json)');
    }

    if (sourcesRes.status === 'fulfilled' && sourcesRes.value.ok) {
      state.sources = await sourcesRes.value.json();
      state.loaded.sources = true;
    }

    if (synsRes.status === 'fulfilled' && synsRes.value.ok) {
      state.synonyms = await synsRes.value.json();
      state.loaded.synonyms = true;
    }

    buildFilters();
    updateHeaderStats();
    render();
  }

  /* ── 필터 옵션 생성 ── */
  function buildFilters() {
    const categories  = [...new Set(state.cases.map(c => c.category).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'ko'));
    const orgs        = [...new Set(state.cases.map(c => c.audit_org).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'ko'));
    const years       = [...new Set(state.cases.map(c => String(c.audit_year)).filter(Boolean))].sort((a,b) => b - a);
    const dispositions= [...new Set(state.cases.map(c => c.disposition).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'ko'));

    fillSelect(fCategory,    categories,   '업무분야 전체');
    fillSelect(fOrg,         orgs,         '감사기관 전체');
    fillSelect(fYear,        years,        '연도 전체');
    fillSelect(fDisposition, dispositions, '처분유형 전체');
  }

  function fillSelect(el, values, placeholder) {
    el.innerHTML = `<option value="">${placeholder}</option>` +
      values.map(v => `<option value="${Search.escHtml(v)}">${Search.escHtml(v)}</option>`).join('');
  }

  /* ── 헤더 통계 ── */
  function updateHeaderStats() {
    headerStats.innerHTML = [
      `<span>감사사례 ${state.cases.length}건</span>`,
      `<span>감사자료원 ${state.sources.length}개</span>`
    ].join('');
  }

  /* ── 전체 렌더 ── */
  function render() {
    if (state.tab === 'cases')   renderCases();
    if (state.tab === 'sources') renderSources();
  }

  /* ── 감사사례 렌더 ── */
  function renderCases() {
    const q    = state.query;
    const syns = state.synonyms;
    const results = Search.searchCases(
      state.cases, q, syns, state.filters, state.sort
    );

    caseCount.textContent = q || hasActiveFilter()
      ? `${results.length}건 검색됨`
      : `전체 ${results.length}건`;

    if (!results.length) {
      caseResults.innerHTML = emptyState(q);
      return;
    }

    const highlightTerms = q
      ? Search.expandTerms(q, syns).map(Search.normalize)
      : [];

    caseResults.innerHTML = results.map(c => caseCard(c, highlightTerms)).join('');
  }

  /* ── 사례 카드 HTML ── */
  function caseCard(c, terms) {
    const title   = Search.highlight(c.title   ?? '', terms);
    const summary = Search.highlight(c.summary ?? '', terms);

    const statusClass = `badge-${c.review_status ?? 'needs_review'}`;
    const statusText  = Search.statusLabel(c.review_status);

    return `
<article class="case-card">
  <div class="case-tags">
    ${c.category    ? `<span class="tag tag-cat">${Search.escHtml(c.category)}</span>`    : ''}
    ${c.audit_org   ? `<span class="tag tag-org">${Search.escHtml(c.audit_org)}</span>`   : ''}
    ${c.audit_year  ? `<span class="tag tag-year">${Search.escHtml(c.audit_year)}년</span>` : ''}
    ${c.disposition ? `<span class="tag tag-disp">${Search.escHtml(c.disposition)}</span>` : ''}
  </div>
  <h3 class="case-title">${title}</h3>
  ${summary ? `<p class="case-summary">${summary}</p>` : ''}
  <div class="case-footer">
    <span class="review-badge ${statusClass}">${statusText}</span>
    ${c.source_url
      ? `<a class="btn-source" href="${Search.escHtml(c.source_url)}" target="_blank" rel="noopener">공식 원문 ↗</a>`
      : '<span style="font-size:.75rem;color:var(--gray-4)">출처 미확인</span>'}
  </div>
</article>`;
  }

  /* ── 자료원 렌더 ── */
  function renderSources() {
    const results = Search.searchSources(state.sources, state.query);
    sourceCount.textContent = state.query
      ? `${results.length}개 검색됨`
      : `전체 ${results.length}개`;

    if (!results.length) {
      sourceResults.innerHTML = emptyState(state.query);
      return;
    }

    sourceResults.innerHTML = results.map(s => `
<div class="source-card">
  <div class="source-info">
    <div class="source-name">${Search.escHtml(s.audit_org ?? '')}</div>
    <div class="source-meta">
      ${s.source_group ? `${Search.escHtml(s.source_group)} · ` : ''}
      ${s.learning_priority ? `연찬 ${Search.escHtml(s.learning_priority)} · ` : ''}
      ${s.collection_readiness === 'ready' ? '수집가능' : s.collection_readiness === 'manual' ? '수동등록' : '확인필요'}
      ${s.recommended_keywords?.length ? ` · 추천: ${s.recommended_keywords.map(Search.escHtml).join(', ')}` : ''}
    </div>
  </div>
  ${s.source_url
    ? `<a class="btn-source-link" href="${Search.escHtml(s.source_url)}" target="_blank" rel="noopener">바로가기 ↗</a>`
    : ''}
</div>`).join('');
  }

  /* ── 빈 결과 ── */
  function emptyState(q) {
    if (!q) return `<div class="empty-state"><h3>데이터가 없습니다</h3><p>data/ 폴더의 JSON 파일을 확인해주세요.</p></div>`;
    return `<div class="empty-state">
      <h3>「${Search.escHtml(q)}」 검색 결과가 없습니다</h3>
      <p>다른 키워드를 입력하거나, 유사한 표현으로 검색해보세요.</p>
    </div>`;
  }

  function errorMsg(msg) {
    return `<div class="empty-state"><h3>오류</h3><p>${Search.escHtml(msg)}</p></div>`;
  }

  function hasActiveFilter() {
    return Object.values(state.filters).some(Boolean);
  }

  /* ── URL 해시 동기화 ── */
  function readHash() {
    const h = new URLSearchParams(location.hash.replace(/^#/, ''));
    const q   = h.get('q') ?? '';
    const tab = h.get('tab') ?? 'cases';
    if (searchInput) searchInput.value = q;
    state.query = q;
    switchTab(tab);
  }

  function writeHash() {
    const p = new URLSearchParams();
    if (state.query) p.set('q', state.query);
    if (state.tab !== 'cases') p.set('tab', state.tab);
    history.replaceState(null, '', '#' + p.toString());
  }

  /* ── 탭 전환 ── */
  function switchTab(name) {
    state.tab = name;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      const active = btn.dataset.tab === name;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active);
    });
    document.querySelectorAll('.tab-content').forEach(sec => {
      sec.classList.toggle('active', sec.id === `tab-${name}`);
    });
    render();
  }

  /* ── 이벤트 ── */
  searchForm?.addEventListener('submit', e => {
    e.preventDefault();
    state.query = Search.normalize(searchInput.value);
    writeHash();
    render();
  });

  resetSearch?.addEventListener('click', () => {
    searchInput.value = '';
    state.query = '';
    document.querySelectorAll('.keyword-tag').forEach(t => t.classList.remove('active'));
    writeHash();
    render();
  });

  document.querySelectorAll('.keyword-tag').forEach(btn => {
    btn.addEventListener('click', () => {
      const kw = btn.dataset.kw;
      searchInput.value = kw;
      state.query = kw;
      document.querySelectorAll('.keyword-tag').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      switchTab('cases');
      writeHash();
      render();
    });
  });

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  sortCases?.addEventListener('change', () => {
    state.sort = sortCases.value;
    renderCases();
  });

  /* 필터 */
  [fCategory, fOrg, fYear, fDisposition].forEach(el => {
    el?.addEventListener('change', () => {
      state.filters = {
        category:    fCategory.value,
        audit_org:   fOrg.value,
        year:        fYear.value,
        disposition: fDisposition.value
      };
      renderCases();
    });
  });

  resetCaseFilter?.addEventListener('click', () => {
    [fCategory, fOrg, fYear, fDisposition].forEach(el => { if(el) el.value = ''; });
    state.filters = { category: '', audit_org: '', year: '', disposition: '' };
    renderCases();
  });

  window.addEventListener('hashchange', readHash);

  /* ── 초기화 ── */
  readHash();
  loadData();
})();
