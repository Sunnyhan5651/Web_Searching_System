const CASE_BASES = {
  bai: {
    audit_org: '감사원', target_org: '고양시', audit_year: 2025,
    audit_name: '고양시 정기감사', audit_type: '기관정기감사', published_at: '2025-12-18',
    source_url: 'https://www.bai.go.kr/bai/result/branch/detail?srno=3236'
  },
  seoul: {
    audit_org: '서울특별시 감사위원회', target_org: '서울물재생시설공단', audit_year: 2026,
    audit_name: '서울물재생시설공단 기관운영 감사', audit_type: '기관운영감사', published_at: '2026-09-15',
    source_url: 'https://news.seoul.go.kr/gov/archives/580883'
  },
  sdm: {
    audit_org: '서대문구', target_org: '치수과', audit_year: 2026,
    audit_name: '2026년 치수과 종합감사', audit_type: '종합감사', published_at: '2026-06-22',
    source_url: 'https://www.sdm.go.kr/clean/inspect/result.do'
  }
};

const baiRows = [
  ['인허가','도시기본계획보다 높은 인구밀도의 도시개발사업 인가 및 상업지역 오피스텔 다수 건축허가','높은 인구밀도의 개발사업 인허가와 다수의 오피스텔 허가로 업무·상업 기능이 저해되고 도로 정체, 주차장 및 편의시설 부족 문제가 확인됨.','통보'],
  ['인허가','오피스텔 녹색건축 등 인증제도 기준 미흡','주거용으로 사용되는 오피스텔의 녹색건축 등 인증기준이 미흡하여 비주거용 인증서가 발행되는 문제가 확인됨.','통보'],
  ['공사·용역','협의 지연으로 복합커뮤니티 개발사업 중단','공동사업자와 설계변경 등에 관한 협의가 지연되어 사업이 중단되고 매몰비용이 발생함.','주의·통보'],
  ['계약·회계','무허가 보험사의 계약이행보증증권 수납 및 확인 소홀','부적법한 계약이행 보증보험증권을 수납하고 보증회사가 채무를 이행하지 않아 계약이행보증금 손해가 발생함.','시정·주의'],
  ['계약·회계','납품 검사·검수 소홀로 대금 과다 지급','생활쓰레기 봉투 일부만 납품받은 상태에서 대금을 전액 지급하여 재정상 손해가 발생함.','시정·주의'],
  ['지방보조금','지방보조금 교부 및 정산 업무 처리 부적정','지방보조사업자가 보조금을 업체 운영경비 등으로 사용하였으나 정산 소홀로 적기에 확인하지 못함.','시정·주의'],
  ['세입·세출','피공탁자 잘못 지정으로 재정상 손해 발생','매매계약 해제 관련 공탁금의 피공탁자를 잘못 지정하고 다시 공탁하는 과정에서 지연이자 등 재정상 손해가 발생함.','변상판정'],
  ['인사','일반직 4급 등 승진임용 부당 처리','승진추천자를 인사위원회 전에 내정하고 징계 이력을 제외하거나 실적을 부풀려 보고하는 등 인사위원회 심의가 형식적으로 운영됨.','징계·주의'],
  ['징계','기소 결정된 공무원에 대한 징계의결 요구 지연','수사 결과를 통보받고도 필요한 조사와 징계의결 요구를 지체함.','주의'],
  ['복무','겸직 및 외부강의 미신고','겸직신고 및 외부강의 신고 대상자가 관련 신고를 하지 않은 사례가 확인됨.','주의'],
  ['인허가','위법한 용도변경 허가 후 원상복구 미실시','위법한 용도변경 허가와 관련하여 결재자를 제외하고 기안자만 조사하였고 원상복구 명령도 실시하지 않음.','주의·통보'],
  ['인허가','관광농원 사후관리 미이행','위법한 관광농원 사업 취소 과정의 절차 위반으로 행정심판에서 패소한 후에도 하자 치유와 후속 절차를 이행하지 않음.','주의·통보'],
  ['인허가','미운영·방치 관광농원에 대한 행정처분 규정 미비','미운영 또는 방치된 관광농원에 대해 사업계획 승인 취소 등을 할 수 있는 행정처분 기준이 미비함.','통보']
];

