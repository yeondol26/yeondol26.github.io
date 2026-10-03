# 한국사 암기 카드 (고등 한국사2 미래엔, Ⅰ단원)

고1 학생용 암기·연습 웹앱. 단일 HTML 페이지로 빌드된다. 사용자는 한국어로 대화한다.

## 명령
- 빌드: `python build.py` → `dist/index.html`(일반 웹), `dist/artifact.html`(Claude 아티팩트용, 문서 뼈대 없음), `docs/index.html`(GitHub Pages용 웹 사본, 커밋함)
- 배포: 웹 버전은 `main`의 `docs/index.html`이 (Pages 게시 폴더: `/docs`) https://yeondol26.github.io 로 공개된다(로그인 불필요). Claude 버전은 `dist/artifact.html`을 아티팩트 https://claude.ai/artifact/GVa58vBEbr2wEz5c92ZNPN 에 다시 게시한다. 두 버전의 공부 기록은 서로 따로다.
- 데이터 검사: `node tests/check_data.js` (내용을 바꾸면 반드시 실행)
- 화면 확인: `python tests/smoke.py` (Playwright 필요, 빌드 후 실행)

## 구조
- `src/data.js` 카드 `CARDS`: [id, 단원, 색, 그룹, 질문, 답, 메모(쪽), 허용답 |구분, 헷갈리는 보기 |구분]
- `src/data2.js` 사료 `SOURCES`, 연표 `EVENTS`, 서술형 `ESSAYS` (형식은 파일 상단 주석)
- `src/app.js` 앱 전체(IIFE, 라이브러리 없음). 상태는 localStorage `ilje-cards-v1`, Claude 아티팩트에서는 `data/users/<id>/progress` 문서에도 저장
- `src/head.html` 제목·글꼴·CSS(라이트/다크 토큰), `src/body.html` 바깥 틀
- 학습 순서(오늘 탭): 카드를 교과서 순서로 20장씩 묶어(`BATCH`, `batches`) 계단식으로 진행한다(`LADDER`: 1일차 1회 → 2일차 1회 → 1일차 2회 → 3일차 1회 → 2일차 2회 → 1일차 3회 …). 날짜와 무관하게 단계를 마치면 다음 단계로. 1회는 외우기+객관식, 2·3회는 주관식, 3회 정답이면 외움. 진행 위치는 상태 `ladder.i`. 경로 탭(`PATH`)도 같은 `LADDER`를 단계별 노드로 보여 주고, 단원 사료·점검은 그 단원의 마지막 카드가 처음 나오는 묶음 뒤에 둔다. 카드를 중간에 끼워 넣으면 묶음 경계가 바뀌므로 새 카드는 뒤에 추가한다.

## 반드시 지킬 것
- 내용은 교과서(미래엔 2022 개정 고등 한국사2) 근거만. 교과서에 없는 사실·연도·월을 추가하지 않는다. 모든 카드·사료·서술형에 쪽수.
- 카드 id는 절대 바꾸거나 재사용하지 않는다(사용자 진행 기록의 키). 새 카드는 새 id로 추가.
- 상태 형식 `v:1`과 기존 필드를 깨지 않는다. 새 필드는 `fresh()`에 기본값을 넣고 `normalize()`가 채우게 한다.
- 연표 `EVENTS`의 월은 교과서에 나온 경우만, 없으면 0.
- 답변·UI 문구는 한국어, 짧고 쉬운 말.
