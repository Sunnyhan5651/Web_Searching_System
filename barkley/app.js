/*
 * 감사사례 연찬 도우미 — 화면 동작
 * 데이터는 data/*.js(=data/*.json 과 같은 내용)에서 읽습니다.
 * 이 파일에는 업로드·다운로드·외부 전송 기능이 없습니다.
 */
(function () {
  'use strict';

  var S = window.AuditSearch;
  var DATA = window.__AUDIT_DATA__ || {};
  var $ = function (id) { return document.getElementById(id); };

  var state = {
    tab: 'cases',
    query: '',
    cases: [], casesLoaded: false, caseMeta: null,
    sources: [], sourcesLoaded: false,
    dict: S.createDictionary(null), synonymsLoaded: false,
    reviewDefs: {}
  };

  var DISPOSITION_ORDER = ['징계', '변상판정', '기관경고', '시정', '주의', '통보', '훈계'];
  var REVIEW_FALLBACK = {
    approved: { label: '검토완료', desc: '감사실 검토자가 원문과 요약을 확인함' },
    source_checked: { label: '출처확인', desc: '출처와 제목은 확인했으나 법령·세부내용은 미확인' },
    needs_review: { label: '검토대기', desc: '추가 검토 필요' },
    rejected: { label: '제외', desc: '공개 금지' }
  };

  /* ---------- 공통 ---------- */
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>'"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c];
    });
  }
  function mark(text, terms) {
    return S.segments(text, terms).map(function (s) {
      return s.mark ? '<mark>' + esc(s.text) + '</mark>' : esc(s.text);
    }).join('');
  }
  function uniq(values) {
    var out = [];
    values.forEach(function (v) { if (v != null && v !== '' && out.indexOf(v) === -1) out.push(v); });
    return out.sort(function (a, b) { return String(a).localeCompare(String(b), 'ko'); });
  }
  function fillSelect(el, options, allLabel) {
    var keep = el.value;
    el.innerHTML = '<option value="">' + esc(allLabel) + '</option>' + options.map(function (o) {
      var v = typeof o === 'object' ? o.value : o, l = typeof o === 'object' ? o.label : o;
      return '<option value="' + esc(v) + '">' + esc(l) + '</option>';
    }).join('');
    el.value = keep;
    if (el.value !== keep) el.value = '';
  }
  function safeUrl(u) { return /^https:\/\//i.test(String(u || '')) ? u : '#'; }
  function reviewLabel(st) { return (state.reviewDefs[st] || REVIEW_FALLBACK[st] || { label: st }).label; }

  /* ---------- 데이터 읽기 (파일별로 독립) ---------- */
  function loadPart(key, jsonPath) {
    if (DATA[key]) return Promise.resolve(DATA[key]);
    if (location.protocol === 'file:') return Promise.reject(new Error('missing'));
    return fetch(jsonPath, { credentials: 'omit', cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function init() {
    bindEvents();
    readHash();
    Promise.all([
      loadPart('cases', 'data/audit_cases.json').then(function (d) {
        state.cases = Array.isArray(d.cases) ? d.cases : [];
        state.caseMeta = d;
        state.reviewDefs = d.review_status_definitions || REVIEW_FALLBACK;
        state.casesLoaded = true;
      }).catch(function () { state.casesLoaded = false; }),
      loadPart('sources', 'data/sources.json').then(function (d) {
        state.sources = Array.isArray(d.sources) ? d.sources : [];
        state.sourceMeta = d;
        state.sourcesLoaded = true;
      }).catch(function () { state.sourcesLoaded = false; }),
      loadPart('synonyms', 'data/synonyms.json').then(function (d) {
        state.dict = S.createDictionary(d);
        state.synonymsLoaded = true;
      }).catch(function () { state.synonymsLoaded = false; })
    ]).then(function () {
      setupFilters();
      renderStats();
      renderGuide();
      showTab(state.tab, true);
    });
  }

  /* ---------- 필터 ---------- */
  function setupFilters() {
    var c = state.cases;
    fillSelect($('categoryFilter'), uniq(c.map(function (x) { return x.category; })), '전체 분야');
    fillSelect($('orgFilter'), uniq(c.map(function (x) { return x.audit_org; })), '전체 기관');
    fillSelect($('yearFilter'), uniq(c.map(function (x) { return String(x.audit_year); })).reverse(), '전체 연도');
    fillSelect($('typeFilter'), uniq(c.map(function (x) { return x.audit_type; })), '전체 유형');
    var disp = [];
    c.forEach(function (x) { (x.disposition_types || []).forEach(function (d) { if (disp.indexOf(d) === -1) disp.push(d); }); });
    disp.sort(function (a, b) {
      var ia = DISPOSITION_ORDER.indexOf(a), ib = DISPOSITION_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b, 'ko');
    });
    fillSelect($('dispositionFilter'), disp, '전체 처분');
    var st = uniq(c.map(function (x) { return x.review_status; })).map(function (v) { return { value: v, label: reviewLabel(v) }; });
    fillSelect($('reviewFilter'), st, '전체 상태');

    var s = state.sources;
    var groups = ['중앙', '광역', '서울자치구', '경기도시군'].filter(function (g) { return s.some(function (x) { return x.source_group === g; }); });
    fillSelect($('groupFilter'), groups, '전체 구분');
    var defs = (state.sourceMeta && state.sourceMeta.readiness_definitions) || {};
    var ready = ['ready', 'manual', 'not_tested_environment', 'recheck_required']
      .filter(function (k) { return s.some(function (x) { return x.collection_readiness === k; }); })
      .map(function (k) { return { value: k, label: defs[k] || k }; });
    fillSelect($('readinessFilter'), ready, '전체');
  }

  function caseFilters() {
    return {
      category: $('categoryFilter').value, audit_org: $('orgFilter').value, audit_year: $('yearFilter').value,
      audit_type: $('typeFilter').value, disposition: $('dispositionFilter').value, review_status: $('reviewFilter').value
    };
  }
  function anyCaseFilter() {
    var f = caseFilters();
    return Object.keys(f).some(function (k) { return f[k]; });
  }

  /* ---------- 상단 현황 ---------- */
  function renderStats() {
    $('statCases').textContent = state.casesLoaded ? state.cases.length + '건' : '오류';
    $('statSources').textContent = state.sourcesLoaded ? state.sources.length + '개' : '오류';
    var gen = state.caseMeta && state.caseMeta.generated_at;
    $('statUpdated').textContent = gen ? String(gen).slice(0, 10) : '–';
    $('caseTabCount').textContent = state.cases.length;
    $('sourceTabCount').textContent = state.sources.length;
    var pending = state.caseMeta && state.caseMeta.counts && state.caseMeta.counts.by_status
      ? state.caseMeta.counts.by_status.needs_review || 0 : 0;
    $('footerMeta').textContent = pending ? '감사실 검토대기 ' + pending + '건은 검토 후 공개됩니다.' : '';
  }

  /* ---------- 감사사례 ---------- */
  function renderCases() {
    var box = $('results'), notice = $('dataNotice');
    if (!state.casesLoaded) {
      $('resultSummary').textContent = '';
      $('expansionNotice').textContent = '';
      box.innerHTML = emptyHtml('감사사례 데이터를 불러오지 못했습니다.', 'data/audit_cases.js 파일이 있는지 확인한 뒤 새로고침해 주세요. 감사자료원 탭은 계속 이용할 수 있습니다.');
      return;
    }
    notice.hidden = true;

    var res = S.searchCases(state.cases, state.query, state.dict, { filters: caseFilters(), sort: $(‘sortSelect’).value });
    var rows = res.rows;

    var label = state.query ? ‘’’ + state.query + ‘’ 관련 ‘ : (anyCaseFilter() ? ‘조건에 맞는 감사사례 ‘ : ‘전체 감사사례 ‘);
    $(‘resultSummary’).textContent = label + rows.length + ‘건’;
    $(‘expansionNotice’).textContent = ‘’;

    if (!rows.length) {
      box.innerHTML = emptyHtml('현재 수록된 사례에는 검색결과가 없습니다.',
        '비슷하지 않은 사례를 억지로 보여주지 않습니다. 필터를 초기화하거나 ‘감사자료원’ 탭에서 관련 기관의 공식 공개자료를 찾아보세요.');
      return;
    }
    box.innerHTML = rows.map(function (r) { return caseHtml(r, res.parsed); }).join('');
  }

  function caseHtml(r, parsed) {
    var terms = S.highlightTerms(parsed, r);
    var x = r.item;
    var st = x.review_status;
    var why = '';
    if (state.query) {
      why = r.direct.length ? '직접 일치' : '관련 표현 일치';
      if (!r.direct.length && r.synonyms.length) why += ' · ' + r.synonyms.slice(0, 3).join(', ');
    }
    var link = x.source_url_scope === 'board'
      ? '<a class="source-link" href="' + esc(safeUrl(x.source_url)) + '" target="_blank" rel="noopener noreferrer">공식 게시판 보기 <span aria-hidden="true">↗</span></a>'
      : '<a class="source-link" href="' + esc(safeUrl(x.source_url)) + '" target="_blank" rel="noopener noreferrer">공식 게시물 보기 <span aria-hidden="true">↗</span></a>';
    var locator = x.source_url_scope === 'board' && x.source_locator
      ? '<p class="locator">찾는 방법: ' + esc(x.source_locator) + '</p>' : '';
    var summary = x.summary
      ? '<p class="summary">' + mark(x.summary, terms) + '</p>'
      : '<p class="summary muted">' + esc(x.summary_unavailable_reason || '요약 미작성 — 공식 원문에서 내용을 확인하세요.') + '</p>';
    var detail = x.disposition_detail
      ? '<p class="detail"><b>조치 내용</b> ' + mark(x.disposition_detail, terms) + '</p>' : '';
    var pages = x.source_pages
      ? '<p class="pages">원문 근거: ' + esc(x.source_document || x.audit_name) + ' ' + esc(x.source_pages) +
        (x.verified_at ? ' · 원문 대조 ' + esc(x.verified_at) : '') + '</p>' : '';
    return '' +
      '<article class="case">' +
        '<div class="case-meta">' +
          '<span class="tag">' + esc(x.category) + '</span>' +
          '<span class="tag">' + esc(x.audit_type) + '</span>' +
          '<span class="tag status status-' + esc(st) + '" title="' + esc((state.reviewDefs[st] || {}).desc || '') + '">' + esc(reviewLabel(st)) + '</span>' +
          (why ? '<span class="why">' + esc(why) + '</span>' : '') +
          '<span class="year">' + esc(x.audit_year) + '</span>' +
        '</div>' +
        '<h3>' + mark(x.title, terms) + '</h3>' +
        summary +
        '<dl class="facts">' +
          '<div><dt>처분내용</dt><dd>' + mark(x.disposition || '원문 확인', terms) + '</dd></div>' +
          '<div><dt>관련근거</dt><dd>' + (x.legal_basis ? mark(x.legal_basis, terms) : '<span class="muted">원문에서 확인</span>') + '</dd></div>' +
          '<div><dt>감사기관</dt><dd>' + mark(x.audit_org, terms) + '</dd></div>' +
          '<div><dt>감사대상</dt><dd>' + mark(x.target_org || '원문 확인', terms) + '</dd></div>' +
        '</dl>' +
        detail +
        '<div class="case-foot">' +
          '<span class="muted">' + mark(x.audit_name, terms) + ' · 게시 ' + esc(x.published_at) + '</span>' +
          link +
        '</div>' +
        pages +
        locator +
      '</article>';
  }

  /* ---------- 감사자료원 ---------- */
  function sourceFilters() {
    return {
      source_group: $('groupFilter').value,
      collection_readiness: $('readinessFilter').value,
      priority_only: $('priorityOnly').checked
    };
  }

  function renderSources() {
    var box = $('sourceResults');
    if (!state.sourcesLoaded) {
      $('sourceSummary').textContent = '';
      box.innerHTML = emptyHtml('감사자료원 데이터를 불러오지 못했습니다.', 'data/sources.js 파일이 있는지 확인한 뒤 새로고침해 주세요. 감사사례 탭은 계속 이용할 수 있습니다.');
      return;
    }
    var res = S.searchSources(state.sources, state.query, state.dict, { filters: sourceFilters() });
    var rows = res.rows;
    $('sourceSummary').textContent = (state.query ? '‘' + state.query + '’ 관련 자료원 ' : '감사자료원 ') + rows.length + '개';
    if (!rows.length) {
      box.innerHTML = emptyHtml('해당 자료원이 없습니다.', '기관명이나 지역명으로 다시 검색해 보세요.');
      return;
    }
    box.innerHTML = rows.map(function (r) {
      var terms = S.highlightTerms(res.parsed, r);
      var s = r.item;
      var pr = s.learning_priority_member ? '<span class="tag strong">연찬 우선 ' + esc(s.learning_priority_order) + '위</span>' : '';
      return '' +
        '<article class="source">' +
          '<div class="case-meta">' + pr +
            '<span class="tag ready-' + esc(s.collection_readiness) + '" title="' + esc(s.collection_readiness_basis || '') + '">' + esc(s.collection_readiness_label || s.collection_readiness) + '</span>' +
            '<span class="tag">' + esc(s.source_group) + '</span>' +
            '<span class="year">연찬 활용도 ' + esc(s.learning_priority || '-') + '</span>' +
          '</div>' +
          '<h3>' + mark(s.audit_org, terms) + '</h3>' +
          '<p class="summary">' + mark(s.menu_name || '감사결과 공개', terms) + '</p>' +
          (s.characteristics ? '<p class="desc">' + mark(s.characteristics, terms) + '</p>' : '') +
          '<div class="kw">' + (s.recommended_keywords || []).slice(0, 8).map(function (k) { return '<span>' + mark(k, terms) + '</span>'; }).join('') + '</div>' +
          '<div class="case-foot">' +
            '<span class="muted">' + esc(s.collection_readiness_basis || '') + '</span>' +
            '<a class="source-link" href="' + esc(safeUrl(s.source_url)) + '" target="_blank" rel="noopener noreferrer">공식 목록페이지 보기 <span aria-hidden="true">↗</span></a>' +
          '</div>' +
          (s.note ? '<p class="locator">' + esc(s.note) + '</p>' : '') +
        '</article>';
    }).join('');
  }

  /* ---------- 이용안내 ---------- */
  function renderGuide() {
    var order = ['approved', 'source_checked', 'needs_review', 'rejected'];
    $('reviewDefs').innerHTML = order.map(function (k) {
      var d = state.reviewDefs[k] || REVIEW_FALLBACK[k];
      return '<div><dt><span class="tag status status-' + k + '">' + esc(d.label) + '</span></dt><dd>' + esc(d.desc) + '</dd></div>';
    }).join('');
  }

  function emptyHtml(title, body) {
    return '<div class="empty"><strong>' + esc(title) + '</strong><p>' + esc(body) + '</p></div>';
  }

  /* ---------- 탭·검색·주소 ---------- */
  function showTab(tab, skipHash) {
    if (['cases', 'sources', 'guide'].indexOf(tab) === -1) tab = 'cases';
    state.tab = tab;
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (b) {
      var on = b.dataset.tab === tab;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    $('caseView').hidden = tab !== 'cases';
    $('sourceView').hidden = tab !== 'sources';
    $('guideView').hidden = tab !== 'guide';
    if (tab === 'cases') renderCases();
    if (tab === 'sources') renderSources();
    if (!skipHash) writeHash();
  }

  function runSearch(value) {
    state.query = String(value || '').trim().slice(0, 60);
    $('searchInput').value = state.query;
    if (state.tab === 'guide') state.tab = 'cases';
    showTab(state.tab);
  }

  function resetCaseFilters() {
    ['categoryFilter', 'orgFilter', 'yearFilter', 'typeFilter', 'dispositionFilter', 'reviewFilter'].forEach(function (id) { $(id).value = ''; });
  }
  function resetSourceFilters() {
    $('groupFilter').value = ''; $('readinessFilter').value = ''; $('priorityOnly').checked = false;
  }
  function resetAll() {
    state.query = '';
    $('searchInput').value = '';
    resetCaseFilters(); resetSourceFilters();
    $('sortSelect').value = 'relevance';
    showTab(state.tab === 'guide' ? 'cases' : state.tab);
  }

  // 주소창에 검색어를 남겨 결과 화면을 다른 직원과 공유할 수 있게 함 (#q=계약&tab=cases)
  function writeHash() {
    var p = [];
    if (state.query) p.push('q=' + encodeURIComponent(state.query));
    if (state.tab !== 'cases') p.push('tab=' + state.tab);
    var h = p.length ? '#' + p.join('&') : '';
    if (location.hash !== h) history.replaceState(null, '', h || location.pathname + location.search);
  }
  function readHash() {
    var h = location.hash.replace(/^#/, '');
    h.split('&').forEach(function (kv) {
      var i = kv.indexOf('=');
      if (i < 0) return;
      var k = kv.slice(0, i), v;
      try { v = decodeURIComponent(kv.slice(i + 1)); } catch (e) { v = ''; }
      if (k === 'q') state.query = v.trim().slice(0, 60);
      if (k === 'tab') state.tab = v;
    });
    $('searchInput').value = state.query;
  }

  function bindEvents() {
    $('searchForm').addEventListener('submit', function (e) { e.preventDefault(); runSearch($('searchInput').value); });
    $('searchInput').addEventListener('input', function (e) { if (!e.target.value.trim() && state.query) runSearch(''); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-query]'), function (b) {
      b.addEventListener('click', function () { if (state.tab !== 'sources') state.tab = 'cases'; runSearch(b.dataset.query); });
    });
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));
    tabs.forEach(function (b, i) {
      b.addEventListener('click', function () { showTab(b.dataset.tab); });
      b.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        var n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        n.focus(); showTab(n.dataset.tab);
      });
    });
    ['categoryFilter', 'orgFilter', 'yearFilter', 'typeFilter', 'dispositionFilter', 'reviewFilter', 'sortSelect']
      .forEach(function (id) { $(id).addEventListener('change', renderCases); });
    ['groupFilter', 'readinessFilter', 'priorityOnly'].forEach(function (id) { $(id).addEventListener('change', renderSources); });
    $('filterReset').addEventListener('click', function () { resetCaseFilters(); renderCases(); });
    $('sourceFilterReset').addEventListener('click', function () { resetSourceFilters(); renderSources(); });
    $('resetBtn').addEventListener('click', resetAll);
    window.addEventListener('hashchange', function () { readHash(); showTab(state.tab, true); });
  }

  if (!S) {
    document.getElementById('results').innerHTML = '<div class="empty"><strong>검색 기능을 불러오지 못했습니다.</strong><p>js/search.js 파일을 확인해 주세요.</p></div>';
    return;
  }
  init();
})();
