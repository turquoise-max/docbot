# 에디터 텍스트 드래그 시 과도한 API 호출 문제 해결

## 🚨 문제 현상
에디터 내에서 텍스트를 드래그하여 영역을 선택할 때, 터미널(서버 로그)에 다음과 같이 `/api/chat` 경로로의 POST 요청이 글자 수만큼 무수히 발생하는 현상이 발견되었습니다.

```text
POST /api/chat 200 in 68ms
POST /api/chat 200 in 84ms
POST /api/chat 200 in 74ms
... (선택한 글자 수만큼 반복)
```

## 🔍 원인 분석
문제가 발생한 곳은 `src/components/chat/ChatPanel.tsx` 컴포넌트 내의 **클라이언트 오케스트레이션 및 자동 강제 동기화 (Auto-Save)**를 담당하는 `useEffect` 훅이었습니다.

해당 `useEffect`는 AI 스트리밍이 끝나고 화면 상태가 안정화되었을 때 DB에 대화 내용을 동기화(`isSyncOnly: true`)하고 다음 단계를 트리거하는 역할을 합니다. 그런데 이 훅의 의존성 배열(dependency array)에 텍스트 선택 관련 상태들(`selectedHtml`, `selectedText`, `truncatedContext`)이 포함되어 있었습니다.

에디터에서 텍스트를 드래그하면 커서가 이동하며 한 글자가 선택될 때마다 `selectedText`와 `selectedHtml` 상태가 실시간으로 업데이트됩니다. 상태가 변경되니 `useEffect`가 재실행되고, 내부 조건(스트리밍 종료 상태 & 마지막 메시지가 assistant)에 부합하여 계속해서 `fetch('/api/chat', ...)`를 호출하게 된 것입니다.

## 💡 해결 방안
텍스트 선택 상태가 변경되더라도 해당 `useEffect`가 불필요하게 다시 실행되지 않도록 최적화해야 합니다. 단, 서버로 데이터를 보낼 때(`append` 호출 시)는 항상 최신 선택 영역 데이터를 포함해야 하므로 **클로저(Closure) 문제**를 주의해야 합니다.

1. **`useRef`를 통한 최신 상태 저장**:
   `selectedHtml`, `selectedText`, `truncatedContext` 상태를 담을 `useRef`를 생성하고, 별도의 `useEffect`를 통해 렌더링될 때마다 이 ref 값들을 최신 상태로 동기화합니다.

2. **의존성 배열에서 제거 및 `ref.current` 참조**:
   오케스트레이션 `useEffect`의 의존성 배열에서 해당 상태들을 제거하여 불필요한 재실행을 차단합니다. 그리고 훅 내부에서 `append` 함수를 호출할 때 변수 대신 `ref.current`를 참조하도록 수정하여 항상 최신 텍스트 선택 상태가 서버로 전달되도록 보장합니다.

## 📝 코드 변경 사항 (src/components/chat/ChatPanel.tsx)

```tsx
// 1. 상태를 담을 ref 생성 및 동기화
const selectedHtmlRef = useRef(selectedHtml);
const selectedTextRef = useRef(selectedText);
const truncatedContextRef = useRef(truncatedContext);

useEffect(() => {
  selectedHtmlRef.current = selectedHtml;
  selectedTextRef.current = selectedText;
  truncatedContextRef.current = truncatedContext;
}, [selectedHtml, selectedText, truncatedContext]);

// 2. 오케스트레이션 useEffect 의존성 수정 및 ref 참조
useEffect(() => {
  // ... 생략 ...
  
  if (planPart && !hasWriteDocument) {
    // ...
    append(
      { role: 'user', parts: [{ type: 'text', text: '[SYSTEM_AUTO_TRIGGER: writeDocument] ...' }] }, 
      {
        body: {
          documentId,
          selectedHtml: selectedHtmlRef.current, // ref 참조
          selectedText: selectedTextRef.current, // ref 참조
          editorContext: truncatedContextRef.current, // ref 참조
          isNewDocument
        }
      }
    );
  }
  
  // ... 생략 ...
// 의존성 배열에서 selectedHtml, selectedText, truncatedContext 제거
}, [isStreaming, messages, append, documentId, isNewDocument, editorRef]);