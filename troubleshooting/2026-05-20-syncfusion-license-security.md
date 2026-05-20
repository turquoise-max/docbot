# Syncfusion 환경 변수 노출 보안 취약점 해결

## Issue
- 브라우저 자바스크립트 코드(`src/components/editor/SyncfusionDocEditor.tsx`)에 `NEXT_PUBLIC_SYNCFUSION_LICENSE_KEY` 환경 변수가 하드코딩되어 상용 라이선스 키가 클라이언트(브라우저의 Static Asset)에 그대로 노출됨.
- 누구나 개발자 도구를 통해 유료 라이선스 키를 탈취할 수 있는 심각한 보안 취약점 존재.

## Solution
1. **환경 변수 분리**:
   - `.env.local`에서 `NEXT_PUBLIC_SYNCFUSION_LICENSE_KEY`를 제거하고 서버 전용 변수 `SYNCFUSION_LICENSE_KEY`로 교체.
2. **라이선스 제공 API 생성**:
   - `src/app/api/editor/license/route.ts` API 생성.
   - Supabase 인증 세션 검사 추가 -> 인증된 로그인 사용자에게만 키 반환(Rate limit 우회 방어).
3. **컴포넌트 내 동적 등록 처리**:
   - `SyncfusionDocEditor` 컴포넌트 마운트 시(`useEffect`), 생성한 API를 `fetch`하여 라이선스 키 로드 후 `registerLicense()` 실행.
   - 불필요한 API 반복 호출(Rate limit 부담)을 막기 위해 모듈 레벨 변수(`cachedLicenseKey`) 캐싱 도입.
   - 키 등록이 완료되기 전엔 로딩 UI를 렌더링하여 워터마크 표시 방지.