# 거대 컴포넌트(God Component) 분리 및 구조 개선

## 문제 상황 (Problem)

기존 `src/components/chat/ChatPanel.tsx` 파일은 약 700줄에 달하는 거대 컴포넌트(God Component)로 성장했습니다. 단일 파일 내에 다음과 같이 너무 많은 책임이 혼재되어 유지보수와 가독성을 크게 저하시켰습니다.

1. **관심사 혼재 (SRP 위배)**
   - UI 사이드바 리사이징을 위한 DOM 이벤트 리스너 처리
   - 복잡한 AI 메시지 및 커스텀 툴 렌더링 분기 로직
   - 하단 사용자 입력 폼 및 선택 텍스트 배지 표시
   - `[SYSTEM_AUTO_TRIGGER]` 기반의 Multi-step Tool Calling 오케스트레이션 및 상태 관리

2. **주석과 현실 코드의 불일치**
   - 과거 서버 사이드의 `onFinish`를 통한 DB 저장 방식의 주석이 그대로 남아있어, 현재 도입된 클라이언트 주도의 강제 동기화(`isSyncOnly` 플래그) 아키텍처와 맞지 않아 혼란을 초래할 여지가 있었습니다.

## 해결 방법 (Solution)

기존의 비즈니스 흐름을 해치지 않으면서 코드를 논리적인 단위로 조각내어 분리했습니다.

### 1. 관심사 분리 및 컴포넌트/훅 추출

- **리사이징 로직 추출 (`src/components/chat/hooks/useResizable.ts`)**
  - 마우스 `mousemove`, `mouseup` 이벤트를 추적하여 패널 너비를 조절하는 로직을 커스텀 훅으로 분리했습니다.

- **메시지 아이템 컴포넌트 분리 (`src/components/chat/components/ChatMessageItem.tsx`)**
  - AI 응답, Markdown 렌더링, `ReportProgressTool`, `UpdateTableTool` 등 각종 툴의 렌더링 분기 처리를 전담하는 컴포넌트로 분리했습니다. 
  - 이를 통해 메인 파일에서 복잡한 `map` 순회 로직을 제거했습니다.

- **입력 폼 컴포넌트 분리 (`src/components/chat/components/ChatInputForm.tsx`)**
  - 하단 입력창, 텍스트 입력 핸들링, 폼 제출, 선택 영역 배지 UI를 독립된 컴포넌트로 분리했습니다.

### 2. 컨테이너 컴포넌트의 역할 명확화

- `ChatPanel.tsx`는 분리된 컴포넌트들을 조립하고 최상위 상태(`messages`, `input`, `width` 등)와 Vercel AI SDK(`useChat`)를 관리하는 **가벼운 컨테이너 컴포넌트**로 재조립되었습니다.
- 단, `[SYSTEM_AUTO_TRIGGER]`를 통한 다음 도구 강제 실행이나 `isSyncOnly`를 이용한 DB Full Sync 등 **전체적인 비즈니스 오케스트레이션 로직**은 컨테이너에 유지하여, 흐름 추적이 끊기지 않도록 방어했습니다.

### 3. 시대착오적 주석 업데이트

- 과거 구조의 주석을 현재 아키텍처에 맞게 수정하여 미래의 개발 혼란을 방지했습니다.
  - *이전:* `// DB 저장 로직은 서버 사이드(api/chat/route.ts)의 onFinish로 이전됨`
  - *변경:* `// DB Full Sync는 현재 클라이언트에서 isSyncOnly 플래그를 통해 명시적으로 트리거됨`

## 결과 (Outcome)

- **가독성 향상**: 거대 단일 파일이 여러 개의 작은 모듈로 쪼개져 코드를 읽고 이해하기 쉬워졌습니다.
- **유지보수성 증대**: 향후 메시지 UI를 수정하거나 리사이즈 로직을 변경할 때 해당 파일만 수정하면 되도록 관심사가 명확히 분리되었습니다.
- **안정성 유지**: 컴포넌트를 쪼개면서도 AI 상태 동기화 및 트리거 로직은 중앙 집중화하여 오작동을 방지했습니다.