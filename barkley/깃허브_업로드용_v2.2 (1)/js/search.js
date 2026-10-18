/*
 * 감사사례 연찬 도우미 — 검색 엔진 (v2.2)
 * 화면(app.js)과 자동시험(tests/*.mjs)이 같은 코드를 씁니다.
 *
 * 점수 원칙
 *   1) 검색어 직접 일치 = 항목 가중치 × 3   (가장 높음)
 *   2) 검색어가 여러 단어면 모든 단어가 어딘가에 일치해야 결과로 표시
 *
 * v2.2 한글 검색 보강 (es-hangul 라이브러리 사용, 사이트 안에 포함되어 외부 호출 없음)
 *   3) 조사 처리      ‘계약을’, ‘지하수는’ → ‘계약’, ‘지하수’
 *   4) 초성 검색      ‘ㅈㅎㅅ’ → 지하수
 *   5) 한영 전환 실수  ‘rPdir’ → ‘계약’ (결과가 없을 때만 자동 변환하고 화면에 알림)
 *   6) 오타 제안      ‘게약’ → "’계약’을 찾으셨나요?" (자동으로 바꾸지 않고 제안만)
 *   7) 일부 단어 일치  모든 단어가 들어간 사례가 없으면 0건으로 두고,
 *                    ‘일부 단어만 들어간 사례’는 별도로 안내 (억지로 결과에 섞지 않음)
 */
