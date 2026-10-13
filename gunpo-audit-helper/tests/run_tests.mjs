// 감사사례 연찬 도우미 — 자동시험 (데이터·검색·보안)
// 실행: node tests/run_tests.mjs        (결과: tests/results/unit_report.md)
// 데이터나 유의어를 바꿀 때마다 실행하세요. 하나라도 실패하면 종료코드 1.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const S = require(path.join(DIST, 'js', 'search.js'));
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

const casesData = readJson(path.join(DIST, 'data', 'audit_cases.json'));
const sourcesData = readJson(path.join(DIST, 'data', 'sources.json'));
const synData = readJson(path.join(DIST, 'data', 'synonyms.json'));
// 관리용 원본(admin/)은 공개 저장소에 올리지 않을 수 있으므로, 없으면 관련 시험만 건너뜁니다.
const MASTER_PATH = path.join(ROOT, 'admin', 'cases_master.json');
const HAS_ADMIN = fs.existsSync(MASTER_PATH);
const master = HAS_ADMIN ? readJson(MASTER_PATH).cases : null;
const CASES = casesData.cases;
const SOURCES = sourcesData.sources;
const DICT = S.createDictionary(synData);

const results = [];
function check(group, name, ok, detail = '') {
  results.push({ group, name, ok: !!ok, detail });
}
function adminCheck(group, name, fn, detail = '') {
  if (!HAS_ADMIN) { results.push({ group, name, ok: true, skipped: true, detail: '관리용 원본 없음 — 건너뜀' }); return; }
  check(group, name, fn(), typeof detail === 'function' ? detail() : detail);
}
const ids = (rows) => rows.map((r) => r.item.id);

