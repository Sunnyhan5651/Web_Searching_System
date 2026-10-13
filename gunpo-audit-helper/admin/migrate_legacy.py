"""기존 시범판 57건(admin/legacy/v0_cases.json)을 새 관리용 원본(admin/cases_master.json)으로 1회 변환합니다.

- 원문 문장(분야·지적제목·요약·처분)은 한 글자도 바꾸지 않습니다.
- 검토상태는 인계서 8.3 기준으로 다시 매깁니다.
    · 요약이 '원문 확인 필요' 문구뿐인 21건  -> needs_review  (원칙적으로 비공개)
    · 나머지 36건                            -> source_checked (출처·제목 확인, 법령·세부 미검토)
  approved(감사실 승인)는 사람이 직접 검토한 뒤에만 붙입니다.
- 이미 cases_master.json 이 있으면 덮어쓰지 않습니다(--force 로만 덮어씀).

실행:  python3 admin/migrate_legacy.py
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LEGACY = ROOT / "legacy" / "v0_cases.json"
MASTER = ROOT / "cases_master.json"

# 사례별 게시물 링크 정확도 (기존 앱은 서대문구 34건이 게시판 첫 화면으로 연결되었음)
SOURCE_SCOPE = {
    "bai": {"source_url_scope": "post", "source_locator": None},
    "seoul": {"source_url_scope": "post", "source_locator": None},
    "sdm": {
        "source_url_scope": "board",
        "source_locator": "감사결과 게시판에서 '2026년 치수과 종합감사 결과'(게시물번호 312541) 선택",
    },
}
# 관리자용 첨부 주소 (엑셀 '시범수집검증' 시트 기준). 직원 화면 데이터에는 내보내지 않습니다.
ATTACHMENT = {
    "bai": "페이지 내 동적 다운로드(파일명: 공개문_전문.pdf)",
    "seoul": "https://news.seoul.go.kr/gov/files/2026/09/6aa8d539483f06.36566037.pdf",
    "sdm": "https://www.sdm.go.kr/downloadFile.do?path=/board/509&oriFileNm=2026년_치수과_종합감사_감사보고서(공개용).pdf&saveFileNm=763262C0-35BC-0E89-B39E-752C8F4C664E.pdf",
}
PLACEHOLDER = "원문 확인"


def main() -> None:
    if MASTER.exists() and "--force" not in sys.argv:
        print(f"[건너뜀] {MASTER.name} 이 이미 있습니다. 덮어쓰려면 --force 를 붙이세요.")
        return
    legacy = json.loads(LEGACY.read_text(encoding="utf-8"))
    cases = []
    for key, rows in legacy["rows"].items():
        base = legacy["bases"][key]
        for i, (category, title, summary, disposition) in enumerate(rows, start=1):
            is_placeholder = PLACEHOLDER in summary
            cases.append({
                "id": f"{key}-{i:02d}",
                "report_id": f"{key}-{base['published_at']}",
                **base,
                "category": category,
                "subcategory": None,
                "title": title,
                "summary": None if is_placeholder else summary,
                "legal_basis": None,
                "disposition": disposition,
                **SOURCE_SCOPE[key],
                "attachment_url": ATTACHMENT[key],
                "review_status": "needs_review" if is_placeholder else "source_checked",
                "review_note": (
                    "처분요구사항 일람표 수준으로만 입력됨. 원문에서 사실관계·관련법령 확인 필요"
                    if is_placeholder else
                    "기존 시범판에서 공개문 요약 기반으로 작성. 감사실 원문 대조 전"
                ),
                "reviewed_by": None,
                "reviewed_at": None,
                "legacy_ref": f"v0:{key}:{i}",
            })
    data = {
        "schema_version": "2.0",
        "_설명": "감사사례 관리용 원본입니다. 이 파일을 고친 뒤 build_data.py 를 실행하면 직원용 데이터가 다시 만들어집니다.",
        "cases": cases,
    }
    MASTER.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"[완료] {len(cases)}건 -> {MASTER}")


if __name__ == "__main__":
    main()
