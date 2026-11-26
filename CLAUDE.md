# 한국사 암기 카드 (고등 한국사2 미래엔)

고1 학생용 암기·연습 웹앱. 단일 HTML 페이지로 빌드된다. 사용자는 한국어로 대화한다.
같은 `src/app.js`로 두 판을 만든다.
- **1학기판** 「일제 강점기 암기 카드」: Ⅰ단원(10~61쪽), 데이터 `src/data.js`·`src/data2.js`, 저장 키 `ilje-cards-v1`
- **2학기판** 「현대사 암기 카드」: Ⅱ·Ⅲ단원(66~119쪽, 134~147쪽 — 120~133쪽은 시험 범위 제외), 데이터 `src/sem2/*.js`(이름순으로 합침), 저장 키 `hyeondae-cards-v1`
판마다 다른 값(단원, 색 이름, 시험일, 저장 키, 기록 파일 이름)은 데이터 쪽 `EDITION`에 두고 `app.js`가 읽는다(없으면 1학기 값).

## 명령
- 빌드: `python build.py` → 1학기 `dist/index.html`·`dist/artifact.html`·`docs/index.html`, 2학기 `dist/sem2/index.html`·`dist/sem2/artifact.html`·`docs/2/index.html` (artifact.html은 문서 뼈대 없음, docs/는 커밋함)
- 배포(Pages 게시 폴더: `main`의 `/docs`, 로그인 불필요):
  - 1학기 웹 https://yeondol26.github.io · Claude 아티팩트 https://claude.ai/artifact/GVa58vBEbr2wEz5c92ZNPN (`dist/artifact.html`)
  - 2학기 웹 https://yeondol26.github.io/2/ · Claude 아티팩트 https://claude.ai/artifact/F2xkGVKU4gr7L9pJAgB9mH (`dist/sem2/artifact.html`)
  - 웹과 Claude 버전, 1학기와 2학기의 공부 기록은 모두 서로 따로다.
- 데이터 검사: `node tests/check_data.js`(1학기), `node tests/check_data.js sem2`(2학기) — 내용을 바꾸면 반드시 실행
- 화면 확인: `python tests/smoke.py`, `python tests/smoke.py sem2` (Playwright 필요, 빌드 후 실행)

## 구조
- `src/data.js` 카드 `CARDS`: [id, 단원, 색, 그룹, 질문, 답, 메모(쪽), 허용답 |구분, 헷갈리는 보기 |구분]
- `src/data2.js` 사료 `SOURCES`, 연표 `EVENTS`, 서술형 `ESSAYS` (형식은 파일 상단 주석)
- `src/sem2/00_config.js` 2학기 `EDITION`과 빈 배열, `10_u1.js`~`70_u7.js` 단원별로 `CARDS.push(...)` 등. 2학기 id는 `h단원-번호`(카드), `s단원-번호`(사료), `e단원-번호`(서술형). 사진 설명·그래프 수치·각주·읽기·탐구 자료까지 카드로 만든다(지엽적 출제 대비).
- `src/app.js` 앱 전체(IIFE, 라이브러리 없음). 상태는 localStorage `ilje-cards-v1`, Claude 아티팩트에서는 `data/users/<id>/progress` 문서에도 저장
- `src/head.html` 제목·글꼴·CSS(라이트/다크 토큰), `src/body.html` 바깥 틀
- 학습 순서(오늘 탭): 카드를 교과서 순서로 20장씩 묶어(`BATCH`, `batches`) 계단식으로 진행한다(`LADDER`: 1일차 1회 → 2일차 1회 → 1일차 2회 → 3일차 1회 → 2일차 2회 → 1일차 3회 …). 날짜와 무관하게 단계를 마치면 다음 단계로. 1회는 외우기+객관식, 2·3회는 주관식, 3회 정답이면 외움. 3회를 끝낸 묶음에서 외움이 아닌 카드는 '마무리'(`leftover()`, `startFinish()`, 주관식 정답이면 외움)로 몇 번이든 다시 푼다. 외움 카드는 학습 순서·마무리 밖(모의고사·연습·점검 등)에서 틀려도 외움을 유지하고 오답 목록(`w`)에만 남는다. 진행 위치는 상태 `ladder.i`. 경로 탭은 같은 `LADDER`를 계단 표로 보여 준다(행 = 차례, 열 = 1회·2회·3회, 위에 지금 단계 카드). 단원 사료·점검 칩은 그 단원의 마지막 카드가 처음 나오는 차례 아래에 둔다(`UNIT_END`). 카드를 중간에 끼워 넣으면 묶음 경계가 바뀌므로 새 카드는 뒤에 추가한다.

## 반드시 지킬 것
- 내용은 교과서(미래엔 2022 개정 고등 한국사2) 근거만. 교과서에 없는 사실·연도·월을 추가하지 않는다. 모든 카드·사료·서술형에 쪽수.
- 카드 id는 절대 바꾸거나 재사용하지 않는다(사용자 진행 기록의 키). 새 카드는 새 id로 추가.
- 상태 형식 `v:1`과 기존 필드를 깨지 않는다. 새 필드는 `fresh()`에 기본값을 넣고 `normalize()`가 채우게 한다.
- 연표 `EVENTS`의 월은 교과서에 나온 경우만, 없으면 0.
- 답변·UI 문구는 한국어, 짧고 쉬운 말.
