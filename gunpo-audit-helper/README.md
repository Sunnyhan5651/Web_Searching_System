# 감사사례 연찬 도우미

군포시 직원이 공개된 감사결과를 업무 키워드로 찾아보고, 비슷한 지적사례를 미리 확인하는 정적 검색 화면입니다.
서버·DB가 없습니다. HTML 파일과 데이터 파일만으로 동작합니다.

> 현재 버전: 2.1 (2단계 원문 대조) · 데이터 기준 2026-10-13
> 공개 사례 57건(모두 원문 대조 완료·감사실 승인 전 '출처확인' 상태), 감사자료원 76개

---

## 1. 폴더 구성

```
gunpo-audit-helper/
├─ dist/                      ← 직원용 화면 (이 폴더만 배포합니다)
│  ├─ index.html
│  ├─ css/style.css
│  ├─ js/search.js            검색 규칙 (직접일치·유의어·필터·정렬)
│  ├─ js/app.js               화면 동작
│  └─ data/                   자동 생성 데이터 (직접 고치지 마세요)
│     ├─ audit_cases.json/.js   공개 가능한 감사사례
│     ├─ sources.json/.js       감사자료원 76개
│     └─ synonyms.json/.js      유의어 사전
├─ admin/                     ← 관리자용 (직원에게 배포하지 않음)
│  ├─ cases_master.json        감사사례 원본 (검토상태 포함, 여기서 수정)
│  ├─ synonyms_master.json     유의어 사전 원본 (여기서 수정)
│  ├─ source_data/*.xlsx       전국 감사자료원 엑셀 (공개 저장소에 올리지 않음)
│  ├─ review_status.xlsx       검토상태표 (자동 생성, 감사실 검토용)
│  ├─ build_data.py            원본 → 직원용 데이터 만들기
│  ├─ migrate_legacy.py        기존 시범판 57건 1회 변환 (이미 실행됨)
│  ├─ verify_2026-10-13.py     원문 PDF 대조 결과 반영 기록 (이미 실행됨)
│  └─ legacy/v0_cases.json     기존 시범판 57건 보존본 (수정 금지)
├─ tests/
│  ├─ run_tests.mjs            데이터·검색·보안 자동시험
│  ├─ e2e_browser.py           실제 브라우저 동작시험
│  └─ results/                 시험 결과표와 화면 캡처
├─ .github/workflows/deploy-pages.yml   GitHub Pages 배포
└─ .gitlab-ci.yml                       GitLab Pages 배포
```

## 2. 화면 열어보기

- **가장 간단한 방법:** `dist/index.html` 을 더블클릭합니다. 인터넷이나 서버 없이 열립니다.
- **서버로 열기(배포 전 확인):** `dist` 폴더에서 `python3 -m http.server 8000` 실행 → 브라우저에서 `http://localhost:8000`

정상 화면: 상단에 `감사사례 57건 · 감사자료원 76개`, 추천 키워드 `계약` 클릭 시 `‘계약’ 관련 11건`.

## 3. 검토상태 (인계서 8.3)

| 상태 | 화면 표시 | 직원 화면 공개 | 의미 |
|---|---|---|---|
| `approved` | 검토완료 (검은 배지) | 공개 | 감사실 검토자가 원문과 요약을 확인함 |
| `source_checked` | 출처확인 (점선 배지) | 공개 | 출처·제목은 확인, 법령·세부내용은 미확인 |
| `needs_review` | 검토대기 | **비공개** | 일람표 수준이거나 자동추출 — 추가 검토 필요 |
| `rejected` | 제외 | **비공개** | 출처불명·중복·오분류·비공개자료 |

검토대기·제외 사례는 `build_data.py` 가 직원용 데이터에서 자동으로 뺍니다.

## 4. 사례를 추가·수정하는 절차

1. 공식 감사결과 게시물과 공개문을 확인합니다.
2. `admin/cases_master.json` 에 사례를 추가합니다. 처음에는 `"review_status": "needs_review"` 로 둡니다.
   - 필수: `id`(중복 금지), `audit_org`, `audit_year`, `audit_name`, `title`, `source_url`(https), `review_status`
   - 권장: `target_org`, `audit_type`, `published_at`, `category`, `summary`, `disposition`
   - `legal_basis` 는 **원문에 명시된 법령만** 적습니다. 없으면 `null`.
   - 원문을 대조했다면 `source_document`(보고서명), `source_pages`(인쇄 쪽수), `verified_at`(대조일)을 적습니다.
   - 처분의 금액·대상 등은 `disposition_detail` 에 적습니다.
   - 게시판 목록으로만 연결되는 경우 `"source_url_scope": "board"` 와 `"source_locator"`(찾는 방법)를 적습니다.
