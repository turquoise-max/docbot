# 에디터 초기 로딩 지연 및 무한 로딩(타임아웃) 최적화 트러블슈팅

**날짜**: 2026-05-20  
**상태**: 해결됨  
**관련 컴포넌트**: `SyncfusionDocEditor`, `useEditorInit`, `EditorPage`

---

## 1. 이슈 개요

프론트엔드 환경에서 에디터 페이지(`/editor/[id]`) 진입 시 다음과 같은 일련의 성능 및 동작 오류가 발생했습니다.

1. **초기 진입 지연**: 대시보드나 다른 페이지에서 에디터로 넘어갈 때 브라우저 화면이 3~4초가량 완전히 멈추는 현상 발생.
2. **무한 스피너 대기**: 최적화(지연 로딩) 적용 후, 에디터 초기화가 진행되지 않고 "준비 중..." 상태에서 무한히 멈추는 현상 발생.
3. **타임아웃 에러**: 무한 대기 방지 로직(10초) 추가 후, 정상적인 상황에서도 10초 대기 후 "문서를 불러오지 못했습니다"라는 타임아웃 오류 발생.

---

## 2. 단계별 원인 분석 및 해결 과정

### Step 1: 초기 진입 지연 (3~4초 화면 멈춤)
- **원인**: 
  - Syncfusion 에디터 패키지(`@syncfusion/ej2-react-documenteditor`)의 방대한 JavaScript 번들을 **정적으로 임포트(Static Import)** 하고 있어, 페이지 이동 시 거대한 스크립트를 다운로드하고 파싱하는 동안 브라우저 메인 스레드가 블로킹됨.
  - 마운트 직후 라이선스(`registerLicense`)를 검증하기 위한 API 호출을 완료할 때까지 에디터 렌더링이 직렬로 대기함.
- **조치 (실패 포함)**:
  - 에디터 컴포넌트를 `next/dynamic(..., { ssr: false })`로 동적 임포트 처리.
  - 라이선스를 불러오는 동안 어색한 스피너 대신 자연스러운 **에디터 골격(Skeleton UI)**을 렌더링하도록 개선.

### Step 2: 무한 스피너 (초기화 중단)
- **원인**: 
  - 지연 로딩을 적용하면서 컴포넌트 렌더링 시점에 `editorRef.current`가 일시적으로 `null` 상태가 됨.
  - 데이터 로드 등을 관장하는 `useEditorInit.ts` 내부의 `useEffect` 의존성 배열 및 조건문에서 `!editorRef.current`일 경우 초기화를 즉시 중단(return)하도록 설계되어 있어 프로세스 자체가 멈춤.
- **조치**:
  - `useEditorInit` 진입 조건에서 `editorRef` 의존성을 제거하여 데이터 패칭(DB/Storage 로드) 작업은 즉시 시작되도록 개선.
  - 문서 렌더링(rendering) 단계에 도달했을 때만 비동기 폴링(`waitForEditor`)을 통해 `editorRef`가 마운트될 때까지 최대 10초간 대기하도록 수정.

### Step 3: 타임아웃 발생 (ref 전달 불가 및 내부 인스턴스 지연)
- **원인**: 
  1. Next.js의 `next/dynamic`은 기본적으로 하위 컴포넌트에 **React `ref` 객체를 전달(Forwarding)하지 않음**. 따라서 에디터가 화면에 나타났어도 부모 컴포넌트에서 바라보는 `editorRef.current`는 영구적으로 `null` 상태였음.
  2. 스켈레톤 UI가 렌더링되고 있어 `editorRef`가 할당되었더라도, Syncfusion 내부의 실제 `documentEditor` 인스턴스는 아직 준비되지 않았을 수 있음. 이 상태에서 `loadDocument()`를 호출하면 문서 로드가 무시되는 타이밍 이슈 존재.
- **최종 조치**:
  - `next/dynamic`을 제거하고 순수 React 기능인 **`React.lazy`와 `<Suspense>`** 로 교체. (React.lazy는 `forwardRef`와 완벽히 호환됨)
  - `SyncfusionDocEditor.tsx` 인터페이스에 **`isReady()` 메서드**를 추가하여 컨테이너 내부의 인스턴스가 모두 생성되었는지 확인.
  - `useEditorInit`의 폴링 조건 로직을 수정하여 `editorRef.current`가 할당되는 것뿐만 아니라 `editorRef.current.isReady()`가 `true`가 될 때까지 대기하도록 강화.

---

## 3. 최종 결과 및 도입된 주요 코드

- 브라우저 메인 스레드 블로킹 해소로 페이지 이동 시 **즉시 체감되는 반응속도 확보**.
- 라이선스 및 무거운 스크립트를 다운로드하는 동안 **스켈레톤(Skeleton) UI** 노출로 사용자 경험 증대.
- `React.lazy` + `Suspense` 패턴을 통한 안전한 Ref 전달 구조 확립.

```tsx
// 1. React.lazy 및 Suspense 적용 (page.tsx)
const SyncfusionDocEditor = React.lazy(() => import('@/components/editor/SyncfusionDocEditor'))

<Suspense fallback={<SkeletonUI />}>
  <SyncfusionDocEditor ref={editorRef} />
</Suspense>
```

```typescript
// 2. 에디터 준비 상태 검증 및 폴링 대기 (useEditorInit.ts)
const waitForEditor = async () => {
  const maxWait = 10000;
  const start = Date.now();
  
  while (!editorRef.current || (typeof editorRef.current.isReady === 'function' && !editorRef.current.isReady())) {
    if (Date.now() - start > maxWait) {
      throw new Error('Editor mount timeout');
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
};