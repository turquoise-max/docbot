# Syncfusion 에디터 테이블(표) 렌더링 깨짐 문제 해결

## 1. 문제 현상
- AI가 `writeDocument` 도구를 사용해 생성한 HTML 구조 중 `<table>` 태그가 Syncfusion Document Editor에 주입될 때 정상적으로 렌더링되지 않고 깨지는 현상 발생.
- Syncfusion은 내부적으로 HTML 대신 SFDT(Syncfusion Document Text)라는 자체 JSON 포맷을 사용하며, 클라이언트 또는 서버의 단순 HTML-to-SFDT 변환 로직이 복잡한 표 구조를 완벽하게 지원하지 못함.

## 2. 시도한 방법 (실패)

### 시도 1: Cheerio를 이용한 SFDT 수동 파싱 및 Placeholder 교체
- **접근:** HTML 내의 `<table>` 태그를 `___TABLE_PLACEHOLDER_0_UUID___`와 같은 특수 텍스트로 치환한 뒤, HTML을 Syncfusion API로 넘겨 SFDT를 받아오고, 서버 측에서 직접 구축한 SFDT Table JSON 객체로 교체 시도.
- **결과 (실패):** Syncfusion API가 특수 문자 조합(`___`)을 포함한 단락을 파싱 과정에서 완전히 드랍(삭제)하거나 분리하여 반환하면서, 치환할 대상을 찾지 못함.

### 시도 2: 자연어 형태의 Placeholder 패턴 적용
- **접근:** 드랍 현상을 막기 위해 `TABLE PLACEHOLDER 0 UUID END`와 같은 자연어 형태의 문장으로 치환 패턴을 변경.
- **결과 (실패):** 특수 문자 필터링은 우회했으나, Syncfusion이 긴 텍스트를 여러 개의 `inline` 객체로 무작위 분할(split)하여 반환하는 바람에 정확한 JSON 블록 매칭 및 치환 실패.

### 시도 3: 앵커(Anchor) 텍스트 기반 삽입
- **접근:** 표 바로 앞의 형제 요소(`<h3>` 등)의 텍스트를 앵커로 삼고, HTML에서 `<table>`을 완전히 제거한 뒤 변환. 이후 SFDT 블록을 역순으로 순회하며 앵커 텍스트 뒤에 SFDT Table 블록을 삽입.
- **결과 (실패):** 원본 텍스트의 공백이나 특수 문자가 변환 과정에서 미세하게 달라져 앵커 매칭이 실패하는 엣지 케이스 발생. 결과적으로 엉뚱한 위치에 삽입되거나 누락됨.

## 3. 최종 해결 방법 (HTML → DOCX → SFDT 파이프라인)

Syncfusion은 MS Word(`.docx`) 문서를 처리하고 SFDT로 변환하는 데에 가장 강력하게 최적화되어 있습니다. 이를 활용하여 우회 및 치환 방식의 모든 복잡성을 버리고 **단일 파이프라인으로 전면 개편**했습니다.

1. **`html-to-docx` 라이브러리 도입**
   - Node.js 환경에서 HTML을 완벽한 `.docx` 바이너리 버퍼로 변환하는 패키지를 사용.
2. **파이프라인 구축 (`src/app/api/document/convert-html/route.ts`)**
   - AI가 생성한 HTML → `html-to-docx`를 거쳐 `Buffer` 형태의 DOCX 파일 생성.
   - 생성된 DOCX 버퍼를 `Blob`과 `FormData`로 래핑하여 Syncfusion Import API(`.../api/documenteditor/Import`)로 전송.
   - 반환된 SFDT를 클라이언트로 그대로 전달.
3. **빌드 에러 해결**
   - `html-to-docx`가 Node.js 내장 `encoding` 모듈을 찾지 못해 Next.js 빌드 시 발생하는 `Module not found: Can't resolve 'encoding'` 에러를 `npm install encoding`으로 간단히 해결.

## 4. 추가 개선 (시각적 스타일 강제 주입)

단순한 표 렌더링 성공에 그치지 않고, 문서의 톤앤매너와 어울리도록 렌더링 직전 `cheerio`를 통해 인라인 CSS를 강제 주입했습니다. 이로 인해 DOCX 변환기(`html-to-docx`)가 스타일을 완벽하게 인식하고 SFDT에 반영합니다.

- **헤더 행 강제 스타일:** `<th>` 태그에 진한 네이비 배경(`background-color: #1a3a5c`), 흰색 글씨, `font-weight: bold` 주입.
- **여백 축소:** 표가 위아래로 늘어지는 것을 막기 위해 `<th>`, `<td>`에 `padding: 4px 8px` 속성 고정.
- **첫 번째 열 강조:** 데이터 구분을 명확히 하기 위해 각 `<tr>`의 첫 번째 `<td>` 셀에 굵은 글씨와 연한 회청색 배경(`background-color: #f4f6f8`) 적용.

## 5. 결론
파편화된 문자열 치환이나 불완전한 HTML 파서를 억지로 사용하는 대신, **"에디터(Syncfusion)가 가장 잘 이해하는 포맷(DOCX)으로 변환한 뒤 전달한다"**는 본질적인 접근을 통해 안정성과 시각적 퀄리티를 동시에 확보했습니다.