const seoulRows = [
  ['계약·회계','특정제품 선정심사위원회 운영 부적정','특정제품 선정심사위원회의 구성·운영과 관련 계약 추진 과정의 적정성이 미흡함.','주의·기관경고'],
  ['계약·회계','슬러지건조시설 및 대기오염방지시설 제조·구매 설치 계약 부적정','계약 절차와 공법 선정 업무처리가 적정하지 않은 사항이 확인됨.','시정·통보'],
  ['계약·회계','하수 및 분뇨처리시설 기술진단 용역 계약 부적정','기술진단 용역의 계약상대자 선정 업무가 적정하지 않게 처리됨.','주의'],
  ['계약·회계','변경계약을 통한 사실상의 수의계약 체결','변경계약 방식으로 사실상 수의계약을 체결한 사항이 확인됨.','주의'],
  ['공유재산','공단 사택(아파트) 운영·관리 부적정','사택 입주자 선정·거주자 관리기준과 사택관리위원회 운영, 주무부서 지도·감독 등이 미흡함.','주의·시정'],
  ['물품','물품관리 전반의 절차 미준수 및 관리·통제 체계 미흡','물품 등록, 전자태그, 수급계획, 장부, 재물조사 및 불용처분 등 물품관리 전반이 미흡함.','시정·통보'],
  ['물품','공무용차량 관리 부적정','차량관리 규정이 마련되지 않았고 차량 이용 및 운행일지 작성이 미흡함.','주의'],
  ['복무','외부 평가 등 참여 시 복무 처리 부적정','외부 평가 참여에 대한 공가·출장 처리와 출장비 지급이 적정하지 않음.','주의'],
  ['민원','민원 처리 기한 미준수','민원 처리 과정에서 법정 또는 내부 처리기한을 준수하지 않은 사례가 확인됨.','주의'],
  ['예산','자금·여유금의 운용 개선','자금과 여유금의 운용방식을 개선할 필요가 있음.','통보']
];

