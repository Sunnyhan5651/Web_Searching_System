/*
 * 감사사례 연찬 도우미 — 검색 엔진
 * 화면(app.js)과 자동시험(tests/run_tests.mjs)이 같은 코드를 씁니다.
 *
 * 점수 원칙 (인계서 9장)
 *   1) 검색어 직접 일치 = 항목 가중치 × 3   (가장 높음)
 *   2) 유의어 일치     = 항목 가중치 × 1   (직접 일치보다 낮음)
 *   3) 한 항목에서는 둘 중 높은 점수 하나만 인정 (점수 부풀림 방지)
 *   4) 검색어가 여러 단어면 모든 단어가 어딘가에 일치해야 결과로 표시
 *   5) 일반어(관리·정산·하자 등)는 유의어로 확장하지 않음
 *   6) 유의어 확장은 검색어가 그룹의 '대표어'와 정확히 같을 때만 일어남
 *      (기존판은 부분일치를 양방향으로 비교해 확장 범위가 들쭉날쭉했음)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AuditSearch = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* 카드에 표시되는 요소만 검색합니다 (태그·배지 포함).
     audit_type 은 샘플 데이터에 없어 제외. legal_basis 는 법령명 쿼리일 때만 비교. */
  var CASE_FIELDS = [
    ['title', 14], ['summary', 8], ['category', 7], ['legal_basis', 4],
    ['audit_name', 4], ['audit_org', 3], ['target_org', 3], ['disposition', 2]
  ];
  var SOURCE_FIELDS = [
    ['audit_org', 10], ['recommended_keywords', 5], ['menu_name', 3], ['characteristics', 3],
    ['original_category', 2], ['source_group', 2], ['note', 1]
  ];
  var DIRECT = 3, SYNONYM = 1;

  function normalize(v) { return String(v == null ? '' : v).toLowerCase().replace(/\s+/g, ' ').trim(); }
  function compact(v) { return normalize(v).replace(/\s+/g, ''); }

  /* 띄어쓰기 무시 비교는 4글자 이상 단어에만 적용합니다.
     (짧은 단어까지 무시하면 '미흡하여 비주거용'에서 '여비'가 잡히는 식의 오검색이 생김) */
  var LOOSE_MIN = 4;
  /* 관련근거(법령) 항목은 검색어가 법령 이름처럼 보일 때만 비교합니다.
     예) '지하수법', '지방계약법', '복무규정' → 관련근거까지 검색
         '공유재산' → 관련근거는 건너뜀 (「공유재산 및 물품 관리 조례」를 인용한 물품 사례가 섞이지 않도록) */
  var LAW_QUERY = /(법|령|규칙|조례|규정|지침|고시|훈령|예규|기준|협약)$|제\d+조/;
  var LAW_ONLY_FIELDS = { legal_basis: true };
  function makeTerm(t) { return { text: t, norm: normalize(t), key: compact(t) }; }
  function contains(field, term) {
    if (!term.key) return false;
    if (field.norm.indexOf(term.norm) !== -1) return true;
    return term.key.length >= LOOSE_MIN && field.key.indexOf(term.key) !== -1;
  }

  /* 유의어 사전 준비 */
  function createDictionary(synonymData) {
    var dict = { triggers: {}, blocked: {} };
    if (!synonymData) return dict;
    (synonymData.blocked_generic_terms || []).forEach(function (t) { dict.blocked[compact(t)] = true; });
    // .groups 형식(레거시)과 .categories 형식(현행 synonyms.json) 모두 지원
    var groups = synonymData.groups || synonymData.categories;
    if (!groups) return dict;
    Object.keys(groups).forEach(function (key) {
      var g = groups[key] || {};
      // .groups → g.terms / .categories → g.seed_terms 또는 g.related
      var terms = (g.terms || g.seed_terms || g.related || [])
        .filter(function (t) { return !dict.blocked[compact(t)]; });
      // 명시적 트리거 + 키 자체 + "계약·회계" 같은 복합 키 분리
      var triggers = (g.triggers || []).concat([key]);
      key.split(/[·\/]/).forEach(function (part) {
        part = part.trim();
        if (part && triggers.indexOf(part) === -1) triggers.push(part);
      });
      triggers.forEach(function (tr) {
        var k = compact(tr);
        if (!k) return;
        dict.triggers[k] = (dict.triggers[k] || []).concat(terms);
      });
    });
    return dict;
  }

  /* 검색어 해석: 단어 목록 + 단어별 유의어 */
  function parseQuery(query, dict) {
    var q = normalize(query);
    if (!q) return { raw: '', tokens: [] };
    var words;
    // 전체 문구가 그대로 대표어이면 쪼개지 않음 (예: '목적 외 사용')
    if (dict && dict.triggers[compact(q)]) words = [q];
    else words = q.split(' ').filter(Boolean);
    var seen = {};
    var tokens = [];
    words.forEach(function (w) {
      var c = compact(w);
      // 한 음절짜리 토큰('외', '이', '가' 등)은 거의 모든 문서에 등장해 오검색을 유발
      if (!c || c.length < 2 || seen[c]) return;
      seen[c] = true;
      // 유의어 확장 비활성화: 검색어가 직접 포함된 결과만 반환
      tokens.push({ text: w, norm: normalize(w), key: c, synonyms: [], synonymTerms: [] });
    });
    return { raw: q, tokens: tokens };
  }

  function fieldText(item, name) {
    var v = item[name];
    if (Array.isArray(v)) return v.join(' ');
    return v == null ? '' : String(v);
  }

  /* 한 건의 점수 계산. 일치하지 않으면 score 0 */
  function score(item, parsed, fields) {
    if (!parsed.tokens.length) return { score: 1, direct: [], synonyms: [] };
    var total = 0, direct = [], synHits = [];
    for (var i = 0; i < parsed.tokens.length; i++) {
      var tok = parsed.tokens[i], tokScore = 0;
      var lawQuery = LAW_QUERY.test(tok.key);
      for (var f = 0; f < fields.length; f++) {
        if (LAW_ONLY_FIELDS[fields[f][0]] && !lawQuery) continue;
        var raw = fieldText(item, fields[f][0]);
        if (!raw) continue;
        var text = { norm: normalize(raw), key: compact(raw) };
        var w = fields[f][1], best = 0;
        if (contains(text, tok)) {
          best = w * DIRECT;
          if (direct.indexOf(tok.text) === -1) direct.push(tok.text);
        } else {
          for (var s = 0; s < tok.synonymTerms.length; s++) {
            if (contains(text, tok.synonymTerms[s])) {
              best = w * SYNONYM;
              if (synHits.indexOf(tok.synonyms[s]) === -1) synHits.push(tok.synonyms[s]);
              break;
            }
          }
        }
        tokScore += best;
      }
      if (tokScore === 0) return { score: 0, direct: [], synonyms: [] }; // 모든 단어가 일치해야 함
      total += tokScore;
    }
    return { score: total, direct: direct, synonyms: synHits };
  }

  function byDateDesc(a, b) { return String(b.published_at || '').localeCompare(String(a.published_at || '')); }

  /* 감사사례 검색 + 필터 + 정렬 */
  function searchCases(cases, query, dict, opts) {
    opts = opts || {};
    var parsed = parseQuery(query, dict);
    var f = opts.filters || {};
    var rows = [];
    (cases || []).forEach(function (c) {
      if (f.category && c.category !== f.category) return;
      if (f.audit_org && c.audit_org !== f.audit_org) return;
      if (f.audit_year && String(c.audit_year) !== String(f.audit_year)) return;
      if (f.audit_type && c.audit_type !== f.audit_type) return;
      if (f.disposition && (c.disposition_types || []).indexOf(f.disposition) === -1) return;
      if (f.review_status && c.review_status !== f.review_status) return;
      var r = score(c, parsed, CASE_FIELDS);
      if (r.score > 0) rows.push({ item: c, score: r.score, direct: r.direct, synonyms: r.synonyms });
    });
    var sort = opts.sort || 'relevance';
    rows.sort(function (a, b) {
      if (sort === 'latest') return byDateDesc(a.item, b.item) || a.item.id.localeCompare(b.item.id);
      if (sort === 'category') return String(a.item.category).localeCompare(String(b.item.category), 'ko') || byDateDesc(a.item, b.item);
      return b.score - a.score || byDateDesc(a.item, b.item) || a.item.id.localeCompare(b.item.id);
    });
    // 같은 지적사항이 두 번 나오지 않도록 (content_hash 기준)
    var seen = {};
    rows = rows.filter(function (r) {
      var h = r.item.content_hash || r.item.id;
      if (seen[h]) return false;
      seen[h] = true;
      return true;
    });
    return { parsed: parsed, rows: rows };
  }

  /* 감사자료원 검색 */
  function searchSources(sources, query, dict, opts) {
    opts = opts || {};
    var parsed = parseQuery(query, dict);
    var f = opts.filters || {};
    var rows = [];
    (sources || []).forEach(function (s) {
      if (f.source_group && s.source_group !== f.source_group) return;
      if (f.collection_readiness && s.collection_readiness !== f.collection_readiness) return;
      if (f.priority_only && !s.learning_priority_member) return;
      var r = score(s, parsed, SOURCE_FIELDS);
      if (r.score > 0) rows.push({ item: s, score: r.score, direct: r.direct, synonyms: r.synonyms });
    });
    rows.sort(function (a, b) {
      var pa = a.item.learning_priority_order == null ? 999 : a.item.learning_priority_order;
      var pb = b.item.learning_priority_order == null ? 999 : b.item.learning_priority_order;
      if (parsed.tokens.length && b.score !== a.score) return b.score - a.score;
      return pa - pb || String(a.item.audit_org).localeCompare(String(b.item.audit_org), 'ko');
    });
    return { parsed: parsed, rows: rows };
  }

  /* 강조표시: 원문을 [{text, mark}] 조각으로 나눔 (HTML 이스케이프는 화면에서 처리) */
  function segments(text, terms) {
    text = text == null ? '' : String(text);
    var list = (terms || []).filter(Boolean).map(function (t) { return normalize(t); })
      .filter(function (t, i, a) { return t && a.indexOf(t) === i; })
      .sort(function (a, b) { return compact(b).length - compact(a).length; }).slice(0, 30);
    if (!list.length || !text) return [{ text: text, mark: false }];
    var escapeCh = function (ch) { return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
    var pattern = list.map(function (t) {
      var c = t.replace(/\s+/g, '');
      if (c.length >= LOOSE_MIN) return c.split('').map(escapeCh).join('\\s*');
      return t.split(' ').map(function (part) { return part.split('').map(escapeCh).join(''); }).join('\\s+');
    }).join('|');
    var re = new RegExp(pattern, 'gi'), out = [], last = 0, m;
    while ((m = re.exec(text)) !== null) {
      if (m[0] === '') { re.lastIndex++; continue; }
      if (m.index > last) out.push({ text: text.slice(last, m.index), mark: false });
      out.push({ text: m[0], mark: true });
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ text: text.slice(last), mark: false });
    return out;
  }

  /* 하이라이트 대상: 검색어 직접어 + 실제 매칭된 유의어만 포함
     (매칭되지 않은 유의어까지 강조하면 엉뚱한 단어가 밑줄 표시됨)
     row = searchCases/searchSources 반환값의 rows[i] */
  function highlightTerms(parsed, row) {
    var t = parsed.tokens.map(function (tok) { return tok.text; });
    if (row) t = t.concat(row.synonyms || []);
    return t;
  }

  return {
    normalize: normalize, compact: compact, createDictionary: createDictionary, parseQuery: parseQuery,
    searchCases: searchCases, searchSources: searchSources, segments: segments, highlightTerms: highlightTerms,
    CASE_FIELDS: CASE_FIELDS, SOURCE_FIELDS: SOURCE_FIELDS
  };
});
