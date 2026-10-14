/**
 * search.js — 감사사례 검색 엔진
 * 직접일치(3점) > 유의어일치(1점) 방식
 * app.js와 admin.js 양쪽에서 사용
 */

const Search = (() => {

  /* ── 텍스트 정규화 ── */
  function normalize(str) {
    return String(str ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  /* 공백 무시 비교 (4자 이상 단어에만 적용) */
  function looseMatch(text, term) {
    if (term.length < 4) return text.includes(term);
    return text.replace(/\s/g, '').includes(term.replace(/\s/g, ''));
  }

  /* ── 유의어 확장 ──
   * synonyms: { 트리거어: [유의어...] }
   * 정확히 일치하는 트리거에서만 확장 (부분 포함 금지) */
  function expandTerms(query, synonyms) {
    const terms = query.split(/\s+/).filter(Boolean);
    const expanded = new Set(terms);

    for (const term of terms) {
      if (!synonyms) continue;
      for (const [trigger, syns] of Object.entries(synonyms)) {
        if (normalize(trigger) === normalize(term)) {
          syns.forEach(s => expanded.add(normalize(s)));
        }
      }
    }
    return [...expanded];
  }

  /* ── 법령 필드 검색 여부 판단 ──
   * '법', '령', '조례', '제N조' 형태일 때만 법령 필드 포함 */
  function isLegalQuery(term) {
    return /법|령|조례|규칙|제\d+조/.test(term);
  }

  /* ── 단일 사례 점수 계산 ── */
  function scoreCase(item, terms, allTerms) {
    const fields = {
      title:      { text: normalize(item.title ?? ''),      weight: 14 },
      summary:    { text: normalize(item.summary ?? ''),    weight: 8  },
      category:   { text: normalize(item.category ?? ''),   weight: 10 },
      audit_org:  { text: normalize(item.audit_org ?? ''),  weight: 4  },
      target_org: { text: normalize(item.target_org ?? ''), weight: 3  },
      audit_name: { text: normalize(item.audit_name ?? ''), weight: 3  },
      disposition:{ text: normalize(item.disposition ?? ''),weight: 2  },
    };

    let totalScore = 0;

    for (const queryTerm of terms) {
      const nTerm = normalize(queryTerm);
      let bestScore = 0;

      // 직접일치: 3점 × 가중치
      for (const { text, weight } of Object.values(fields)) {
        if (looseMatch(text, nTerm)) {
          bestScore = Math.max(bestScore, 3 * weight);
        }
      }
      // 법령 필드 (쿼리가 법령 형태일 때만)
      if (isLegalQuery(nTerm)) {
        const legalText = normalize(item.legal_basis ?? '');
        if (looseMatch(legalText, nTerm)) {
          bestScore = Math.max(bestScore, 3 * 5);
        }
      }

      // 유의어일치: 1점 × 가중치 (직접일치보다 낮게)
      if (bestScore === 0) {
        for (const synTerm of allTerms) {
          if (synTerm === nTerm) continue;
          for (const { text, weight } of Object.values(fields)) {
            if (looseMatch(text, synTerm)) {
              bestScore = Math.max(bestScore, 1 * weight);
            }
          }
        }
      }

      // 멀티워드: 모든 단어가 어딘가에 매칭돼야 함
      if (terms.length > 1 && bestScore === 0) return 0;
      totalScore += bestScore;
    }

    return totalScore;
  }

  /* ── 사례 검색 메인 ── */
  function searchCases(cases, query, synonyms, filters = {}, sortBy = 'score') {
    const q = normalize(query);

    // 필터 적용
    let results = cases.filter(c => {
      if (filters.category    && c.category    !== filters.category)    return false;
      if (filters.audit_org   && c.audit_org   !== filters.audit_org)   return false;
      if (filters.year        && String(c.audit_year) !== filters.year)  return false;
      if (filters.disposition && c.disposition !== filters.disposition)  return false;
      return true;
    });

    if (!q) {
      // 검색어 없으면 전체 반환 (정렬만 적용)
      return sort(results, sortBy, 0);
    }

    const baseTerms = q.split(/\s+/).filter(Boolean);
    const allTerms  = expandTerms(q, synonyms);

    // 점수 계산
    results = results
      .map(c => ({ ...c, _score: scoreCase(c, baseTerms, allTerms) }))
      .filter(c => c._score > 0);

    return sort(results, sortBy, 1);
  }

  /* ── 자료원 검색 ── */
  function searchSources(sources, query) {
    const q = normalize(query);
    if (!q) return sources;

    return sources.filter(s => {
      const text = [
        s.audit_org, s.source_group,
        s.learning_priority, s.collection_readiness,
        ...(s.recommended_keywords ?? [])
      ].map(normalize).join(' ');
      return q.split(/\s+/).every(t => text.includes(t));
    });
  }

  /* ── 정렬 ── */
  function sort(arr, by, hasScore) {
    return [...arr].sort((a, b) => {
      if (by === 'score' && hasScore) return (b._score ?? 0) - (a._score ?? 0);
      if (by === 'date')     return (b.audit_year ?? 0) - (a.audit_year ?? 0);
      if (by === 'category') return (a.category ?? '').localeCompare(b.category ?? '', 'ko');
      return (b._score ?? 0) - (a._score ?? 0);
    });
  }

  /* ── 검색어 하이라이트 ── */
  function highlight(text, terms) {
    if (!text || !terms?.length) return escHtml(text ?? '');
    let escaped = escHtml(text);
    const sorted = [...terms].sort((a, b) => b.length - a.length);
    for (const term of sorted) {
      if (!term) continue;
      const re = new RegExp(escRegex(term), 'gi');
      escaped = escaped.replace(re, m => `<mark>${m}</mark>`);
    }
    return escaped;
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /* ── 검토상태 라벨 ── */
  const STATUS_LABEL = {
    approved:       '검토완료',
    source_checked: '출처확인',
    needs_review:   '검토대기',
    rejected:       '제외'
  };
  function statusLabel(s) { return STATUS_LABEL[s] ?? s; }

  /* ── 우선순위 색 ── */
  const PRIORITY_COLOR = {
    '최우선': '#1a4b8c', '높음': '#166534', '보통': '#92400e', '낮음': '#6b7280'
  };

  return {
    searchCases, searchSources,
    highlight, escHtml, normalize,
    expandTerms, statusLabel, PRIORITY_COLOR
  };
})();
