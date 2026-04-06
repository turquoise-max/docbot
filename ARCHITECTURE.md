# 문서봇(Docbot) 폴더 구조 설계서

Next.js 14 App Router 기반의 문서봇 프로젝트 폴더 구조입니다. 요청하신 요구사항(라우트 분리, Supabase server/client 분리, TipTap 에디터 feature 격리, Claude API 경로 제한)을 모두 반영하여 설계되었습니다.

```text
src/
├── app/                                # Next.js 14 App Router 최상위 디렉토리
│   ├── (auth)/                         # 인증 관련 라우트 그룹 (로그인, 회원가입 등)
│   ├── (dashboard)/                    # 대시보드 관련 라우트 그룹
│   │
│   ├── api/                            # API 라우트 핸들러
│   │   ├── ai/                         # 🌟 [요구사항] Claude API 호출 전용 라우트
│   │   │   ├── generate/route.ts       # Claude 텍스트 생성 API (예: 문서 초안 작성)
│   │   │   └── chat/route.ts           # Claude 챗봇 대화 API
│   │   └── chat/route.ts               # 일반 채팅 API (기존)
│   │
│   ├── editor/                         # 🌟 [요구사항] /editor 라우트 분리
│   │   ├── page.tsx                    # 문서 편집기 메인 페이지
│   │   └── layout.tsx                  # 에디터 전용 레이아웃 (전체화면 등)
│   │
│   ├── templates/                      # 🌟 [요구사항] /templates 라우트 분리
│   │   ├── page.tsx                    # 템플릿 목록 조회 페이지
│   │   └── [id]/page.tsx               # 특정 템플릿 상세 및 사용 페이지
│   │
│   ├── archive/                        # 🌟 [요구사항] /archive 라우트 분리
│   │   └── page.tsx                    # 보관된/완료된 문서 목록 페이지
│   │
│   ├── layout.tsx                      # 글로벌 Root 레이아웃
│   └── page.tsx                        # 글로벌 Root 메인 페이지 (랜딩 페이지)
│
├── features/                           # 🌟 [요구사항] 도메인/기능별 모듈 격리 폴더
│   └── tiptap-editor/                  # TipTap 에디터 관련 기능 격리
│       ├── components/                 # TipTap 전용 컴포넌트
│       │   ├── Editor.tsx              # 메인 에디터 컴포넌트
│       │   ├── Toolbar.tsx             # 에디터 툴바 (볼드, 이탤릭 등)
│       │   └── BubbleMenu.tsx          # 드래그 시 나타나는 플로팅 메뉴
│       ├── hooks/                      # TipTap 관련 커스텀 훅
│       │   └── useTiptapEditor.ts      # 에디터 인스턴스 생성 및 상태 관리 훅
│       ├── extensions/                 # TipTap 커스텀 익스텐션 (Claude 연동 등)
│       └── index.ts                    # 외부(app/editor 등)에서 접근할 퍼블릭 API 내보내기
│
├── lib/                                # 공통 유틸리티 및 라이브러리 설정
│   └── supabase/                       # 🌟 [요구사항] Supabase client/server 분리 패턴 적용
│       ├── client.ts                   # 브라우저용 Supabase 클라이언트 (createBrowserClient)
│       ├── server.ts                   # 서버 컴포넌트/액션용 Supabase 클라이언트 (createServerClient)
│       └── middleware.ts               # 미들웨어용 클라이언트 (인증 세션 갱신 등)
│
├── components/                         # 애플리케이션 전역에서 사용되는 공통 컴포넌트
│   ├── ui/                             # 공용 UI 컴포넌트 (버튼, 모달, 인풋 등)
│   ├── chat/                           # 채팅 관련 공용 컴포넌트
│   └── layout/                         # 헤더, 사이드바, 푸터 등 레이아웃 컴포넌트
│
├── middleware.ts                       # Next.js 미들웨어 (라우트 보호 및 Supabase 세션 관리)
└── types/                              # 전역 TypeScript 타입 정의 (Supabase DB 타입 등)
```

## 주요 설계 포인트 설명

1. **라우트 분리 (`/editor`, `/templates`, `/archive`)**
   - App Router의 규칙에 따라 `src/app/` 하위에 각각의 디렉토리를 생성하여 독립적인 페이지와 레이아웃을 가지도록 구성했습니다.

2. **Supabase Client 분리 (`src/lib/supabase/`)**
   - `@supabase/ssr` 패키지의 권장 패턴을 따라 브라우저, 서버, 미들웨어 환경에 맞춰 안전하게 Supabase 인스턴스를 생성하도록 분리되어 있습니다.

3. **TipTap 에디터 격리 (`src/features/tiptap-editor/`)**
   - FSD(Feature-Sliced Design) 아키텍처의 아이디어를 차용하여 에디터라는 거대한 도메인을 `features` 폴더로 격리했습니다. `/app/editor/page.tsx` 에서는 오직 `features/tiptap-editor` 에서 export 하는 컴포넌트만 가져다 쓰도록 결합도를 낮춥니다.

4. **Claude API 경로 제한 (`src/app/api/ai/`)**
   - 서버 측에서만 외부 API(Claude) 키가 노출되도록 하여 보안을 강화하고, 모든 AI 관련 프롬프트 처리와 API 호출 로직은 `/api/ai/*` 경로 내에서 전담하도록 구성했습니다.