3. `python3 admin/build_data.py` 실행 → `admin/review_status.xlsx` 가 새로 만들어집니다.
4. 감사실 검토자가 검토상태표로 원문과 대조한 뒤, 승인한 사례만 `cases_master.json` 에서 `approved` 로 바꾸고 `reviewed_at` 날짜를 적습니다.
5. 다시 `python3 admin/build_data.py` → `node tests/run_tests.mjs` (모두 통과해야 함) → 배포.

`build_data.py` 는 필수항목 누락, 사례번호 중복, 같은 지적사항 중복, https 가 아닌 주소가 있으면 **아무 파일도 바꾸지 않고 멈춥니다.**

## 5. 유의어 고치기

`admin/synonyms_master.json` 을 수정합니다.

- `triggers`: 이 단어를 검색했을 때 확장이 일어납니다 (정확히 같을 때만).
- `terms`: 함께 찾을 표현입니다. 직접 일치보다 낮은 점수로 계산됩니다.
- `blocked_generic_terms`: 관리·검사·정산·환수·하자처럼 범위가 넓은 단어. 어느 그룹에 넣어도 확장되지 않습니다 (직접 검색하면 직접 일치로는 찾습니다).

수정 후 `build_data.py` 와 `run_tests.mjs` 를 다시 실행하세요. 계약·보조금·출장·민간위탁·채용·공유재산 시험이 자동으로 다시 돌아갑니다.

## 6. 검색 규칙 요약

| 대상 | 점수 |
|---|---|
| 지적제목 | 직접 42 / 유의어 14 |
| 요약 | 직접 24 / 유의어 8 |
| 업무분야 | 직접 21 / 유의어 7 |
| 관련근거·감사명 | 직접 12 / 유의어 4 |
| 감사기관·감사대상 | 직접 9 / 유의어 3 |
| 감사유형·처분 | 직접 6 / 유의어 2 |

- 한 항목에서는 직접·유의어 중 높은 점수 하나만 인정합니다.
- 여러 단어를 띄어 쓰면 모든 단어가 일치해야 표시합니다.
- 관련근거(법령)는 검색어가 법령 이름처럼 보일 때만 비교합니다 (예: `지하수법`, `복무규정`). `공유재산`처럼 업무용어로 검색하면 법령명만 같은 다른 분야 사례가 섞이지 않습니다. `지방계약법`·`청탁금지법` 같은 약칭도 정식 명칭으로 찾습니다.
- 4글자 이상 단어는 띄어쓰기를 무시합니다 (`외부평가` = `외부 평가`). 짧은 단어는 띄어쓰기를 지켜 비교합니다.
- 결과가 없으면 "없음"으로 표시하고 비슷하지 않은 사례를 채워 넣지 않습니다.

## 7. 시험

```bash
node tests/run_tests.mjs        # 데이터·검색·보안 62개 항목 → tests/results/unit_report.md
python3 tests/e2e_browser.py    # 브라우저 동작 76개 항목 → tests/results/e2e_report.md (Playwright 필요)
```

## 8. 배포 (스마트정보과 승인 후)

| 방식 | 방법 |
|---|---|
| 기관 내부 웹서버 | `dist` 폴더 내용을 웹서버 문서 폴더에 그대로 복사 |
| GitHub Pages | 저장소 Settings → Pages → Source 를 **GitHub Actions** 로 선택. main 에 올리면 시험 후 자동 배포 |
| GitLab Pages | `.gitlab-ci.yml` 포함해 올림. Runner·외부 이미지 접근이 가능해야 함 |
| 공유폴더·개인 PC | `dist` 폴더를 복사해 `index.html` 더블클릭 |

공개 저장소에 올리기 전 확인: `admin/source_data/`(엑셀)와 감사보고서 원본(PDF·HWP)은 `.gitignore` 로 제외되어 있습니다. GitHub 무료 계정의 Pages 는 저장소가 공개(Public)여야 합니다.

## 9. 지켜야 할 원칙

- 직원 화면에 파일 업로드, 자동 다운로드, 외부 AI 호출, 로그인 기능을 넣지 않습니다. (`run_tests.mjs` 보안 항목이 자동 점검)
- 공개 감사자료만 수록합니다. 개인정보, 진행 중 조사자료, 비공개 감사자료, 계정·비밀번호·API Key 를 저장하지 않습니다.
- 원문에 없는 지적내용·법령·처분을 만들어 넣지 않습니다. 모르면 비워 둡니다.
- 자동수집 프로그램을 만들게 되면 이 저장소의 `dist` 와 분리된 별도 환경에서 운영하고, 결과는 `needs_review` 로만 넣습니다.