const sdmRows = [
  ['안전','수방자재 점검·관리 부적정','자재 점검 결과와 실제 비축창고의 수방자재 수량이 일치하지 않음.','기관경고·시정'],
  ['안전','풍수해보험 가입·관리 소홀','처분요구사항 일람표에 수록된 사례로 세부내용은 공식 원문 확인이 필요함.','기관경고·시정'],
  ['회계·지출','동행파트너 활동수당 지급 증빙서류 미비','실제 활동일시·내역·서명부 등 객관적인 증명서류 없이 활동수당을 지급함.','기관경고·시정'],
  ['시설관리','중수도 시설 관리 부적정','분기별 수질검사 결과 제출 안내와 미제출자 독려·과태료 부과 등 후속조치가 미흡함.','시정·주의'],
  ['시설관리','빗물이용시설 지도·점검 부적정','물 재이용시설의 지도·점검과 사후조치가 적정하지 않게 처리됨.','기관경고·주의'],
  ['물품','물품관리시스템 등록·관리 소홀','처분요구사항 일람표에 수록된 사례로 세부내용은 공식 원문 확인이 필요함.','시정'],
  ['물품','관급자재 물품검사(수)조서 처리·관리 부적정','처분요구사항 일람표에 수록된 사례로 세부내용은 공식 원문 확인이 필요함.','기관경고'],
  ['일반행정','사무전결처리 규칙 미준수','처분요구사항 일람표에 수록된 사례로 세부내용은 공식 원문 확인이 필요함.','기관경고'],
  ['민원','물 재이용시설 유기한 민원처리 부적정','처분요구사항 일람표에 수록된 사례로 세부내용은 공식 원문 확인이 필요함.','기관경고'],
  ['인사·채용','공무직 채용절차 이행 부적정','채용계획과 달리 재공고·서류심사 절차 등을 처리하는 등 채용절차가 부적정하게 운영됨.','기관경고·훈계·주의'],
  ['회계·지출','회계관계공무원의 관직지정 부적정','처분요구사항 일람표에 수록된 사례로 세부내용은 공식 원문 확인이 필요함.','기관경고'],
  ['업무추진비','부서운영업무추진비 집행 부적정','처분요구사항 일람표에 수록된 사례로 세부내용은 공식 원문 확인이 필요함.','기관경고'],
  ['인허가','굴착행위 종료신고 관련 업무처리 소홀','굴착행위 종료 미신고 건에 대해 원상복구 명령 등 법적 후속조치가 일부 누락됨.','기관경고·시정'],
  ['세입·세출','하수도원인자부담금 부과금액 산정 소홀','건축물 용도별 오수발생량과 적용면적을 잘못 적용하여 환수·환급이 발생함.','시정·주의'],
  ['물품','하수기동반 차량 관리(정비)대장 미작성','처분요구사항 일람표에 수록된 사례로 세부내용은 공식 원문 확인이 필요함.','기관경고'],
  ['공사·용역','건설폐기물 처리 변경계획 절차 소홀','처분요구사항 일람표에 수록된 사례로 세부내용은 공식 원문 확인이 필요함.','기관경고'],
  ['회계·지출','동일 회계연도 내 지출금 반납처리 부적정','처분요구사항 일람표에 수록된 사례로 세부내용은 공식 원문 확인이 필요함.','기관경고'],
  ['예산','예산의 목적 외 사용 및 집행 부적정','처분요구사항 일람표에 수록된 사례로 세부내용은 공식 원문 확인이 필요함.','주의'],
  ['예산','회계연도 독립의 원칙 미준수','처분요구사항 일람표에 수록된 사례로 세부내용은 공식 원문 확인이 필요함.','기관경고'],
  ['수당','비상근무 시 수당 중복 지급','비상근무 수당이 중복 지급되어 시정과 환수 조치가 요구됨.','시정'],
  ['복무','육아시간 사용 부적정','처분요구사항 일람표에 수록된 사례로 세부내용은 공식 원문 확인이 필요함.','시정'],
  ['복무','건강검진 공가사용 부적정','건강검진 종류별 허용시간을 정확히 확인하지 않고 기준을 초과하여 공가를 사용함.','시정'],
  ['복무','대체휴무 사용 부적정','명확한 증빙과 사전 허가 없이 대체휴무를 사용하여 부여일수보다 과다 사용한 사례가 확인됨.','기관경고·시정'],
  ['복무','특별휴가(포상휴가) 사용 부적정','명확한 증빙 또는 관련부서 승인 없이 특별휴가를 사용한 사례가 확인됨.','기관경고'],
  ['지방세','지하수 개발·이용 등록면허세 부과 소홀','처분요구사항 일람표에 수록된 사례로 세부내용은 공식 원문 확인이 필요함.','시정'],
  ['인허가','지하수 개발·이용 허가 관련 업무 소홀','처분요구사항 일람표에 수록된 사례로 세부내용은 공식 원문 확인이 필요함.','기관경고'],
  ['인허가','지하수 개발·이용 종료신고 절차 준수 소홀','처분요구사항 일람표에 수록된 사례로 세부내용은 공식 원문 확인이 필요함.','시정'],
  ['시설관리','지하수 유량계 정비 소홀','처분요구사항 일람표에 수록된 사례로 세부내용은 공식 원문 확인이 필요함.','시정'],
  ['안전','민방위 비상급수시설 관리 소홀','처분요구사항 일람표에 수록된 사례로 세부내용은 공식 원문 확인이 필요함.','기관경고'],
  ['안전','전기안전점검 계획 미수립 및 점검 미이행','하천 기전시설물의 전기안전 점검계획과 일부 점검항목이 누락됨.','기관경고·시정'],
  ['시설관리','전기설비 계측장비 교정 미이행','계측장비의 정기 교정관리를 제때 실시하지 않음.','시정'],
  ['공사·용역','순환골재 의무사용 등 미준수','처분요구사항 일람표에 수록된 사례로 세부내용은 공식 원문 확인이 필요함.','기관경고·시정'],
  ['공사·용역','건설공사 설계용역평가 등 미실시','처분요구사항 일람표에 수록된 사례로 세부내용은 공식 원문 확인이 필요함.','기관경고'],
  ['공사·용역','시공단계 건설사업관리계획 미수립','처분요구사항 일람표에 수록된 사례로 세부내용은 공식 원문 확인이 필요함.','기관경고·시정']
];