(function (root, factory) {
  var H = null;
  if (root && root.Hangul) H = root.Hangul;
  else if (typeof require === 'function') { try { H = require('../vendor/es-hangul.min.js'); } catch (e) { H = null; } }
  if (typeof module === 'object' && module.exports) module.exports = factory(H);
  else root.AuditSearch = factory(H);
})(typeof self !== 'undefined' ? self : this, function (Hangul) {
  'use strict';

  var CASE_FIELDS = [
    ['title', 14], ['summary', 8], ['category', 7], ['legal_basis', 4],
    ['audit_name', 4], ['audit_org', 3], ['target_org', 3], ['disposition_detail', 3],
    ['audit_type', 2], ['disposition', 2]
  ];
  var SOURCE_FIELDS = [
    ['audit_org', 10], ['recommended_keywords', 5], ['menu_name', 3], ['characteristics', 3],
    ['original_category', 2], ['source_group', 2], ['note', 1]
  ];
  // 초성 검색은 내용 항목에만 적용 (기관명·처분까지 넣으면 엉뚱한 일치가 많아짐)
  var CHOSUNG_FIELDS = { title: true, summary: true, category: true, menu_name: true, audit_org: true, recommended_keywords: true };
  var DIRECT = 3;

  function normalize(v) { return String(v == null ? '' : v).toLowerCase().replace(/\s+/g, ' ').trim(); }
  function compact(v) { return normalize(v).replace(/\s+/g, ''); }

  /* 띄어쓰기 무시 비교는 4글자 이상 단어에만 적용 ('미흡하여 비주거용'에서 '여비'가 잡히는 오검색 방지) */
  var LOOSE_MIN = 4;
  /* 관련근거(법령)는 검색어가 법령 이름처럼 보일 때만 비교 ('공유재산' 검색에 물품 사례가 섞이지 않도록) */
  var LAW_QUERY = /(법|령|규칙|조례|규정|지침|고시|훈령|예규|기준|협약)$|제\d+조/;
  var LAW_ONLY_FIELDS = { legal_basis: true };

  /* 조사: 긴 것부터 비교. 떼고 남은 말이 2글자 이상일 때만 뗌 ('공가'→'공' 같은 사고 방지) */
  var JOSA = ['에서는', '으로는', '에게서', '이라는', '에서', '으로', '에게', '까지', '부터', '이나', '하고', '처럼', '보다',
    '마다', '이란', '라는', '은', '는', '이', '가', '을', '를', '의', '에', '와', '과', '도', '로', '만'];
  var CHOSUNG_RE = /^[ㄱ-ㅎ]{2,}$/;
  var HANGUL_RE = /[가-힣]/;

  function makeTerm(t) { return { text: t, norm: normalize(t), key: compact(t) }; }
  function contains(field, term) {
    if (!term.key) return false;
    if (field.norm.indexOf(term.norm) !== -1) return true;
    return term.key.length >= LOOSE_MIN && field.key.indexOf(term.key) !== -1;
  }
  function chosungOf(text) {
    if (!Hangul) return '';
    try { return normalize(Hangul.getChoseong(String(text || '').replace(/[·,.()「」『』｢｣\[\]\/~\-:;]+/g, ' '))); } catch (e) { return ''; }
  }

  /* ---------------------------------------------------------------- 유의어 사전 */
  function createDictionary(synonymData) {
    var dict = { triggers: {}, blocked: {}, protect: {}, words: [] };
    if (!synonymData || !synonymData.groups) return dict;
    (synonymData.blocked_generic_terms || []).forEach(function (t) { dict.blocked[compact(t)] = true; });
    Object.keys(synonymData.groups).forEach(function (key) {
      var g = synonymData.groups[key] || {};
      var terms = (g.terms || []).filter(function (t) { return !dict.blocked[compact(t)]; });
      var triggers = [key].concat(g.triggers || []);
      triggers.forEach(function (tr) {
        var k = compact(tr);
        if (!k) return;
        dict.triggers[k] = (dict.triggers[k] || []).concat(terms);
        dict.protect[k] = true;
        if (dict.words.indexOf(tr) === -1) dict.words.push(tr);
      });
      (g.terms || []).forEach(function (t) {
        dict.protect[compact(t)] = true;
        if (dict.words.indexOf(t) === -1) dict.words.push(t);
      });
    });
    return dict;
  }

  /* ---------------------------------------------------------------- 말뭉치(오타 제안·조사 판단용) */
  var corpusCache = typeof WeakMap === 'function' ? new WeakMap() : null;
  function fieldText(item, name) {
    var v = item[name];
    if (Array.isArray(v)) return v.join(' ');
    return v == null ? '' : String(v);
  }
  function getCorpus(items, fields) {
    if (corpusCache && items && corpusCache.has(items)) return corpusCache.get(items);
    var freq = {}, chos = [];
    (items || []).forEach(function (it, idx) {
      var c = {};
      fields.forEach(function (f) {
        var t = fieldText(it, f[0]);
        if (!t) return;
        if (CHOSUNG_FIELDS[f[0]]) c[f[0]] = chosungOf(t);
        normalize(t).split(/[\s·,.()「」『』｢｣\[\]\/~\-:;'"“”‘’]+/).forEach(function (w) {
          if (w.length >= 2 && w.length <= 12 && HANGUL_RE.test(w)) freq[w] = (freq[w] || 0) + 1;
        });
      });
      chos[idx] = c;
    });
    var corpus = { freq: freq, chos: chos, index: new Map((items || []).map(function (it, i) { return [it, i]; })) };
    if (corpusCache && items) corpusCache.set(items, corpus);
    return corpus;
  }

  /* ---------------------------------------------------------------- 검색어 해석 */
  function stripJosa(word, dict) {
    var c = compact(word);
    if (c.length < 3 || (dict && dict.protect[c]) || (dict && dict.triggers[c])) return null;
    for (var i = 0; i < JOSA.length; i++) {
      var j = JOSA[i];
      if (c.length - j.length >= 2 && c.slice(-j.length) === j) return c.slice(0, -j.length);
    }
    return null;
  }

  function parseQuery(query, dict) {
    var q = normalize(query);
    if (!q) return { raw: '', tokens: [] };
    var words;
    if (dict && dict.triggers[compact(q)]) words = [q]; // '목적 외 사용'처럼 전체가 대표어이면 쪼개지 않음
    else words = q.split(' ').filter(Boolean);
    var seen = {}, tokens = [];
    words.forEach(function (w) {
      var c = compact(w);
      if (!c || seen[c]) return;
      seen[c] = true;
      if (CHOSUNG_RE.test(c) && Hangul) {
        tokens.push({ text: w, norm: c, key: c, chosung: true, synonyms: [], synonymTerms: [] });
        return;
      }
      var original = null;
      var stem = stripJosa(w, dict);
      if (stem) { original = w; w = stem; c = stem; }
      tokens.push({ text: w, norm: normalize(w), key: c, original: original, synonyms: [], synonymTerms: [] });
    });
    return { raw: q, tokens: tokens };
  }

  /* ---------------------------------------------------------------- 점수 */
  function score(item, parsed, fields, corpus) {
    if (!parsed.tokens.length) return { score: 1, direct: [], synonyms: [] };
    var total = 0, direct = [], synHits = [];
    var idx = corpus ? corpus.index.get(item) : undefined;
    var chos = corpus && idx !== undefined ? corpus.chos[idx] : null;
    for (var i = 0; i < parsed.tokens.length; i++) {
      var tok = parsed.tokens[i], tokScore = 0;
      var lawQuery = LAW_QUERY.test(tok.key);
      for (var f = 0; f < fields.length; f++) {
        var name = fields[f][0], w = fields[f][1], best = 0;
        if (tok.chosung) {
          if (!CHOSUNG_FIELDS[name]) continue;
          var ch = chos ? chos[name] : chosungOf(fieldText(item, name));
          // 단어 안에서만 일치. 두 글자 초성('ㄱㅇ')은 너무 많이 걸리므로 단어 첫머리에서만 인정
          var shortKey = tok.key.length < 3;
          if (ch && ch.split(' ').some(function (cw) { return shortKey ? cw.indexOf(tok.key) === 0 : cw.indexOf(tok.key) !== -1; })) {
            best = w * DIRECT;
            if (direct.indexOf(tok.text) === -1) direct.push(tok.text);
          }
          tokScore += best;
          continue;
        }
        if (LAW_ONLY_FIELDS[name] && !lawQuery) continue;
        var raw = fieldText(item, name);
        if (!raw) continue;
        var text = { norm: normalize(raw), key: compact(raw) };
        if (contains(text, tok)) {
          best = w * DIRECT;
          if (direct.indexOf(tok.text) === -1) direct.push(tok.text);
        }
        tokScore += best;
      }
      if (tokScore === 0) return { score: 0, direct: [], synonyms: [] }; // 모든 단어가 일치해야 함
      total += tokScore;
    }
    return { score: total, direct: direct, synonyms: synHits };
  }

  function byDateDesc(a, b) { return String(b.published_at || '').localeCompare(String(a.published_at || '')); }
  function passCaseFilters(c, f) {
    if (f.category && c.category !== f.category) return false;
    if (f.audit_org && c.audit_org !== f.audit_org) return false;
    if (f.audit_year && String(c.audit_year) !== String(f.audit_year)) return false;
    if (f.audit_type && c.audit_type !== f.audit_type) return false;
    if (f.disposition && (c.disposition_types || []).indexOf(f.disposition) === -1) return false;
    if (f.review_status && c.review_status !== f.review_status) return false;
    return true;
  }
  function sortRows(rows, sort) {
    rows.sort(function (a, b) {
      if (sort === 'latest') return byDateDesc(a.item, b.item) || a.item.id.localeCompare(b.item.id);
      if (sort === 'category') return String(a.item.category).localeCompare(String(b.item.category), 'ko') || byDateDesc(a.item, b.item);
      return b.score - a.score || byDateDesc(a.item, b.item) || a.item.id.localeCompare(b.item.id);
    });
    var seen = {};
    return rows.filter(function (r) { // 같은 지적사항 중복 표시 방지
      var h = r.item.content_hash || r.item.id;
      if (seen[h]) return false;
      seen[h] = true;
      return true;
    });
  }

  /* 감사사례 검색(기본): 필터 + 정렬 */
  function searchCases(cases, query, dict, opts) {
    opts = opts || {};
    var parsed = opts.parsed || parseQuery(query, dict);
    var f = opts.filters || {};
    var corpus = getCorpus(cases, CASE_FIELDS);
    var rows = [];
    (cases || []).forEach(function (c) {
      if (!passCaseFilters(c, f)) return;
      var r = score(c, parsed, CASE_FIELDS, corpus);
      if (r.score > 0) rows.push({ item: c, score: r.score, direct: r.direct, synonyms: r.synonyms });
    });
    return { parsed: parsed, rows: sortRows(rows, opts.sort || 'relevance') };
  }

  /* ---------------------------------------------------------------- 오타 제안 */
  function levenshtein(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i];
      var rowMin = cur[0];
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (cur[j] < rowMin) rowMin = cur[j];
      }
      if (rowMin > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }
  function jamo(s) {
    if (!Hangul) return s;
    try { return Hangul.disassemble(s); } catch (e) { return s; }
  }
  function closestWord(word, candidates) {
    var wj = jamo(word), max = wj.length <= 6 ? 1 : 2, best = null;
    candidates.forEach(function (cand) {
      if (cand.w === word) return;
      var d = levenshtein(wj, cand.j, max);
      if (d > max) return;
      if (!best || d < best.d || (d === best.d && cand.weight > best.weight)) best = { w: cand.w, d: d, weight: cand.weight };
    });
    return best ? best.w : null;
  }
  function candidateWords(cases, dict) {
    var corpus = getCorpus(cases, CASE_FIELDS);
    if (corpus.candidates) return corpus.candidates;
    var map = {};
    Object.keys(corpus.freq).forEach(function (w) { map[w] = corpus.freq[w]; });
    ((dict && dict.words) || []).forEach(function (w) { var k = normalize(w); if (k.indexOf(' ') === -1) map[k] = (map[k] || 0) + 5; });
    corpus.candidates = Object.keys(map).map(function (w) { return { w: w, j: jamo(w), weight: map[w] }; });
    return corpus.candidates;
  }

  /* ---------------------------------------------------------------- 통합 검색 (화면에서 사용) */
  function search(cases, query, dict, opts) {
    opts = opts || {};
    var base = searchCases(cases, query, dict, opts);
    var out = { parsed: base.parsed, rows: base.rows, usedQuery: normalize(query), converted: false, suggestion: null, partialRows: [], partialTokens: [] };
    var q = normalize(query);
    if (!q || base.rows.length) return out;

    // 9) 한영 전환 실수: 영문만 입력했고 결과가 없으면 한글 자판으로 바꿔 다시 검색
    var rawQ = String(query || '').trim().replace(/\s+/g, ' ');
    if (Hangul && /^[a-z\s]+$/i.test(rawQ)) {
      var conv;
      try { conv = rawQ.split(' ').map(function (w) { return Hangul.convertQwertyToHangul(w); }).join(' '); } catch (e) { conv = null; }
      if (conv && conv !== q && HANGUL_RE.test(conv)) {
        var r2 = searchCases(cases, conv, dict, opts);
        if (r2.rows.length) {
          out.parsed = r2.parsed; out.rows = r2.rows; out.usedQuery = conv; out.converted = true;
          return out;
        }
      }
    }

    // 11) 일부 단어만 일치: 단어별로 따로 찾아서 안내용으로만 보관
    var toks = base.parsed.tokens;
    if (toks.length >= 2) {
      var byId = {};
      toks.forEach(function (t) {
        var single = searchCases(cases, '', dict, { filters: opts.filters, parsed: { raw: t.text, tokens: [t] } });
        if (single.rows.length) out.partialTokens.push({ text: t.text, count: single.rows.length });
        single.rows.forEach(function (r) {
          var e = byId[r.item.id] || (byId[r.item.id] = { item: r.item, score: 0, direct: [], synonyms: [], matched: [] });
          e.score += r.score; e.matched.push(t.text);
          e.direct = e.direct.concat(r.direct); e.synonyms = e.synonyms.concat(r.synonyms);
        });
      });
      out.partialRows = Object.keys(byId).map(function (k) { return byId[k]; })
        .sort(function (a, b) { return b.matched.length - a.matched.length || b.score - a.score; });
    }

    // 10) 오타 제안: 결과가 없는 단어를 가까운 낱말로 바꿔 보고, 결과가 생기면 제안
    var cands = candidateWords(cases, dict);
    var changed = false;
    var suggestedWords = toks.map(function (t) {
      if (t.chosung) return t.text;
      var single = searchCases(cases, '', dict, { filters: opts.filters, parsed: { raw: t.text, tokens: [t] } });
      if (single.rows.length) return t.original ? t.text : t.text;
      var near = closestWord(t.text, cands);
      if (near) { changed = true; return near; }
      return t.text;
    });
    if (changed) {
      var sq = suggestedWords.join(' ');
      if (searchCases(cases, sq, dict, opts).rows.length) out.suggestion = sq;
    }
    return out;
  }

  /* ---------------------------------------------------------------- 감사자료원 검색 */
  function searchSources(sources, query, dict, opts) {
    opts = opts || {};
    var parsed = parseQuery(query, dict);
    var f = opts.filters || {};
    var corpus = getCorpus(sources, SOURCE_FIELDS);
    var rows = [];
    (sources || []).forEach(function (s) {
      if (f.source_group && s.source_group !== f.source_group) return;
      if (f.collection_readiness && s.collection_readiness !== f.collection_readiness) return;
      if (f.priority_only && !s.learning_priority_member) return;
      var r = score(s, parsed, SOURCE_FIELDS, corpus);
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

  /* ---------------------------------------------------------------- 자동완성 후보 */
  function suggestionList(cases, dict) {
    var set = {};
    ((dict && dict.words) || []).forEach(function (w) { if (w.length >= 2) set[w] = 1; });
    (cases || []).forEach(function (c) { if (c.category) set[c.category] = 1; });
    return Object.keys(set).sort(function (a, b) { return a.localeCompare(b, 'ko'); });
  }

  /* ---------------------------------------------------------------- 강조표시 */
  function segments(text, terms) {
    text = text == null ? '' : String(text);
    var list = (terms || []).filter(Boolean).map(function (t) { return normalize(t); })
      .filter(function (t, i, a) { return t && a.indexOf(t) === i && !CHOSUNG_RE.test(t); })
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
  function highlightTerms(parsed) {
    var t = [];
    parsed.tokens.forEach(function (tok) { if (!tok.chosung) t.push(tok.text); });
    return t;
  }

  return {
    normalize: normalize, compact: compact, createDictionary: createDictionary, parseQuery: parseQuery,
    search: search, searchCases: searchCases, searchSources: searchSources, suggestionList: suggestionList,
    segments: segments, highlightTerms: highlightTerms, hasHangulLib: !!Hangul,
    CASE_FIELDS: CASE_FIELDS, SOURCE_FIELDS: SOURCE_FIELDS
  };
});
