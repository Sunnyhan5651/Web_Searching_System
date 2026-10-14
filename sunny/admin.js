/**
 * admin.js — 관리자 페이지 (admin.html) 로직
 *
 * 인증 방식: 아이디/비밀번호를 sessionStorage에 저장 (정적 사이트 기준)
 * 데이터: localStorage에 임시 보관 → JSON 내보내기 → GitHub push로 배포
 *
 * ⚠️ 비밀번호는 소스코드에 노출됩니다.
 *    공개 저장소에 올릴 때 반드시 변경하세요.
 */

(() => {
  /* ══ 설정 ══════════════════════════════════════════════ */
  const ADMIN_CREDENTIALS = [
    { id: 'admin', pw: 'gunpo2024!' }   // ← 운영 전 반드시 변경
  ];
  const LS_CASES   = 'audit_cases_draft';
  const LS_SOURCES = 'audit_sources_draft';
  const SS_AUTH    = 'admin_authed';

  /* ══ 상태 ═════════════════════════════════════════════ */
  let cases   = [];
  let sources = [];
  let activeTab = 'cases';

  /* ══ DOM ══════════════════════════════════════════════ */
  const $ = id => document.getElementById(id);

  /* ══ 인증 ═════════════════════════════════════════════ */
  function isAuthed() { return sessionStorage.getItem(SS_AUTH) === '1'; }

  function login(id, pw) {
    return ADMIN_CREDENTIALS.some(c => c.id === id && c.pw === pw);
  }

  function logout() {
    sessionStorage.removeItem(SS_AUTH);
    location.reload();
  }

  /* ══ 초기화 ════════════════════════════════════════════ */
  async function init() {
    if (!isAuthed()) {
      showLogin();
      return;
    }
    showAdmin();
    await loadData();
    renderAll();
  }

  function showLogin() {
    $('loginPage').style.display  = 'flex';
    $('adminPage').style.display  = 'none';
    $('btnLogout').style.display  = 'none';
  }

  function showAdmin() {
    $('loginPage').style.display  = 'none';
    $('adminPage').style.display  = 'block';
    $('btnLogout').style.display  = 'inline-block';
    $('adminUserLabel').textContent = sessionStorage.getItem('admin_id') ?? '';
  }

  /* ══ 데이터 로드 ════════════════════════════════════════ */
  async function loadData() {
    // localStorage 초안이 있으면 우선 사용
    const draftCases   = localStorage.getItem(LS_CASES);
    const draftSources = localStorage.getItem(LS_SOURCES);

    if (draftCases) {
      try { cases = JSON.parse(draftCases); } catch { cases = []; }
    } else {
      try {
        const res = await fetch('./data/audit_cases.json');
        cases = res.ok ? await res.json() : [];
      } catch { cases = []; }
    }

    if (draftSources) {
      try { sources = JSON.parse(draftSources); } catch { sources = []; }
    } else {
      try {
        const res = await fetch('./data/sources.json');
        sources = res.ok ? await res.json() : [];
      } catch { sources = []; }
    }
  }

  function saveDraft() {
    localStorage.setItem(LS_CASES,   JSON.stringify(cases));
    localStorage.setItem(LS_SOURCES, JSON.stringify(sources));
  }

  /* ══ 렌더링 ════════════════════════════════════════════ */
  function renderAll() {
    renderStats();
    renderCaseTable();
    renderSourceTable();
  }

  function renderStats() {
    const approved = cases.filter(c => c.review_status === 'approved').length;
    $('statCards').innerHTML = `
      <div class="stat-card"><div class="num">${cases.length}</div><div class="lbl">전체 감사사례</div></div>
      <div class="stat-card"><div class="num">${approved}</div><div class="lbl">승인 완료</div></div>
      <div class="stat-card"><div class="num">${cases.length - approved}</div><div class="lbl">검토 대기</div></div>
      <div class="stat-card"><div class="num">${sources.length}</div><div class="lbl">감사자료원</div></div>
    `;
  }

  /* ── 사례 테이블 ── */
  function renderCaseTable() {
    $('caseTableCount').textContent = cases.length;
    const tbody = $('caseTableBody');

    if (!cases.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--gray-4)">등록된 사례가 없습니다</td></tr>`;
      return;
    }

    tbody.innerHTML = cases.map((c, i) => `
<tr>
  <td style="color:var(--gray-4);font-size:.75rem">${Search.escHtml(c.id ?? String(i+1))}</td>
  <td class="td-title">${Search.escHtml(c.title ?? '')}</td>
  <td>${Search.escHtml(c.category ?? '')}</td>
  <td>${Search.escHtml(c.audit_org ?? '')}</td>
  <td>${Search.escHtml(String(c.audit_year ?? ''))}</td>
  <td>
    <span class="review-badge badge-${c.review_status ?? 'needs_review'}">
      ${Search.statusLabel(c.review_status)}
    </span>
  </td>
  <td>
    <div class="td-actions">
      <button class="btn-secondary" style="padding:4px 8px;font-size:.75rem" onclick="AdminActions.editCase(${i})">수정</button>
      <button class="btn-danger" onclick="AdminActions.deleteCase(${i})">삭제</button>
    </div>
  </td>
</tr>`).join('');
  }

  /* ── 자료원 테이블 ── */
  function renderSourceTable() {
    $('sourceTableCount').textContent = sources.length;
    const tbody = $('sourceTableBody');

    if (!sources.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--gray-4)">등록된 자료원이 없습니다</td></tr>`;
      return;
    }

    tbody.innerHTML = sources.map((s, i) => `
<tr>
  <td>${Search.escHtml(s.audit_org ?? '')}</td>
  <td>${Search.escHtml(s.source_group ?? '')}</td>
  <td>${Search.escHtml(s.learning_priority ?? '')}</td>
  <td>${Search.escHtml(s.collection_readiness === 'ready' ? '수집 가능' : s.collection_readiness === 'manual' ? '수동 등록' : '확인 필요')}</td>
  <td>
    <div class="td-actions">
      <button class="btn-secondary" style="padding:4px 8px;font-size:.75rem" onclick="AdminActions.editSource(${i})">수정</button>
      <button class="btn-danger" onclick="AdminActions.deleteSource(${i})">삭제</button>
    </div>
  </td>
</tr>`).join('');
  }

  /* ══ 모달 ══════════════════════════════════════════════ */
  function openCaseModal(idx = -1) {
    const modal = $('caseModal');
    const isEdit = idx >= 0;
    $('caseModalTitle').textContent = isEdit ? '감사사례 수정' : '감사사례 추가';
    $('caseEditId').value = idx;

    const c = isEdit ? cases[idx] : {};
    $('fAuditOrg').value    = c.audit_org    ?? '';
    $('fTargetOrg').value   = c.target_org   ?? '';
    $('fAuditYear').value   = c.audit_year   ?? '';
    $('fAuditName').value   = c.audit_name   ?? '';
    $('fCategory').value    = c.category     ?? '';
    $('fDisposition').value = c.disposition  ?? '';
    $('fTitle').value       = c.title        ?? '';
    $('fSummary').value     = c.summary      ?? '';
    $('fLegalBasis').value  = c.legal_basis  ?? '';
    $('fSourceUrl').value   = c.source_url   ?? '';
    $('fReviewStatus').value= c.review_status ?? 'needs_review';

    modal.classList.add('open');
    $('fAuditOrg').focus();
  }

  function closeCaseModal() { $('caseModal').classList.remove('open'); }

  function saveCaseModal() {
    const form = $('caseForm');
    if (!form.reportValidity()) return;

    const idx  = parseInt($('caseEditId').value);
    const isEdit = idx >= 0;
    const c = isEdit ? cases[idx] : {};

    const updated = {
      ...c,
      id:           c.id ?? `case-${Date.now()}`,
      audit_org:    $('fAuditOrg').value.trim(),
      target_org:   $('fTargetOrg').value.trim(),
      audit_year:   parseInt($('fAuditYear').value) || null,
      audit_name:   $('fAuditName').value.trim(),
      category:     $('fCategory').value,
      disposition:  $('fDisposition').value,
      title:        $('fTitle').value.trim(),
      summary:      $('fSummary').value.trim(),
      legal_basis:  $('fLegalBasis').value.trim(),
      source_url:   $('fSourceUrl').value.trim(),
      review_status:$('fReviewStatus').value,
    };

    if (isEdit) cases[idx] = updated;
    else cases.unshift(updated);

    saveDraft();
    closeCaseModal();
    renderCaseTable();
    renderStats();
    toast('저장되었습니다 (내보내기 후 GitHub push 필요)', 'success');
  }

  function openSourceModal(idx = -1) {
    const modal = $('sourceModal');
    const isEdit = idx >= 0;
    $('sourceModalTitle').textContent = isEdit ? '자료원 수정' : '자료원 추가';
    $('sourceEditId').value = idx;

    const s = isEdit ? sources[idx] : {};
    $('sfAuditOrg').value  = s.audit_org            ?? '';
    $('sfGroup').value     = s.source_group          ?? '광역';
    $('sfSourceUrl').value = s.source_url            ?? '';
    $('sfPriority').value  = s.learning_priority     ?? '보통';
    $('sfReadiness').value = s.collection_readiness  ?? 'manual';
    $('sfKeywords').value  = (s.recommended_keywords ?? []).join(', ');

    modal.classList.add('open');
    $('sfAuditOrg').focus();
  }

  function closeSourceModal() { $('sourceModal').classList.remove('open'); }

  function saveSourceModal() {
    const form = $('sourceForm');
    if (!form.reportValidity()) return;

    const idx    = parseInt($('sourceEditId').value);
    const isEdit = idx >= 0;
    const s = isEdit ? sources[idx] : {};

    const updated = {
      ...s,
      id:                   s.id ?? `src-${Date.now()}`,
      audit_org:            $('sfAuditOrg').value.trim(),
      source_group:         $('sfGroup').value,
      source_url:           $('sfSourceUrl').value.trim(),
      learning_priority:    $('sfPriority').value,
      collection_readiness: $('sfReadiness').value,
      recommended_keywords: $('sfKeywords').value.split(',').map(k => k.trim()).filter(Boolean),
    };

    if (isEdit) sources[idx] = updated;
    else sources.unshift(updated);

    saveDraft();
    closeSourceModal();
    renderSourceTable();
    renderStats();
    toast('저장되었습니다', 'success');
  }

  /* ══ 내보내기 ══════════════════════════════════════════ */
  function downloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ══ 가져오기 (JSON 파일 불러오기) ═══════════════════ */
  function importJson(file, callback) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (!Array.isArray(data)) throw new Error('배열 형식이 아닙니다');
        callback(data);
      } catch (err) {
        toast('JSON 파일 형식이 올바르지 않습니다: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  }

  /* ══ 탭 전환 ════════════════════════════════════════════ */
  function switchAdminTab(name) {
    activeTab = name;
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.atab === name);
    });
    document.querySelectorAll('.atab-content').forEach(el => {
      el.style.display = el.id === `atab-${name}` ? 'block' : 'none';
    });
  }

  /* ══ 토스트 알림 ════════════════════════════════════════ */
  function toast(msg, type = '') {
    const el = $('toast');
    el.textContent = msg;
    el.className = `toast ${type} show`;
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 3000);
  }

  /* ══ 전역 노출 (인라인 onclick용) ══════════════════════ */
  window.AdminActions = {
    editCase:   idx => openCaseModal(idx),
    deleteCase: idx => {
      if (!confirm('이 사례를 삭제하시겠습니까?')) return;
      cases.splice(idx, 1);
      saveDraft();
      renderCaseTable();
      renderStats();
      toast('삭제되었습니다');
    },
    editSource:   idx => openSourceModal(idx),
    deleteSource: idx => {
      if (!confirm('이 자료원을 삭제하시겠습니까?')) return;
      sources.splice(idx, 1);
      saveDraft();
      renderSourceTable();
      renderStats();
      toast('삭제되었습니다');
    }
  };

  /* ══ 이벤트 바인딩 ══════════════════════════════════════ */

  // 로그인
  $('loginForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const id = $('inputId').value.trim();
    const pw = $('inputPw').value;
    if (login(id, pw)) {
      sessionStorage.setItem(SS_AUTH, '1');
      sessionStorage.setItem('admin_id', id);
      showAdmin();
      loadData().then(renderAll);
    } else {
      $('loginError').textContent = '아이디 또는 비밀번호가 올바르지 않습니다.';
    }
  });

  $('btnLogout')?.addEventListener('click', logout);

  // 관리자 탭
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchAdminTab(btn.dataset.atab));
  });

  // 사례 모달
  $('btnAddCase')?.addEventListener('click', () => openCaseModal());
  $('btnCaseModalCancel')?.addEventListener('click', closeCaseModal);
  $('btnCaseModalSave')?.addEventListener('click', saveCaseModal);
  $('caseModal')?.addEventListener('click', e => { if (e.target === $('caseModal')) closeCaseModal(); });

  // 자료원 모달
  $('btnAddSource')?.addEventListener('click', () => openSourceModal());
  $('btnSourceModalCancel')?.addEventListener('click', closeSourceModal);
  $('btnSourceModalSave')?.addEventListener('click', saveSourceModal);
  $('sourceModal')?.addEventListener('click', e => { if (e.target === $('sourceModal')) closeSourceModal(); });

  // 내보내기
  $('btnExportCases')?.addEventListener('click', () => {
    downloadJson(cases, 'audit_cases.json');
    toast('audit_cases.json 다운로드 완료', 'success');
  });
  $('btnExportSources')?.addEventListener('click', () => {
    downloadJson(sources, 'sources.json');
    toast('sources.json 다운로드 완료', 'success');
  });

  // 가져오기
  $('btnImportCases')?.addEventListener('click', () => $('importFileCases').click());
  $('importFileCases')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    importJson(file, data => {
      if (!confirm(`${data.length}건의 데이터를 불러옵니다. 현재 데이터를 덮어씁니까?`)) return;
      cases = data;
      saveDraft();
      renderCaseTable();
      renderStats();
      toast(`${data.length}건 불러오기 완료`, 'success');
    });
    e.target.value = '';
  });

  $('btnImportSources')?.addEventListener('click', () => $('importFileSources').click());
  $('importFileSources')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    importJson(file, data => {
      if (!confirm(`${data.length}개의 자료원을 불러옵니다. 현재 데이터를 덮어씁니까?`)) return;
      sources = data;
      saveDraft();
      renderSourceTable();
      renderStats();
      toast(`${data.length}개 불러오기 완료`, 'success');
    });
    e.target.value = '';
  });

  /* ══ 시작 ══════════════════════════════════════════════ */
  init();
})();