function makeCases(baseKey, rows) {
  return rows.map((row, index) => ({
    id: `${baseKey}-${String(index + 1).padStart(2, '0')}`,
    ...CASE_BASES[baseKey], category: row[0], title: row[1], summary: row[2],
    disposition: row[3], legal_basis: null,
    review_status: row[2].includes('원문 확인') ? '원문 확인 필요' : '공개문 요약 확인',
    keywords: `${row[0]} ${row[1]} ${row[2]} ${row[3]}`
  }));
}

const CASES = [...makeCases('bai', baiRows), ...makeCases('seoul', seoulRows), ...makeCases('sdm', sdmRows)];

const BUILTIN_SYNONYMS = {
  '계약':['수의계약','분할계약','1인 견적','입찰','낙찰','계약심사','예정가격','설계변경','준공검사','검수','하자검사','하자보수','계약보증','이행보증','변경계약','용역계약'],
  '보조금':['지방보조금','보조사업','보조금 정산','보조금 목적 외 사용','보조사업 자부담','보조사업자','보조금 반환','보조금 환수'],
  '출장':['공무출장','여비','출장비','외부 평가','복무'],
  '복무':['출장','공가','휴가','육아시간','대체휴무','특별휴가','겸직','외부강의','비상근무'],
  '채용':['공정채용','공무직','기간제','서류심사','면접위원','응시자격','채용절차'],
  '공유재산':['사택','사용허가','대부','변상금','무단점유','사용료','관리위탁'],
  '민간위탁':['위탁금','수탁기관','재계약','지도감독','성과평가','민간위탁 정산','위탁금 정산'],
  '공사':['건설공사','공사감독','설계용역','건설사업관리','순환골재','준공','하자','폐기물'],
  '물품':['관급자재','재물조사','전자태그','차량','불용물품','검수','비축물품'],
  '예산':['회계연도','목적 외 사용','지출','회계','재정','자금','여유금'],
  '민원':['유기한 민원','처리기한','접수','등록','국민신문고']
};

const state = { query:'', tab:'cases', sources:[], synonyms:BUILTIN_SYNONYMS };
const GENERIC_EXPANSIONS = new Set(['정산','반환','환수','하자','검사','관리','수당','재정','규정','재량','자부담','목적 외 사용','인사','지도·감독','지도감독']);
const $ = (id) => document.getElementById(id);

