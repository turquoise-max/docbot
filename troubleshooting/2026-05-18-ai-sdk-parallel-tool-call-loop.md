# 트러블슈팅: Vercel AI SDK 다중 도구 병렬 호출로 인한 무한 루프 버그

**발생 일자**: 2026년 5월 18일

## 1. 이슈 현상
사용자가 초기 프롬프트("기획안", "IT 서비스 사업계획서" 등)를 입력했을 때, 챗봇이 "답변 중입니다..." 상태를 무한히 유지하며 UI가 멈추는 현상이 발생했다. 
서버 터미널 로그를 확인해본 결과, AI가 `askClarification` 도구를 한 턴에 3~4번씩 중복(병렬)으로 계속해서 반환하고 있었다.

## 2. 원인 분석

이번 무한 루프 버그는 **서버(LLM) 측의 병렬 도구 호출 성향**과 **클라이언트(UI) 측의 상태 판별 오류**라는 두 가지 치명적인 문제가 겹쳐서 발생했다.

### 2.1 서버/LLM 측 원인: Parallel Tool Calling
- 최신 LLM(Gemini 1.5, GPT-4o 등)은 여러 개의 질문(목적, 대상, 톤앤매너 등)이 필요할 때, 이를 1개의 도구 안에 묶어서 보내는 대신 스스로 판단하여 **도구를 병렬로 여러 번(Parallel Tool Calling) 호출**하는 성향이 강하다.
- 이 과정에서 초기에는 대화 내역에 `askClarification` 이력이 있으면 도구 목록에서 아예 삭제(`hasAskedClarification`)하는 로직을 썼는데, 이로 인해 이전 턴에서 이미 호출된 도구를 AI가 다시 호출하려다 `unavailable tool` 에러가 발생하는 부작용이 있었다.

### 2.2 클라이언트(UI) 측 원인: `sendAutomaticallyWhen` 로직의 한계
- `ChatPanel.tsx`에서 클라이언트 사이드 도구의 결과(output/result)가 제출되지 않으면 자동 전송(체인 재개)을 막아야 한다.
- 기존 로직은 `part.state` (예: `call`, `partial-call` 등) 값을 기준으로 대기 상태를 판별했다. 
- 하지만 병렬 호출된 여러 도구 중 일부가 AI SDK 버전 차이 등으로 인해 `state` 값이 기대와 다르게 파싱되면서, 클라이언트는 "대기 중인 도구가 없다"고 착각하게 되었다.
- 결과적으로 사용자가 버튼을 클릭하기도 전에 빈 메시지를 서버로 자동 전송(`sendAutomaticallyWhen` 반환값이 `true`가 됨)해버렸고, 이를 받은 서버는 다시 AI에게 생성을 요청하며 무한 병렬 질문 루프에 빠진 것이다.

## 3. 해결 방법

### 3.1 서버 구조적 차단: `experimental_parallelToolCalls: false`
시스템 프롬프트만으로는 최신 LLM의 병렬 호출을 완벽히 제어하기 어려웠다. 따라서 `route.ts`의 `streamText` 옵션에 병렬 도구 호출을 비활성화하는 코드를 명시적으로 추가했다.
```typescript
const result = streamText({
  model: ...,
  system: systemPrompt,
  messages: modelMessages,
  tools: { ... },
  maxSteps: 4,
  maxRetries: 0,
  // AI가 1개 턴에 2개 이상의 도구를 동시에 부르는 것을 원천 차단
  experimental_parallelToolCalls: false, 
})
```

### 3.2 시스템 프롬프트(System Prompt) 고도화
물리적 도구 차단(`hasAskedClarification`) 로직을 제거하여 `unavailable tool` 에러를 방지하고, 대신 AI의 추론 능력을 강제하는 프롬프트를 추가했다.
- 다중 질문 시 무조건 1개의 `askClarification` 도구 내 `questions` 배열에 묶어 보낼 것
- 과거 대화 내역에 이미 질문을 던진 이력이 있다면 절대 다시 `askClarification`을 호출하지 말고 스스로 논리적 추론을 통해 즉시 기획 단계(`planDocument`)로 넘어갈 것

### 3.3 클라이언트 방어 로직 강화: 상태(`state`) 의존성 탈피
`ChatPanel.tsx`에서 도구가 대기 중인지 판단하는 로직을 더 직관적이고 보수적으로 변경했다.
```typescript
const hasPendingClientTool = lastMessage.parts?.some((part: any) => {
  if (!part.type.startsWith('tool-')) return false;
  
  const toolName = part.toolInvocation?.toolName || part.toolName || part.type.replace('tool-', '');
  if (!CLIENT_SIDE_TOOLS.includes(toolName)) return false;

  const toolInvocation = part.toolInvocation || part;
  // state(call 등)를 무시하고 오직 output/result의 존재 여부만 검사
  const hasOutput = ('output' in toolInvocation) || ('result' in toolInvocation) || !!toolInvocation.output || !!toolInvocation.result;
  
  // 클라이언트 툴인데 결과가 없다면 "무조건" 대기 중
  return !hasOutput;
});

// 대기 중인 툴이 없을 때만 서버로 턴을 자동 전송
return !hasPendingClientTool;
```

## 4. 교훈 및 결론
- 최신 AI 에이전트를 설계할 때는 모델이 프롬프트 지시사항을 무시하고 최적화(병렬 처리 등)를 시도할 수 있음을 항상 가정해야 한다.
- 프롬프트 엔지니어링에만 의존하지 말고, **AI SDK 설정(병렬 호출 차단)**과 **UI의 방어적 상태 검증 로직**을 양면으로 적용해야 무한 루프 같은 치명적인 버그를 예방할 수 있다.