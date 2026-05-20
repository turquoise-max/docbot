# Vercel AI SDK v6 다중 단계 도구 호출(Multi-step Tool Calling) 오케스트레이션 트러블슈팅

**일자**: 2026년 5월 20일  
**관련 파일**:
- `src/components/chat/ChatPanel.tsx`
- `src/app/api/chat/route.ts`
- `src/lib/ai/prompts.ts`
- `src/lib/ai/tools/index.ts`

---

## 1. 문제 상황 (Context & Problem)

기존에는 사용자가 문서 생성을 요청하면 `planDocument`(기획) 도구가 실행된 후, 프론트엔드(`ChatPanel.tsx`)의 `useEffect`에서 `[AUTO]`라는 가짜 메시지를 전송하여 강제로 두 번째 도구인 `writeDocument`(초안 작성)를 실행하는 **클라이언트 사이드 오케스트레이션 안티패턴**을 사용하고 있었습니다. 

이는 사용자 화면에 부자연스러운 `[AUTO]` 메시지가 노출되고, 브라우저 탭을 닫으면 파이프라인이 중간에 끊어지는 치명적인 단점이 있었습니다. 이를 해결하기 위해 Vercel AI SDK의 `maxSteps` 기능을 활용하여 **서버 사이드 단일 요청 체이닝**으로 이관하려 했으나, 다음과 같은 문제들이 연쇄적으로 발생했습니다.

1. **LLM의 후속 도구 호출 무시**: Gemini 모델이 `planDocument` 도구를 실행한 후, `writeDocument` 도구를 호출하지 않고 스스로 텍스트만 출력한 채 스트리밍을 종료해버림.
2. **`toolChoice` 강제 실패**: 스트림 종료를 막기 위해 동적으로 `toolChoice: 'required'`를 주입하려 했으나, 조건식이 계속 `false`로 평가되어 실패함.

---

## 2. 문제 원인 분석 (Root Causes)

### A. Vercel AI SDK v6의 도구 응답 규격 변경
- **현상**: 서버로 넘어온 `validMessages` 배열에서 `planDocument` 완료 응답을 찾을 수 없었음.
- **원인**: AI SDK v6에서는 도구 실행 완료 시 `state: 'output-available'` 상태가 되며 결과값이 `result`가 아닌 `output` 필드에 담겨 옴. 기존 필터 로직이 `p.result === undefined`인 경우 미완성 도구로 간주해 잘라내버렸기 때문에, 메인 파이프라인에 도달하기 전에 메시지가 소실됨.

### B. `maxSteps` 내부 루프의 `toolChoice` 고정 한계 (가장 핵심적인 원인)
- **현상**: 필터 로직을 수정하여 도구 응답이 정상적으로 전달되도록 고쳤으나, 여전히 `toolChoice: 'required'`가 발동하지 않음.
- **원인**: Vercel AI SDK의 `streamText`는 API 호출 시점에 전달받은 `toolChoice` 옵션을 `maxSteps` 내부 루프 내내 그대로 유지함. 
  - 1단계 최초 호출 시: `isPlanComplete === false` ➔ `toolChoice: 'auto'`
  - 2단계 루프 진입 시: 내부적으로 도구가 완료되었더라도, **새로운 API 요청이 들어온 것이 아니므로 옵션이 재평가되지 않고 여전히 `'auto'`로 유지됨.**
  - 이로 인해 모델은 텍스트 응답만 하고 자유롭게 탈출(stop)할 수 있었음.

---

## 3. 시도한 접근법들 (Failed Attempts)

1. **프롬프트 강화**: `prompts.ts`와 도구 반환값에 "절대 멈추지 말고 즉시 다음 도구를 호출하라"고 강압적으로 지시 ➔ 모델이 무시하고 텍스트로 응답하며 스트리밍 종료.
2. **서버 사이드 동적 `toolChoice` 주입**: 내부 루프 중간에는 `toolChoice` 파라미터가 갱신되지 않는 AI SDK 구조적 한계로 실패.

---

## 4. 최종 해결책 (Hybrid Approach)

Vercel AI SDK 내부 루프의 제약을 극복하고, UI의 안티패턴을 제거하면서도 새로고침 시 무한 루프를 방지하는 **"투명한 클라이언트 트리거 (Hidden Client Trigger)"** 방식으로 해결했습니다.

### Step 1. 투명 트리거 발송 (`ChatPanel.tsx`)
클라이언트에서 `planDocument` 완료를 감지하면, 사용자 눈에 띄는 `[AUTO]` 대신 `[SYSTEM_AUTO_TRIGGER: writeDocument]`라는 숨겨진 시스템 메시지를 서버로 전송합니다.
이렇게 하면 **새로운 POST `/api/chat` API 요청**이 발생하게 됩니다.

### Step 2. UI 렌더링 필터링 (`ChatPanel.tsx`)
해당 시스템 메시지가 채팅 말풍선으로 그려지지 않도록 렌더링 부에 필터를 추가했습니다.
```tsx
if (m.role === 'user' && textContent.trim().startsWith('[SYSTEM_AUTO_TRIGGER:')) {
  return null;
}
```

### Step 3. 서버 측 `toolChoice` 강제 발동 (`route.ts`)
새로운 요청이 들어오면 `route.ts`가 실행되고, 이때 이전 대화에 `planDocument` 완료 내역이 있으므로 `isPlanComplete`가 `true`로 평가됩니다.
이에 따라 `toolChoice: 'required'`가 초기 옵션으로 세팅되어 `streamText`가 실행되므로, 모델은 도망치지 못하고 반드시 `writeDocument` 도구를 강제 호출하게 됩니다.

### Step 4. DB 영구 저장 방지 (`route.ts`)
투명 트리거가 DB에 저장되어 새로고침 시 의도치 않게 다시 실행되는 치명적인 버그를 막기 위해, DB Upsert 직전에 해당 텍스트를 포함한 메시지를 잘라냈습니다.
```typescript
const insertData = messages
  .filter((m: any) => !m.parts?.some((p: any) => p.text?.startsWith('[SYSTEM_AUTO_TRIGGER:')))
  .map(...)
```

---

## 5. 결론 및 향후 과제

- **결과**: 사용자는 어떤 개입도 없이 "기획 -> 대기 -> 초안 작성"으로 이어지는 부드러운 다중 단계 워크플로우를 경험할 수 있게 되었습니다.
- **향후 과제**: 브라우저 탭을 중간에 닫으면 클라이언트의 투명 트리거가 발송되지 않아 파이프라인이 멈추는 한계는 여전히 존재합니다. 추후 OpenAI의 GPT-4o나 Claude 3.5 Sonnet처럼 프롬프트만으로 스스로 연속 호출을 완벽하게 수행하는 모델로 교체할 경우, 이 클라이언트 트리거 로직을 완전히 걷어내고 순수 서버 사이드 `maxSteps` 제어로 회귀할 수 있습니다.