function escapeHtml(value='') { return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function normalize(value='') { return String(value).toLowerCase().replace(/\s+/g,' ').trim(); }
function termsFor(query) {
  const q = normalize(query); if (!q) return [];
  const found = new Set([q]);
  Object.entries(state.synonyms).forEach(([key, values]) => {
    const normalizedKey = normalize(key);
    const all = [key, ...(values || [])].map(normalize);
    if (normalizedKey.includes(q) || q.includes(normalizedKey) || all.includes(q)) all.forEach(term => found.add(term));
  });
  return [...found].filter(Boolean);
}
function scoreText(item, query) {
  const q = normalize(query); if (!q) return 1;
  const terms = termsFor(q); let score = 0;
  const fields = [
    [item.title,14],[item.summary,8],[item.category,7],[item.keywords,5],
    [item.audit_name,4],[item.audit_org,3],[item.target_org,3],[item.disposition,2]
  ];
  fields.forEach(([value, weight]) => {
    const text = normalize(value);
    if (text.includes(q)) score += weight * 3;
    terms.slice(1).forEach(term => { if (text.includes(term)) score += weight; });
  });
  return score;
}
function highlight(text, query) {
  const safe = escapeHtml(text); const terms = termsFor(query).sort((a,b)=>b.length-a.length).slice(0,18);
  if (!terms.length) return safe;
  const re = new RegExp(`(${terms.map(t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')})`, 'gi');
  return safe.replace(re,'<mark>$1</mark>');
}
function uniq(values) { return [...new Set(values.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'ko')); }
function fillSelect(id, values, label) {
  const el = $(id); const selected = el.value;
  el.innerHTML = `<option value="">${label}</option>` + values.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  el.value = selected;
}
function setupFilters() {
  fillSelect('categoryFilter', uniq(CASES.map(x=>x.category)), '전체 분야');
  fillSelect('orgFilter', uniq(CASES.map(x=>x.audit_org)), '전체 기관');
  fillSelect('yearFilter', uniq(CASES.map(x=>String(x.audit_year))).reverse(), '전체 연도');
  fillSelect('dispositionFilter', ['기관경고','징계','변상판정','시정','주의','통보','훈계'], '전체 처분');
}
function visibleCases() {
  const category=$('categoryFilter').value, org=$('orgFilter').value, year=$('yearFilter').value, disp=$('dispositionFilter').value;
  let rows=CASES.map(x=>({...x,_score:scoreText(x,state.query)})).filter(x=>
    x._score>0 && (!category||x.category===category) && (!org||x.audit_org===org) && (!year||String(x.audit_year)===year) && (!disp||x.disposition.includes(disp))
  );
  const sort=$('sortSelect').value;
  rows.sort(sort==='latest'?(a,b)=>b.published_at.localeCompare(a.published_at):sort==='category'?(a,b)=>a.category.localeCompare(b.category,'ko')||b.published_at.localeCompare(a.published_at):(a,b)=>b._score-a._score||b.published_at.localeCompare(a.published_at));
  return rows;
}
function renderCases() {
  const rows=visibleCases(); $('caseTabCount').textContent=CASES.length;
  $('resultSummary').textContent=state.query ? `'${state.query}' 관련 ${rows.length}건` : `전체 감사사례 ${rows.length}건`;
  const expanded=termsFor(state.query).slice(1,7); $('expansionNotice').textContent=expanded.length?`함께 찾은 표현: ${expanded.join(', ')}`:'';
  if(!rows.length){$('results').innerHTML='<div class="empty"><strong>현재 수록된 사례에는 검색결과가 없습니다.</strong><p>필터를 초기화하거나 ‘감사자료원’ 탭에서 관련 기관의 공식 공개자료를 찾아보세요.</p></div>';return;}
  $('results').innerHTML=rows.map(x=>`
    <article class="case-card">
      <div class="card-top"><div class="badges"><span class="badge">${escapeHtml(x.category)}</span><span class="badge secondary">${escapeHtml(x.audit_type)}</span><span class="badge review">${escapeHtml(x.review_status)}</span></div><span class="meta">${x.audit_year}</span></div>
      <h3>${highlight(x.title,state.query)}</h3>
      <p class="summary">${highlight(x.summary,state.query)}</p>
      <div class="facts"><div><b>처분내용</b><span>${escapeHtml(x.disposition||'원문 확인')}</span></div><div><b>관련근거</b><span>${escapeHtml(x.legal_basis||'원문에서 확인')}</span></div><div><b>감사기관</b><span>${escapeHtml(x.audit_org)}</span></div><div><b>감사대상</b><span>${escapeHtml(x.target_org)}</span></div></div>
      <div class="card-footer"><span class="meta">${escapeHtml(x.audit_name)} · 게시 ${escapeHtml(x.published_at)}</span><a class="source-link" href="${escapeHtml(x.source_url)}" target="_blank" rel="noopener noreferrer">공식 게시물 보기 <span aria-hidden="true">↗</span></a></div>
    </article>`).join('');
}
function sourceStatus(source) {
  const status=source.collection_readiness||source.status;
  if(status==='ready') return ['수집 준비','badge'];
  if(status==='manual') return ['수동 확인','badge review'];
  return ['재확인 필요','badge review'];
}
function renderSources() {
  const q=normalize(state.query), terms=termsFor(q);
  const rows=state.sources.filter(s=>{
    if(!q) return true;
    const text=normalize([s.audit_org,s.source_group,s.original_category,s.menu_name,s.characteristics,(s.recommended_keywords||[]).join(' ')].join(' '));
    return terms.some(t=>text.includes(t));
  }).sort((a,b)=>(a.learning_priority_order??999)-(b.learning_priority_order??999)||a.audit_org.localeCompare(b.audit_org,'ko'));
  $('sourceTabCount').textContent=state.sources.length;
  if(!rows.length){$('sourceResults').innerHTML='<div class="empty"><strong>해당 자료원이 없습니다.</strong><p>기관명이나 지역명으로 다시 검색해 보세요.</p></div>';return;}
  $('sourceResults').innerHTML=rows.map(s=>{const [label,klass]=sourceStatus(s);return `
    <article class="source-card"><div class="card-top"><span class="${klass}">${label}</span>${s.learning_priority_member?'<span class="badge secondary">연찬 우선</span>':''}</div>
      <h3>${highlight(s.audit_org,state.query)}</h3><p>${escapeHtml(s.source_group)} · ${escapeHtml(s.menu_name||'감사결과 공개')}</p><p>${escapeHtml(s.characteristics||'공식 감사결과 자료원')}</p>
      <div class="source-tags">${(s.recommended_keywords||[]).slice(0,7).map(k=>`<span>${highlight(k,state.query)}</span>`).join('')}</div>
      <a class="source-link" href="${escapeHtml(s.source_url)}" target="_blank" rel="noopener noreferrer">공식 목록페이지 보기 ↗</a></article>`}).join('');
}
function showTab(tab) {
  state.tab=tab;
  document.querySelectorAll('.tab').forEach(btn=>{const active=btn.dataset.tab===tab;btn.classList.toggle('is-active',active);btn.setAttribute('aria-selected',String(active));});
  $('caseView').hidden=tab!=='cases'; $('sourceView').hidden=tab!=='sources'; $('guideView').hidden=tab!=='guide';
  if(tab==='sources')renderSources(); if(tab==='cases')renderCases();
}
function runSearch(value) { state.query=value.trim(); $('searchInput').value=state.query; state.tab==='sources'?renderSources():renderCases(); }
function resetAll(){ state.query=''; $('searchInput').value=''; ['categoryFilter','orgFilter','yearFilter','dispositionFilter'].forEach(id=>$(id).value='');$('sortSelect').value='relevance';renderCases();renderSources(); }

async function loadData(){
  try{
    const [sourcesRes,synonymsRes]=await Promise.all([fetch('data/sources.json'),fetch('data/synonyms.json')]);
    if(!sourcesRes.ok||!synonymsRes.ok)throw new Error('data load failed');
    const sourceData=await sourcesRes.json(), synonymData=await synonymsRes.json();
    state.sources=sourceData.sources||[];
    Object.entries(synonymData.categories||{}).forEach(([category,value])=>{
      state.synonyms[category]=uniq([...(value.strong||[]),...(value.related||[]),...(value.seed_terms||[])]).filter(term=>!GENERIC_EXPANSIONS.has(normalize(term)));
    });
  }catch(error){
    state.sources=[];
    $('sourceResults').innerHTML='<div class="empty"><strong>자료원 데이터를 불러오지 못했습니다.</strong><p>잠시 후 화면을 새로고침해 주세요.</p></div>';
  }
  $('sourceTabCount').textContent=state.sources.length; renderCases();
}

$('searchForm').addEventListener('submit',e=>{e.preventDefault();runSearch($('searchInput').value);});
$('searchInput').addEventListener('input',e=>{if(!e.target.value.trim())runSearch('');});
document.querySelectorAll('[data-query]').forEach(btn=>btn.addEventListener('click',()=>{showTab('cases');runSearch(btn.dataset.query);}));
document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>showTab(btn.dataset.tab)));
['categoryFilter','orgFilter','yearFilter','dispositionFilter','sortSelect'].forEach(id=>$(id).addEventListener('change',renderCases));
$('resetBtn').addEventListener('click',resetAll); $('filterReset').addEventListener('click',()=>{['categoryFilter','orgFilter','yearFilter','dispositionFilter'].forEach(id=>$(id).value='');renderCases();});

setupFilters(); loadData();
