# 문서봇 (DocBot)

AI가 기획부터 본문 작성까지 함께 완성하는 실무 문서 작성 도구입니다. 기존 워드 파일 서식을 그대로 유지하면서도, AI를 활용해 전문가 수준의 문서 초안을 빠르게 생성하고 편집할 수 있습니다.

![DocBot Landing](https://via.placeholder.com/1200x600.png?text=DocBot+Landing+Page)

<br/>

## 🌟 주요 기능

- **AI 대화형 기획 인터뷰**: 사용자와의 대화를 통해 문서의 목적, 타겟, 핵심 메시지를 명확히 정리합니다.
- **자동 목차 및 본문 생성**: 업종과 문서 유형에 맞는 목차를 자동 제안하고, 승인된 목차를 바탕으로 AI가 각 섹션을 전문적인 텍스트로 채워줍니다.
- **워드 서식 보존 (WYSIWYG 에디터)**: 회사 양식, 폰트, 표 서식 등을 유지한 채로 AI 편집이 가능합니다. (Syncfusion Document Editor 연동)
- **수정 전 미리보기 (Human-in-the-loop)**: AI가 제안한 내용을 바로 적용하지 않고, 사용자가 직접 확인하고 수락 또는 거절할 수 있어 문서의 주도권을 보장합니다.
- **버전 히스토리 관리**: 저장 시점마다 스냅샷이 생성되어 언제든 이전 버전으로 롤백이 가능합니다.

<br/>

## 🛠 기술 스택

- **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS, TypeScript
- **Backend/Database**: Supabase (PostgreSQL, Auth, Storage)
- **AI Integration**: Vercel AI SDK v6, OpenAI / Anthropic / Google Gemini API 연동
- **Editor**: Syncfusion Document Editor (`@syncfusion/ej2-react-documenteditor`)

<br/>

## 🚀 문제 해결 과정 (Troubleshooting)

프로젝트 개발 과정에서 겪었던 주요 기술적 난제와 해결 방법입니다.

### 1. Vercel AI SDK 다중 단계 도구 호출 (Multi-step Tool Calling) 오케스트레이션 설계
기존에는 클라이언트 측에서 강제로 다음 도구를 호출하는 안티패턴을 사용하고 있었습니다. Vercel AI SDK의 `maxSteps`를 활용한 서버 사이드 제어를 시도했으나, SDK 내부 루프의 파라미터 고정 한계(`toolChoice` 옵션이 동적으로 갱신되지 않는 현상)로 인해 AI가 중간에 텍스트만 뱉고 탈출하는 문제가 발생했습니다.

**해결 방법 (Hybrid Approach):**
- 클라이언트에서 사용자 눈에 보이지 않는 **"투명한 시스템 트리거 (`[SYSTEM_AUTO_TRIGGER: writeDocument]`)"**를 발송하여 새로운 API 요청을 유도했습니다.
- UI 렌더링 로직에서 해당 시스템 메시지를 필터링하여 사용자에게 노출되지 않도록 처리했습니다.
- 백엔드(`route.ts`)에서는 새로운 요청의 맥락(이전 기획 완료 여부)을 파악하여 동적으로 `toolChoice: 'required'`를 주입, AI가 반드시 다음 단계 도구를 실행하도록 강제했습니다.
- [자세히 보기 (다중 단계 오케스트레이션)](./troubleshooting/2026-05-20-ai-sdk-multi-step-orchestration.md)

### 2. 최신 LLM의 병렬 도구 호출(Parallel Tool Calling) 무한 루프 제어
Gemini 등 최신 LLM이 한 번에 여러 질문을 처리하기 위해 스스로 판단하여 도구를 병렬로 중복 호출하는 성향이 있었습니다. 이로 인해 클라이언트 UI가 대기 상태 판별에 실패하고, 빈 메시지를 자동 전송하여 챗봇이 무한 루프에 빠져 멈추는 치명적 버그가 발생했습니다.

**해결 방법:**
- 서버 측 차단: `streamText` 옵션에 `experimental_parallelToolCalls: false`를 명시적으로 선언하여 AI의 독단적 병렬 호출을 구조적으로 차단했습니다.
- 프롬프트 엔지니어링: 다중 질문 시 무조건 배열(Array) 형태의 1개 도구 인자로 묶어 보내도록 지시하고, 불필요한 반복 호출 시 논리적으로 다음 단계로 넘어가도록 강제했습니다.
- 클라이언트 방어 로직 강화: 상태(`state`)값에 의존하던 대기열 판별 로직을 폐기하고, 도구 결과(`output/result`)의 존재 여부만을 직관적이고 보수적으로 검증하도록 개선했습니다.
- [자세히 보기 (병렬 호출 무한 루프)](./troubleshooting/2026-05-18-ai-sdk-parallel-tool-call-loop.md)

### 그 외 문제 해결
- [채팅 패널 및 컨텍스트 리팩토링](./troubleshooting/2026-05-20-chatpanel-refactoring.md)
- [Syncfusion 라이선스 보안 처리](./troubleshooting/2026-05-20-syncfusion-license-security.md)

<br/>

## 💻 실행 방법 (Getting Started)

로컬 환경에서 프로젝트를 실행하는 방법입니다.

### 1. 패키지 설치
```bash
npm install
```

### 2. 환경 변수 설정
프로젝트 루트 경로에 `.env.local` 파일을 생성하고 `.env.example`을 참고하여 다음 정보들을 입력합니다.
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY` (또는 Google/Anthropic API 키)
- `NEXT_PUBLIC_SYNCFUSION_LICENSE_KEY` (선택: 에디터 사용 시)

### 3. 개발 서버 실행
```bash
npm run dev
```
접속: [http://localhost:3000](http://localhost:3000)

<br/>

## 📜 라이선스
MIT License