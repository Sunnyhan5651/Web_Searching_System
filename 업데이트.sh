#!/bin/bash
# 감사사례 데이터 업데이트 스크립트
# 사용법: 터미널에서 sh 업데이트.sh

cd "$(dirname "$0")"

echo "1단계: 엑셀 → 데이터 파일 변환 중..."
python3 excel_to_data.py
if [ $? -ne 0 ]; then
  echo "오류: 변환 실패. 엑셀 파일을 확인해주세요."
  exit 1
fi

echo ""
echo "2단계: GitHub에 업로드 중..."
git add -A
git commit -m "데이터 업데이트 $(date '+%Y-%m-%d %H:%M')"
git push

echo ""
echo "완료! 1~2분 후 아래 주소에서 확인하세요:"
echo "https://sunnyhan5651.github.io/Web_Searching_System"