// ------------------------------------------------------------ 1. 데이터
{
  const G = '데이터';
  const req = ['id', 'audit_org', 'audit_year', 'audit_name', 'title', 'source_url', 'review_status'];
  const missing = CASES.flatMap((c) => req.filter((f) => c[f] == null || c[f] === '').map((f) => `${c.id}.${f}`));
  check(G, '모든 공개 사례에 필수항목(기관·연도·감사명·제목·출처·검토상태) 존재', missing.length === 0, missing.join(', ') || `${CASES.length}건 확인`);
  check(G, '모든 공개 사례의 공식 게시물 주소가 https', CASES.every((c) => /^https:\/\//.test(c.source_url)), '');
  check(G, '사례번호 중복 없음', new Set(CASES.map((c) => c.id)).size === CASES.length, '');
  check(G, '같은 지적사항 중복 없음(content_hash)', new Set(CASES.map((c) => c.content_hash)).size === CASES.length, '');
  check(G, '공개 데이터에는 approved/source_checked 만 포함', CASES.every((c) => ['approved', 'source_checked'].includes(c.review_status)),
    `공개 ${CASES.length}건 / 전체 ${casesData.counts.master_total}건`);
  const leaked = CASES.filter((c) => 'attachment_url' in c || 'reviewed_by' in c || 'review_note' in c);
  check(G, '관리자 전용 항목(첨부주소·검토자·검토메모)이 공개 데이터에 없음', leaked.length === 0, ids(leaked.map((item) => ({ item }))).join(','));
  check(G, '원문 없는 안내문구("원문 확인이 필요함")가 요약으로 들어가 있지 않음', CASES.every((c) => !String(c.summary || '').includes('원문 확인이 필요함')), '');
  adminCheck(G, '기존 시범판 57건 보존본이 그대로 있고 모두 관리용 원본에 연결됨', () => {
    const legacy = readJson(path.join(ROOT, 'admin', 'legacy', 'v0_cases.json'));
    let n = 0, missing = [];
    for (const [k, rows] of Object.entries(legacy.rows)) rows.forEach((r, i) => {
      n++;
      if (!master.some((c) => c.legacy_ref === `v0:${k}:${i + 1}`)) missing.push(`${k}-${i + 1}`);
    });
    return n === 57 && missing.length === 0;
  }, 'admin/legacy/v0_cases.json ↔ cases_master.json');
  check(G, '원문 대조를 마친 사례에 원문 쪽수·대조일 기록', CASES.filter((c) => c.verified_at).every((c) => c.source_pages && c.source_document),
    `대조 완료 ${CASES.filter((c) => c.verified_at).length}건`);
  check(G, '요약이 없는 사례는 사유를 표시', CASES.every((c) => c.summary || c.summary_unavailable_reason), CASES.filter((c) => !c.summary).map((c) => c.id).join(','));
  const disp = Object.fromEntries(CASES.map((c) => [c.id, c.disposition]));
  check(G, '감사원 처분 정정 반영(원문 조치할 사항 기준)',
    disp['bai-01'] === '통보·주의' && disp['bai-03'] === '주의' && disp['bai-04'] === '통보·주의' && disp['bai-05'] === '주의' && disp['bai-06'] === '시정·통보·주의' && disp['bai-10'] === '통보·주의',
    ['bai-01', 'bai-03', 'bai-04', 'bai-05', 'bai-06', 'bai-10'].map((k) => `${k}:${disp[k]}`).join(' '));
  check(G, '서대문구 처분 34건 = 처분요구사항 일람표', (() => {
    const t = { 1: '기관경고·시정', 2: '기관경고·시정', 3: '기관경고·시정', 4: '시정·주의', 5: '기관경고·주의', 6: '시정', 7: '기관경고', 8: '기관경고', 9: '기관경고', 10: '기관경고·훈계·주의', 11: '기관경고', 12: '기관경고', 13: '기관경고·시정', 14: '시정·주의', 15: '기관경고', 16: '기관경고', 17: '기관경고', 18: '주의', 19: '기관경고', 20: '시정', 21: '시정', 22: '시정', 23: '기관경고·시정', 24: '기관경고', 25: '시정', 26: '기관경고', 27: '시정', 28: '시정', 29: '기관경고', 30: '기관경고·시정', 31: '시정', 32: '기관경고·시정', 33: '기관경고', 34: '기관경고·시정' };
    return Object.entries(t).every(([n, d]) => disp[`sdm-${String(n).padStart(2, '0')}`] === d);
  })(), '서대문구 감사보고서 25~26쪽');
  check(G, '감사자료원 76개', SOURCES.length === 76, `${SOURCES.length}개`);
  check(G, '연찬 우선기관 24곳 표시', SOURCES.filter((s) => s.learning_priority_member).length === 24, '');
  check(G, '자료원 URL·기관명 중복 없음', new Set(SOURCES.map((s) => s.source_url)).size === 76 && new Set(SOURCES.map((s) => s.audit_org)).size === 76, '');
  check(G, '모든 자료원에 수집준비도와 근거가 있음', SOURCES.every((s) => s.collection_readiness && s.collection_readiness_basis), JSON.stringify(sourcesData.counts.by_readiness));
  const blocked = new Set(synData.blocked_generic_terms.map(S.compact));
  const leakedGeneric = Object.entries(synData.groups).flatMap(([k, g]) => g.terms.filter((t) => blocked.has(S.compact(t))).map((t) => `${k}:${t}`));
  check(G, '유의어 사전에 일반어(관리·검사·정산·환수·하자 등) 단독 확장 없음', leakedGeneric.length === 0, leakedGeneric.join(', '));
}

// ------------------------------------------------------------ 2. 검색 (인계서 9.1 필수 검색시험)
{
  const G = '검색';
  const run = (q, opts) => S.searchCases(CASES, q, DICT, opts);

  // 계약
  let r = run('계약');
  const must = ['seoul-04', 'bai-04', 'seoul-03', 'bai-05']; // 변경계약·이행보증·용역계약·검수
  check(G, '계약: 변경계약·이행보증·용역계약·검수 사례 포함', must.every((id) => ids(r.rows).includes(id)), `${r.rows.length}건: ${ids(r.rows).join(' ')}`);
  check(G, '계약: 직접 일치가 유의어 일치보다 위', (() => {
    const firstSyn = r.rows.findIndex((x) => !x.direct.length);
    const lastDirect = r.rows.map((x) => x.direct.length > 0).lastIndexOf(true);
    return firstSyn === -1 || lastDirect < firstSyn;
  })(), '');
  check(G, '계약: 유의어 확장 목록에 수의계약·분할계약·1인 견적·입찰·계약심사·예정가격·설계변경·준공검사·계약보증·변경계약·용역계약 포함',
    ['수의계약', '분할계약', '1인 견적', '입찰', '계약심사', '예정가격', '설계변경', '준공검사', '계약보증', '변경계약', '용역계약'].every((t) => r.parsed.tokens[0].synonyms.includes(t)), '');
  check(G, "계약: '하자' 단독 확장으로 무관 사례(관광농원 하자 치유) 미포함", !ids(r.rows).includes('bai-12'), '');

  // 보조금
  r = run('보조금');
  check(G, '보조금: 지방보조금 교부·정산 사례 포함', ids(r.rows).includes('bai-06'), `${r.rows.length}건: ${ids(r.rows).join(' ')}`);
  adminCheck(G, '보조금: 일반 예산 목적 외 사용(sdm-18) 혼입 없음', () => {
    const rm = S.searchCases(master.map((c) => ({ ...c, disposition_types: String(c.disposition).split('·') })), '보조금', DICT);
    return !ids(rm.rows).includes('sdm-18');
  }, '검토대기 포함 전체 원본 기준');

  // 출장
  r = run('출장');
  check(G, '출장: 외부평가 복무처리(출장비) 사례 포함', ids(r.rows).includes('seoul-08'), `${r.rows.length}건: ${ids(r.rows).join(' ')}`);
  check(G, '출장: 복무 사례 전체가 과다표시되지 않음(3건 이하)', r.rows.length <= 3, '');
  check(G, "출장: 띄어쓰기 경계 오검색('미흡하여 비주거용'→여비) 없음", !ids(r.rows).includes('bai-02'), '');

  // 민간위탁
  r = run('민간위탁');
  check(G, '민간위탁: 실제 사례가 없으므로 0건(억지 결과 없음)', r.rows.length === 0, `${r.rows.length}건`);

  // 채용
  r = run('채용');
  check(G, '채용: 공무직 채용절차 사례 포함', ids(r.rows).includes('sdm-10'), `${r.rows.length}건: ${ids(r.rows).join(' ')}`);
  check(G, '채용: 승진·징계 사례 혼입 없음', !ids(r.rows).includes('bai-08') && !ids(r.rows).includes('bai-09'), '');

  // 공유재산
  r = run('공유재산');
  check(G, '공유재산: 공단 사택 관리 사례 포함', ids(r.rows).includes('seoul-05'), `${r.rows.length}건: ${ids(r.rows).join(' ')}`);
  check(G, '공유재산: 일반 시설관리 사례 혼입 없음', !r.rows.some((x) => x.item.category === '시설관리'), '');

  // 기타
  check(G, '무관한 검색어(우주선)는 0건', run('우주선').rows.length === 0, '');
  check(G, '여러 단어는 모두 일치해야 표시(계약 보증 → 이행보증 1건)', ids(run('계약 보증').rows).join() === 'bai-04', ids(run('계약 보증').rows).join());
  check(G, '4글자 이상은 띄어쓰기 무시(외부평가 → 외부 평가)', ids(run('외부평가').rows).includes('seoul-08'), '');
  check(G, "일반어 '정산'은 직접 일치만(보조금 정산 1건)", ids(run('정산').rows).join() === 'bai-06', ids(run('정산').rows).join());
  check(G, '빈 검색어는 전체 표시', run('').rows.length === CASES.length, '');
  check(G, "관련근거는 법령명 검색에만 사용('공유재산'에 물품 사례 sdm-06·07 미포함)", !ids(run('공유재산').rows).some((id) => ['sdm-06', 'sdm-07', 'seoul-06'].includes(id)), ids(run('공유재산').rows).join(' '));
  check(G, "법령명 검색('지하수법' → 지하수 사례 3건)", ids(run('지하수법').rows).join() === 'sdm-13,sdm-26,sdm-27', ids(run('지하수법').rows).join());
  check(G, "법령 약칭 검색('지방계약법' → 정식 명칭 인용 사례 포함)", ['seoul-03', 'seoul-04', 'sdm-19'].every((id) => ids(run('지방계약법').rows).includes(id)), ids(run('지방계약법').rows).join(' '));
  check(G, "복무: 회계직 겸직(sdm-11)이 복무 겸직으로 섞이지 않음", !ids(run('복무').rows).includes('sdm-11'), ids(run('복무').rows).join(' '));

  // 필터·정렬
  check(G, '필터: 감사기관(서울특별시 감사위원회) = 10건', run('', { filters: { audit_org: '서울특별시 감사위원회' } }).rows.length === 10, '');
  check(G, '필터: 감사유형(기관정기감사) = 13건', run('', { filters: { audit_type: '기관정기감사' } }).rows.length === 13, '');
  check(G, '필터: 연도 2025 = 13건', run('', { filters: { audit_year: '2025' } }).rows.length === 13, '');
  check(G, "필터: 처분유형 '주의'는 '주의'가 들어간 처분만", run('', { filters: { disposition: '주의' } }).rows.every((x) => x.item.disposition_types.includes('주의')), '');
  check(G, '필터+검색 조합(계약 + 감사원) = 감사원 계약 사례만', run('계약', { filters: { audit_org: '감사원' } }).rows.every((x) => x.item.audit_org === '감사원'), ids(run('계약', { filters: { audit_org: '감사원' } }).rows).join(' '));
  const latest = run('', { sort: 'latest' }).rows.map((x) => x.item.published_at);
  check(G, '정렬: 최신순', latest.every((d, i) => i === 0 || latest[i - 1] >= d), '');
  const cat = run('', { sort: 'category' }).rows.map((x) => x.item.category);
  check(G, '정렬: 업무분야순', cat.every((c, i) => i === 0 || cat[i - 1].localeCompare(c, 'ko') <= 0), '');

  // 자료원
  const sr = S.searchSources(SOURCES, '군포', DICT);
  check(G, "자료원 검색: '군포' → 군포시", sr.rows.length >= 1 && sr.rows[0].item.audit_org === '군포시', sr.rows.map((x) => x.item.audit_org).join(','));
  check(G, '자료원: 연찬 우선기관만 = 24곳', S.searchSources(SOURCES, '', DICT, { filters: { priority_only: true } }).rows.length === 24, '');
  check(G, '자료원 기본정렬: 연찬 우선순위 1위(감사원)가 맨 위', S.searchSources(SOURCES, '', DICT).rows[0].item.audit_org === '감사원', '');

  // 강조표시 안전성
  const seg = S.segments('A&B <x> 계약', ['amp', 'lt', '계약']);
  check(G, '강조표시가 HTML 기호를 깨뜨리지 않음', seg.filter((s) => s.mark).map((s) => s.text).join() === '계약', JSON.stringify(seg));
}

// ------------------------------------------------------------ 3. 보안
{
  const G = '보안';
  const files = [];
  (function walk(d) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) walk(p); else files.push(p);
    }
  })(DIST);
  const code = files.filter((f) => /\.(html|js|css)$/.test(f) && !f.includes(`${path.sep}data${path.sep}`));
  const all = files.filter((f) => /\.(html|js|css|json)$/.test(f));
  const grep = (list, re) => list.filter((f) => re.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(ROOT, f));
  const g1 = grep(code, /type\s*=\s*["']?file|FileReader|showOpenFilePicker|DataTransfer|ondrop/i);
  check(G, '파일 업로드 기능 없음', g1.length === 0, g1.join(', '));
  const g2 = grep(code, /\bdownload\s*=|\.download\s*=|createObjectURL|msSaveBlob/i);
  check(G, '자동 다운로드 기능 없음', g2.length === 0, g2.join(', '));
  const g3 = grep(code, /fetch\(\s*["'`]https?:|XMLHttpRequest|WebSocket|EventSource|sendBeacon|navigator\.sendBeacon/i);
  check(G, '외부 서버로 데이터 전송·호출 없음', g3.length === 0, g3.join(', '));
  const g4 = grep(code, /openai|anthropic|gemini|generativelanguage|claude\.ai|chatgpt|api[_-]?key|bearer\s/i);
  check(G, '외부 AI API 호출 없음', g4.length === 0, g4.join(', '));
  const g5 = grep(all, /(sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|password\s*[:=]|passwd|secret\s*[:=]|token\s*[:=])/i);
  check(G, '비밀번호·토큰·API Key 없음', g5.length === 0, g5.join(', '));
  const g6 = grep(all, /(?<![\d=])\d{6}-[1-4]\d{6}(?!\d)|(?<![\d=])01[016789][-.\s]\d{3,4}[-.\s]\d{4}(?!\d)|[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z.]{2,}/);
  check(G, '개인정보 패턴(주민등록번호·휴대전화·이메일) 없음', g6.length === 0, g6.join(', '));
  const g7 = grep(code.filter((f) => f.endsWith('.html')), /<script[^>]+src=["']https?:|<link[^>]+href=["']https?:/i);
  check(G, '외부 스크립트·글꼴·스타일 로딩 없음(업무망 호환)', g7.length === 0, g7.join(', '));
  const g8 = grep(code, /\beval\(|new Function\(|innerHTML\s*=\s*[^;]*location/i);
  check(G, '위험한 코드 실행(eval 등) 없음', g8.length === 0, g8.join(', '));
  const g9 = grep(code, /localStorage|sessionStorage|document\.cookie|indexedDB/i);
  check(G, '검색어를 브라우저에 저장하지 않음', g9.length === 0, g9.join(', '));
  const leakAdmin = grep(all, /cases_master|review_status\.xlsx|attachment_url/);
  check(G, '관리자용 파일·첨부주소가 직원용 폴더(dist)에 없음', leakAdmin.length === 0, leakAdmin.join(', '));
  check(G, '보안 헤더(CSP) 설정', /Content-Security-Policy/.test(fs.readFileSync(path.join(DIST, 'index.html'), 'utf8')), '');
}

// ------------------------------------------------------------ 결과
const pass = results.filter((r) => r.ok).length;
const fail = results.length - pass;
const lines = [
  '# 자동시험 결과 (데이터·검색·보안)', '',
  `- 실행시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`,
  `- 결과: **${pass} / ${results.length} 통과**${fail ? ` · 실패 ${fail}` : ''}`,
  `- 대상 데이터: 공개 사례 ${CASES.length}건(전체 ${casesData.counts.master_total}건), 자료원 ${SOURCES.length}개, 유의어 그룹 ${Object.keys(synData.groups).length}개`, '',
];
for (const g of ['데이터', '검색', '보안']) {
  lines.push(`## ${g}`, '', '| 결과 | 시험항목 | 비고 |', '|---|---|---|');
  results.filter((r) => r.group === g).forEach((r) => lines.push(`| ${r.skipped ? '건너뜀' : r.ok ? '통과' : '**실패**'} | ${r.name} | ${String(r.detail).replace(/\|/g, '/')} |`));
  lines.push('');
}
fs.mkdirSync(path.join(ROOT, 'tests', 'results'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'tests', 'results', 'unit_report.md'), lines.join('\n'));
results.forEach((r) => console.log(`${r.ok ? 'PASS' : 'FAIL'}  [${r.group}] ${r.name}${r.ok ? '' : '  -> ' + r.detail}`));
console.log(`\n${pass}/${results.length} 통과`);
process.exit(fail ? 1 : 0);
