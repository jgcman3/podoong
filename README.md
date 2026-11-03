# 포둥 · podoong

아이가 태어난 뒤의 돌봄 기록·인사이트·성장일기·육아 소통을 가족이 함께 사용하는 한국어·영어 웹 앱입니다. 개발·운영 환경은 분리되어 있으며, 정식 공개 전 준비와 중요 리소스 위치는 [최신 운영 준비 점검](docs/operations/production-readiness-2026-11-03.md)을 확인합니다.

## 기술 스택과 구조

Next.js 16 App Router, React 19, TypeScript, next-intl, Zod, Supabase PostgreSQL/Auth/Storage/Cron를 사용합니다. 공통 UI는 CSS 토큰과 Lucide 아이콘으로 구성합니다. Node.js 22와 npm, `package-lock.json`을 기준으로 설치합니다.

- `src/app/`: 언어별 페이지, OAuth callback.
- `src/features/`: 인증·가족·돌봄 기능과 Server Actions.
- `src/lib/`: 날짜 규칙, Supabase 접근, 생성된 DB 타입.
- `messages/`: 한국어·영어 메시지.
- `supabase/migrations/`, `supabase/tests/`: 스키마·RPC·RLS와 pgTAP.
- `tests/unit/`, `tests/e2e/`: Vitest와 Playwright.
- [로드맵](docs/plans/podung-roadmap.md), [A·B1·B2 구현 현황](docs/implementation/stages-a-b1-b2.md), [B3·B4 구현 및 검증](docs/implementation/stages-b3-b4.md).

## 로컬 실행

Docker를 실행한 뒤 아래 명령을 순서대로 실행합니다.

```sh
npm ci
npm run db:start
npm run env:local
npm run dev
```

앱은 `http://127.0.0.1:3187`, Supabase Studio는 `http://127.0.0.1:55323`입니다. 다른 로컬 프로젝트와 충돌하지 않도록 별도 포트를 사용합니다. `env:local`은 로컬 Supabase 키를 출력하지 않고 `.env.local`에 저장합니다. 기존 파일은 덮어쓰지 않습니다. 환경을 바꿀 때는 `.env.example`을 참고하십시오.

UI는 소셜 로그인만 제공합니다. 테스트가 만드는 임시 비밀번호 계정은 로컬 E2E 전용이며 로그인 우회 기능은 없습니다. 실제 화면을 이용하려면 아래 OAuth 설정이 필요합니다.

### 같은 공유기의 다른 기기에서 접속

`127.0.0.1`은 각 기기 자신입니다. 같은 공유기의 다른 기기에서 소셜 로그인까지 시험하려면 Mac의 로컬 호스트 이름을 사용합니다. macOS에서 `scutil --get LocalHostName`으로 확인한 이름 뒤에 `.local`을 붙입니다. `npm run dev`는 이 컴퓨터에서만 접속하는 기본 실행입니다.

기존 서버를 중지한 뒤 아래처럼 공유기용 실행을 시작합니다. `your-mac`은 실제 호스트 이름의 소문자 표기로 바꿉니다.

```sh
NEXT_PUBLIC_SITE_URL=http://your-mac.local:3187 npm run dev:lan
```

다른 기기의 브라우저에서도 `http://your-mac.local:3187`로 접속합니다. 개발 Supabase의 Authentication → URL Configuration → Redirect URLs에 `http://your-mac.local:3187/auth/callback**`를 추가합니다. 로그인 시작과 복귀는 같은 호스트를 사용해야 인증 쿠키가 유지됩니다. Supabase 제공자 콜백 URL은 기존 것을 사용합니다. 기기마다 별도로 로그인하며 같은 계정 또는 가족 접근 권한을 사용하면 같은 DB 자료를 볼 수 있습니다. 위 실행은 `.env.local`을 변경하지 않고 실행 프로세스의 앱 주소만 바꿉니다.

2026-10-30 확인: `192.168.*` 주소는 허용 목록에 있어도 Supabase 인증에서 거절되어 Site URL로 복귀했습니다. `.local` 주소로 바꾸어 복귀가 유지됨을 확인했습니다. 로컬 호스트 이름이 해석되지 않는 기기는 개발 사이트에서 확인합니다. 이 Mac에서만 시험할 때는 앱 주소와 허용 목록 모두 `http://127.0.0.1:3187`로 맞추어도 됩니다.

개발 서버는 현재 컴퓨터의 `.local` 이름을 `allowedDevOrigins`에 포함합니다. `NEXT_PUBLIC_SITE_URL`이나 허용 호스트를 변경한 뒤에는 개발 서버를 재시작해야 합니다. 기존 프로세스는 환경변수가 갱신되어도 이전 호스트 설정을 유지할 수 있으며, 이 경우 휴대폰에서는 HTML만 보이고 버튼·단계 입력 초기화가 멈출 수 있습니다. 접속 호스트의 `/_next/hmr` 연결도 정상인지 확인합니다.

공식 안내: [Next.js 실행 호스트](https://nextjs.org/docs/app/api-reference/cli/next), [Supabase 로그인 복귀 주소](https://supabase.com/docs/guides/auth/redirect-urls).

## API 키와 비밀값 저장 위치

확인일: 2026-11-02. API 호출에 필요한 키는 **호출하는 서버**에, 배포 인증값은 **GitHub Actions**에 보관합니다. GitHub를 모든 API 키의 원본으로 삼아 자동 동기화하는 구조는 사용하지 않습니다. 아래에는 이름과 저장 위치만 기록하며 실제 값은 기록하지 않습니다.

### 원격 실행 환경

| 용도                          | 변수 이름                                              | 저장 위치                                           | 사용처                                                            |
| ----------------------------- | ------------------------------------------------------ | --------------------------------------------------- | ----------------------------------------------------------------- |
| 나들이 주변 정보              | `OUTING_DATA_SERVICE_KEY`                              | Vercel → podoong → Settings → Environment Variables | 운영 중 소아과·약국, 공휴일, 날씨·미세먼지. 서버에서만 사용       |
| Next.js 서버의 DB 관리자 작업 | `SUPABASE_SERVICE_ROLE_KEY` 또는 `SUPABASE_SECRET_KEY` | 위 Vercel 환경변수                                  | 비공개 사진·공유·계정 삭제 등 서버 작업. 해당 환경의 DB 키만 사용 |
| 웹 푸시                       | `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`          | 해당 Supabase 프로젝트 → Edge Functions → Secrets   | `feeding-push`. 비밀키는 브라우저에 전달하지 않음                 |

- **개발:** Vercel `Preview`, Git branch `develop` → `dev.podoong.com` → 개발 Supabase `aacmsohijybjiyidfzgy`.
- **운영:** Vercel `Production` → `podoong.com` → 운영 Supabase `atdyjsxfxlhwxmxgtnte`. 개발 키를 운영에 자동 복사하지 않습니다.
- Vercel 환경변수를 변경하면 **다음 배포부터** 반영됩니다. Supabase Edge Function Secrets는 별도의 저장소이며 Vercel과 자동 공유되지 않습니다.
- 나들이 키 `OUTING_DATA_SERVICE_KEY`는 해당 환경의 Vercel에만 저장합니다. 환경 간 자동 복사는 하지 않습니다.
- Kakao 등 소셜 로그인 제공자의 client secret은 **각 Supabase 프로젝트 → Authentication → Sign In / Providers**에서 관리합니다.

### GitHub 배포 인증

| 저장 위치                                                                           | 이름                                                                                          | 역할                                                         |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 저장소 Settings → Secrets and variables → Actions → Repository secrets              | `VERCEL_TOKEN`, `SUPABASE_ACCESS_TOKEN`                                                       | 배포 CLI 인증. 공공데이터 API 키를 여기에 중복 보관하지 않음 |
| 저장소 Settings → Environments → `development` / `production` → Environment secrets | `SUPABASE_SERVICE_ROLE_KEY`                                                                   | 각 환경의 배포·작업 설정에 필요한 프로젝트별 서버 키         |
| 같은 GitHub 환경의 Variables                                                        | `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `SUPABASE_PROJECT_REF`, `PODUNG_PRODUCTION_PROJECT_REF` | 대상 프로젝트 식별과 개발·운영 경계 검증. 비밀값이 아닌 설정 |

배포 워크플로는 선택된 GitHub 환경의 값을 읽습니다. 새 API 키를 GitHub에 입력했다고 Vercel이나 Supabase에 반영되지는 않습니다. 배포 절차는 [개발·운영 배포 문서](docs/operations/launch-and-release.md)를 참고합니다.

### 로컬 파일과 키 변경 절차

- `.secrets/development-outing.env`: 나들이 서버 키 보관 파일.
- `.secrets/development-app.env`, `.secrets/production-app.env`: 환경별 앱·DB 연결 설정의 로컬 보관 파일.
- `.secrets/development-push.env`: 개발 알림 설정의 로컬 보관 파일.
- `.env.local`: 로컬 Next.js가 실제 읽는 파일. 나들이에 필요한 `OUTING_DATA_SERVICE_KEY`를 반영합니다.
- 이 파일들은 모두 Git에서 제외합니다. `.secrets`를 수정하는 것만으로 `.env.local`, Vercel, Supabase 또는 GitHub가 갱신되지 않습니다. 키가 들어 있는 파일은 소유자만 읽고 쓰도록 보관합니다.

키 변경 시 **환경과 사용처 확인 → 해당 서버의 Secret 변경 → 로컬에서도 사용하면 `.env.local` 반영 → 필요한 재배포/서버 재시작 → 값 노출 없이 실제 요청 확인** 순서로 진행합니다. 운영·개발 프로젝트를 함께 변경하지 않습니다.

### 나들이 데이터·로직 관리

- 화면·권한·현재 위치 조회·운영시간 필터·날씨·미세먼지 코드는 **`src/features/outing/`** 에 모았습니다. 동네 시설 페이지·추가 조회 API·지역별 어린이집/유치원/키즈카페 코드는 제거했습니다.
- 기저귀 교환대 공공데이터는 **`data/outing/diaper-map/`** 에 원본 gzip·출처 manifest·가공 catalogue를 함께 보관합니다. `npm run data:outing`으로 재생성하고 빌드 때 원본 해시와 결과를 확인합니다. 공개 폴더에 두지 않습니다.
- 의료 정보는 전국 소아청소년과 등록 병원·약국 목록과 요일별 운영시간을 24시간 공유 캐시합니다. 한국 시각과 공휴일 정보를 적용해 **조회 시점에 운영 중인 곳만** 거리순으로 선택합니다. 휴일·운영시간이 확인되지 않는 시설은 추천하지 않습니다. 기기 좌표를 의료 API에 보내지 않습니다.
- 운영 기간은 발급처 기준입니다. 인증키·좌표·아이 ID를 로그나 Git에 남기지 않습니다. 데이터 구조와 검증은 [나들이 주변 정보](docs/implementation/outing-information.md)를 따릅니다.

### 키 유효기간과 갱신 일정

관리 기준일: **2026-11-02**. 사용하지 않는 시설 API 키와 해당 갱신 일정은 제거했습니다. 공급자 이용기간을 확인한 후 실제 날짜를 기록하며, 아래 점검 일정은 예약 알림이 아닙니다.

| 대상                                                      | 유효기간·확인 상태                                                                                                                                            | 다음 갱신·점검                                                                                              | 변경 위치와 절차                                                                                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 나들이 `OUTING_DATA_SERVICE_KEY`                          | API 활용신청별 이용기간 확인 필요. 현재 종료일 미확인                                                                                                         | `2026-12-02` 신청 내역 점검                                                                                 | 공공데이터포털의 병원·약국·공휴일·날씨·미세먼지 승인 기간을 각각 확인하고, 사용하는 서버의 키만 변경                                     |
| `VERCEL_TOKEN`                                            | 배포용 토큰의 실제 만료일 **미확인**. CLI 로그인 세션 및 소셜 로그인용 토큰과 구분                                                                            | `2026-12-02` 계정 Tokens에서 확인 후 만료 전 교체                                                           | Vercel Account Settings → Tokens에서 새 배포 토큰 발급 → GitHub Repository secret 교체 → 개발 배포 검증 후 기존 토큰 폐기                |
| `SUPABASE_ACCESS_TOKEN`                                   | 발급 시 선택한 기간 또는 무기한 설정에 따름. 현재 CI 등록 토큰의 실제 만료일 **미확인**                                                                       | `2026-12-02` 계정 Access Tokens에서 확인 후 만료 전 교체                                                    | Supabase Account → Access Tokens → 새 토큰 발급 → GitHub Repository secret 교체 → 개발 배포 검증                                         |
| Supabase 구형 JWT 서버·공개 키                            | 로컬 보관본 `exp` 확인: 개발 `service_role`·공개 키 **`2036-10-29`**, 운영 `service_role` **`2036-10-27`** (UTC 날짜). 원격 등록본 일치 여부는 변경 시 재검증 | **`2026-12-01`** 신형 publishable/secret 키 전환 검토. JWT 만료일이 장기라고 지원 정책 점검을 생략하지 않음 | 각 Supabase 프로젝트 Settings → API Keys. Vercel 서버·공개 설정과 GitHub 환경별 서버 키를 함께 검토. 사용자 로그인 세션 만료와는 다른 키 |
| 신형 Supabase publishable/secret 키                       | 문자열 자체에서 만료일을 확인할 수 없음. 프로젝트 대시보드·지원 정책을 따름                                                                                   | `2026-12-02` 키 상태 점검. 폐기·재발급 시 필요한 환경만 교체                                                | Vercel의 해당 환경과 로컬에 반영. 다른 프로젝트의 키를 혼용하지 않음                                                                     |
| `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, 소셜 앱 키 | 이 저장소에서 별도의 연간 만료를 설정하지 않음. 공급자 만료 정책은 해당 앱 설정에서 확인                                                                      | `2026-12-02` 공급자 설정·작업 정상 동작 점검                                                                | 푸시·작업 토큰은 Supabase Secret과 연동 Vault 설정을 함께 변경. 푸시 키 변경은 기존 구독에 영향이 있으므로 매년 일괄 재발급하지 않음     |
| GitHub Actions 자동 `GITHUB_TOKEN`                        | 작업별 자동 발급·만료                                                                                                                                         | 수동 연장 불필요                                                                                            | GitHub가 관리하며 위 `VERCEL_TOKEN`·`SUPABASE_ACCESS_TOKEN`을 자동 연장해 주지는 않음                                                    |

GitHub Secrets는 저장한 값을 다시 읽을 수 없으므로 등록 날짜만으로 원래 토큰의 만료일을 계산하지 않습니다. 실제 만료일을 확인한 뒤 `확인일·갱신일·점검일·변경 대상 환경`만 README에 남깁니다. 비밀값은 기록하지 않습니다.

어린이집 포털은 운영계정 이용기간을 12개월로 제한하고 만료 30일·7일 전에 안내한다고 명시합니다. 연장 신청이 키 값까지 변경하는지는 포털 결과를 확인하며, 기존 키가 유지되면 불필요하게 재발급하지 않습니다. 새 키로 검증한 뒤에만 기존 키를 폐기합니다.

근거: [Supabase Access Token 만료 설정](https://supabase.com/changelog/38248-personal-access-tokens-expiration-usage-tracking), [Supabase API 키와 구형 키 정책](https://supabase.com/docs/guides/getting-started/api-keys), [Vercel 계정 Tokens](https://vercel.com/account/settings/tokens), [GitHub 자동 토큰 수명](https://docs.github.com/en/actions/concepts/security/github_token).

## 나들이 정보의 공유 캐시

독립 시설 탐색·어린이집·유치원·지원금 기능과 전용 API 키는 제거했습니다. 현재는 나들이 중 위치를 허용했을 때 운영 중 소아과·약국, 기저귀 교환 장소, 날씨·미세먼지만 제공합니다. 병원·약국의 공식 목록과 요일별 운영시간은 24시간 공유 캐시하고 조회 시점에 현재 운영 여부를 계산합니다. 날씨는 기상 격자별 10분, 미세먼지는 시도별 30분 공유 캐시합니다. 시설용 DB 테이블이나 전국 정기 수집 작업은 두지 않습니다. 자세한 범위는 [나들이 주변 정보](docs/implementation/outing-information.md)를 참고합니다.

## 소셜 로그인 설정

1. 개발·시험·운영 Supabase 프로젝트와 제공자 앱을 분리합니다. 운영 사이트 URL과 `/auth/callback`을 Supabase redirect 허용 목록에 등록합니다.
2. Google과 Kakao는 Supabase Auth의 기본 제공자를 설정합니다. 제공자 앱의 callback은 **Supabase가 표시하는 Auth callback URL**이며, 앱의 `/auth/callback`과 구분합니다. Kakao는 닉네임(`profile_nickname`)만 요청합니다. 카카오 Developers에서 카카오 로그인을 ON으로 설정하고 닉네임 동의항목을 활성화하며, Supabase Kakao 설정의 **Allow users without an email**을 켭니다. 이메일·프로필 사진은 요청하지 않습니다. Supabase 기본 권한에 추가되는 `scopes` 대신 `queryParams.scope`로 요청 권한을 지정하며, Supabase 업데이트 후 실제 인증 URL의 `scope`를 다시 확인합니다.
3. Naver는 식별자 `custom:naver`의 Custom OAuth2 제공자를 등록합니다. 인증 `https://nid.naver.com/oauth2.0/authorize`, 토큰 `https://nid.naver.com/oauth2.0/token`, 사용자 정보 URL은 배포된 포둥의 `https://<앱 도메인>/api/auth/naver/userinfo`로 설정합니다. 이 서버 어댑터가 네이버 `https://openapi.naver.com/v1/nid/me`에 토큰을 검증하고 중첩 `response.id`를 최상위 `sub`로 변환합니다. `email_optional=true`로 설정하며 이메일이나 생년월일은 수집하지 않습니다. Supabase 서버가 접근할 수 있는 HTTPS 시험 도메인이 필요합니다. 실제 프로젝트에서 매핑·토큰 교환이 동작하는지 확인하기 전에는 활성화하지 않습니다.
4. 수동 identity linking을 활성화합니다. 연결·해제는 5분 이내의 현재 세션 JWT의 검증된 `amr` 로그인 시각과 사용자 확인을 요구하며, 마지막 로그인 수단은 해제할 수 없습니다. Supabase의 이메일 자동 연결 정책도 시험 환경에서 확인합니다.
5. 설정과 실제 계정 검증이 끝난 제공자만 `NEXT_PUBLIC_AUTH_PROVIDERS=google,kakao,naver`에 추가합니다. 빈 값은 버튼을 비활성화합니다. client secret은 Supabase에 저장하며 저장소나 브라우저 환경 변수에 넣지 않습니다.

참조: [Supabase Custom OAuth](https://supabase.com/docs/guides/auth/custom-oauth-providers), [Identity Linking](https://supabase.com/docs/guides/auth/auth-identity-linking), [네이버 API](https://developers.naver.com/docs/login/api/api.md). 네이버 호환성·실제 세 제공자 로그인은 아직 검증되지 않았습니다.

## 주간 인사이트

하단 ‘인사이트’에서 하루·주간 패턴과 핵심 통계를 확인합니다. 통계는 일 단위 7일, 주 단위 6주 선그래프이며 먹이기 양은 전체와 기능별 값을 한 그래프에 표시합니다. 이전·다음 버튼은 7일씩 이동합니다. 기능은 여러 개 선택하거나 해제할 수 있으며 같은 날짜·시간 축에 색상별 패턴을 표시합니다. 기능별 수치와 지표는 각각 유지합니다. AI 브리핑은 현재 제공하지 않습니다. [집계 규칙·검증](docs/implementation/insights.md)을 참고하세요.

## 검증과 DB 관리

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run db:test
npx playwright install chromium
npm run test:local
npm run backup:verify
```

`db:test`와 E2E는 실행 중인 로컬 Supabase가 필요합니다. E2E는 URL이 `127.0.0.1:55321`인 경우에만 실행되며 생성한 임시 가족·계정을 정리합니다. `npm run db:reset`은 **포둥 로컬 데이터 전체를 삭제**하고 마이그레이션과 초안을 다시 적용하므로 필요한 데이터는 먼저 백업하십시오. 스키마 변경 후 `npm run db:types`로 타입을 갱신합니다.

운영 DB 적용은 별도 프로젝트 연결·검토 후 수행합니다. 일반 DB 요청은 RLS를 적용하는 사용자 키로 실행합니다. 비공개 커뮤니티 사진과 계정 삭제에는 동일 프로젝트의 서버 전용 `SUPABASE_SECRET_KEY`(또는 기존 `SUPABASE_SERVICE_ROLE_KEY`)가 추가로 필요합니다. Supabase 프로젝트 설정의 서버 키를 서버 환경에만 등록하고, 공개 환경 변수에는 넣지 않습니다. 콘텐츠는 출처·검토자·검토일이 확인되어야 게시할 수 있습니다.

## B3·B4 실행 및 운영

메뉴의 커뮤니티·오늘의 질문·알림·데이터 관리에서 새 기능을 이용합니다. 알림 설정을 처음 저장하면 앱 알림함과 분 단위 예약 작업을 사용합니다. 웹 푸시·문자 알림은 제공하지 않습니다. 운영자는 `/ko/operations`, `/ko/moderation`, `/ko/data`에서 질문·신고·작업 실패·이용 집계를 관리합니다. 운영자 지정은 신뢰할 수 있는 DB 관리자만 `community_moderators`에 대상 사용자의 UUID를 등록하여 수행합니다.

기존 Supabase 프로젝트에는 마이그레이션 `004`–`018`를 적용해야 합니다. `009`는 아이별 먹이기 시간 설정, `011`은 폐기한 먹이기 종류 정리, `012`는 수면·기저귀·성장 기록과 비공개 사진, `013`은 예방접종 기록, `014`는 가족 거주지역, `015`는 한국 법정동 드롭다운과 지역 코드, `016`은 해외 확장을 위한 국가·지역 계층, `017`은 거주지역 기반 지역·동네·국가별 주제 게시판, `018`은 작성 중 주소 변경 시 게시 범위 확인을 추가합니다. CLI 로그인을 마치고 올바른 프로젝트를 연결한 뒤 적용합니다.

```sh
npx supabase login
npx supabase link --project-ref <프로젝트-ID>
npx supabase db push
```

프로젝트 ID는 Supabase URL의 첫 부분입니다. 실행 전 연결 대상과 대기 중인 마이그레이션 목록을 확인합니다. 로컬에는 `npx supabase db push --local`을 사용합니다. 2026-10-14 연결된 `mkybqrhjrpouxmxizmpt` 프로젝트는 `014`까지 적용했습니다. 테스트 자료는 로컬 DB에만 생성합니다.

`npm run test:local`은 실행 중인 로컬 Supabase의 키를 테스트 프로세스에만 주입합니다. E2E는 별도 포트 `3188`과 빌드 폴더 `.next-e2e/`를 사용하므로 사용자가 접속 중인 `3187` 개발 서버를 중지하거나 재시작하지 마십시오. 기존 `.env.local`의 원격 프로젝트 설정을 보존합니다. `npm run operations:local`은 포둥 로컬 사진 정리·계정 삭제 작업을 실행하며, `npm run backup:verify`는 격리 임시 DB로 복원하여 원본과 비교합니다. 운영 삭제 작업자는 [운영 절차](docs/operations/data-and-backup.md)에 따라 예약 실행해야 합니다. DB 백업과 Storage 파일 백업은 별도로 관리합니다.

B4의 30–50가족 4주 파일럿, 세 소셜 제공자의 실제 계정 시험, 전문가 콘텐츠 검수, 운영 프로젝트 백업 복원은 실제 운영에서 확인할 남은 항목입니다.

### 다음 수유·이유식 시간

돌봄 기록 화면의 **다음 먹이기 시간 설정**에서 먹이기 종류(수유·이유식)를 선택한 뒤 수유 간격(분), 이유식 하루 최대 3개 시각과 시간대를 저장합니다. 오늘 화면 상단의 독립 카드에 **다음 먹이기** 시간을 표시합니다. 표시 여부 체크박스 없이 간격을 저장하면 적용되며, 사용하지 않을 때는 간격을 비워 저장합니다. 설정은 `child_meal_plans`에 아이별로 저장되어 기기 간 유지되며, 해당 아이를 함께 돌보는 가족에게 공유됩니다. 조회 전용 보호자는 읽기만 가능합니다. 수유는 마지막 종료 시각에 설정한 간격을 더하고, 이유식은 다음 도래할 일일 시각을 표시합니다. 이 설정은 오늘 화면 안내용이며 기존 알림함의 전달 설정과 별개입니다.

2026-10-13에 연결된 `mkybqrhjrpouxmxizmpt` 프로젝트에 `009`를 적용했습니다. 사용자 데이터는 수정하거나 테스트용 기록을 생성하지 않았습니다.

### 먹이기 기록과 저장 단위

오늘의 빠른 기록과 새 먹이기 기록은 모유 수유·분유·이유식 세 가지입니다. 시작 시각을 지정하고 먹인 시간(분)을 버튼으로 선택하면 종료 시각은 자동 계산해 저장합니다. 직접 모유 수유는 시간, 분유·새 이유식 기록은 ml를 선택해 기록합니다. 양은 ml 단위로만 저장합니다. 자주 쓰는 값과 다른 값을 선택할 수 있으며 양을 모르면 ‘양 모름’을 선택해 NULL로 저장합니다. 음식 이름 입력은 제거했습니다. 기존 기록의 시간·양이 선택 목록 밖에 있어도 현재 값으로 유지하며, 이전 음식 이름 자료는 보존합니다. 오늘 화면에서는 설정된 시간대의 오늘 기록을 보여주며, 상단에는 마지막 기저귀·식사·수면을 경과 시간으로 표시합니다. 기록 영역을 좌우로 밀면 과거 날짜의 기록과 섭취량을 확인할 수 있습니다. 마이그레이션 011로 기존 유축·유축 모유·식사 기록과 연결된 알림을 삭제하고 식사 시간 설정 컬럼도 제거했습니다. 폐기한 종류의 새 저장은 DB에서 차단합니다.

현재 먹이기 저장 API는 ml·음식 이름·입력 시간대를 저장합니다. `076`에서 사용하지 않는 g 필드와 구형 돌봄·일정 저장 API를 제거했습니다. 지원이 끝난 g 데이터는 변환하지 않고 정리하며 정상적인 ml 기록과 시간대 미상 기록은 유지합니다.

### 수면·기저귀·성장 기록

전체 서비스에서 세 서비스의 기록 목록을 열고 **기록하기**로 별도 작성 화면에 진입합니다. 수면은 낮잠·밤잠·타이머, 기저귀는 교체 종류·대변 관찰, 성장은 신체 측정·발달 일기·비공개 사진을 제공합니다. 마이그레이션 `012`가 필요하며 새 기록은 아이별 내보내기·삭제에 포함됩니다. 통계 그래프는 추가하지 않았습니다. [D 단계 구현 및 권한·운영 안내](docs/implementation/stage-d-child-care.md)를 참고하십시오.

### 예방접종·독감

전체 서비스에서 접종 예정·완료 기록과 공식 안내를 이용합니다. 백신·차수·접종일·병원·메모를 기록하며 독감은 절기별로 관리합니다. 예정 접종은 오늘과 일정 화면에도 표시됩니다. 마이그레이션 `013`이 필요합니다. [구현·공식 출처·권한 안내](docs/implementation/stage-d-vaccination.md)를 참고하십시오.

### 일정·할 일 목록과 빠른 돌봄 기록

일정과 할 일은 목록으로 관리하며 페이지를 넘겨 지난 기록과 날짜 없는 할 일도 확인합니다. 달력뷰는 사용자 요청으로 제거했습니다. 오늘 화면의 다가오는 일정과 접종 예정에는 사용자 시간대 기준으로 ‘오늘·내일·N일 후’를 표시합니다.

오늘의 빠른 돌봄 기록은 모유·분유·이유식·수면·기저귀·배변·성장·발달의 6개 카드입니다. 권한이 있는 보호자는 작성 화면으로, 조회 전용 보호자는 해당 기록 목록으로 이동합니다. 별도의 ‘최근 돌봄’ 영역은 제거했습니다.

### 가족 거주지역

**우리 가족 → 가족이 사는 곳**에서 한국의 시·도 → 시·군·구 → 읍·면·동을 드롭다운으로 선택합니다. 동네별 커뮤니티 구성을 위해 국가 코드와 공식 법정동 코드를 함께 저장합니다. 같은 가족의 아이들이 공통으로 사용하며 소유자가 수정하고 가족 구성원이 조회합니다. 등록한 거주지역은 삭제할 수 없고 다른 지역으로 변경할 수 있습니다. 마이그레이션 `014`–`016`이 필요합니다. 국가별 코드와 서로 다른 행정구역 단계 수를 지원하는 DB 구조를 준비했으며, 현재 화면과 활성 국가는 한국만 제공합니다. [저장 구조·권한·후속 서비스 연결 안내](docs/implementation/family-residence.md)를 참고하십시오.

### 부모 커뮤니티 게시판

가족 거주지역을 기준으로 같은 시·군·구의 지역 게시판과 같은 읍·면·동의 동네 게시판에 연결합니다. 주제별 게시판은 같은 국가에서 함께 이용합니다. 제목은 `강남구 게시판`·`역삼동 게시판`·`임신 게시판`처럼 짧게 표시합니다. 거주지역 미등록 시 우리 가족에서 먼저 등록합니다. 마이그레이션 `017`·`018`이 필요합니다. [게시판 구성·공유 범위](docs/implementation/community-home-boards.md)를 참고하십시오.

### 빠른 육아 기록

오늘 화면에서 모유·분유·이유식·수면·기저귀를 페이지 이동 없이 기록합니다. 넓은 화면에서는 타임라인 옆 입력 패널, 모바일에서는 하단 기록창을 사용하며 화면 크기를 바꿔도 입력값을 유지합니다. 양은 눈금 드래그나 버튼으로 선택하고, 진행 중인 수유·수면은 같은 화면에서 종료합니다. 성장·발달과 추가 항목은 기존 상세 기록을 이용합니다. [화면·저장 구조와 검증](docs/implementation/quick-care-experience.md)을 참고하십시오.

오늘 화면의 빠른 기록은 모유·분유·이유식·기저귀·배변·수면·목욕·병원·체온·예방접종·투약·간식·놀이·터미타임 14종을 지원합니다. 항목별 색상 아이콘을 가로로 밀거나 마우스로 드래그해 선택합니다. 설명 배너 없이 항목명과 오늘 기록을 표시하며, 기본 화면은 밝은 테마입니다. `019_daily_care` 마이그레이션을 적용해야 새 일상·건강 기록을 저장할 수 있습니다.

일정과 할 일의 일정·병원·예방접종·투약·할 일 버튼에서 개별 등록 화면을 엽니다. 병원/투약 예정에는 날짜와 선택적 시간을 저장하고, 기존 예방접종 자료는 `calendar_entries` 권한 적용 뷰로 함께 조회합니다. 오늘의 다가오는 일정도 이 자료를 사용합니다. `021_calendar_care` 적용과 [통합 일정 구현](docs/implementation/calendar-care.md)을 참고하세요.

오늘 할 일·오늘 일정 카드는 해당 날짜의 자료가 있을 때만 표시합니다. 할 일 완료·해제는 양쪽 메뉴의 왼쪽 체크박스로 처리하고, 등록은 일정 메뉴 상단 아이콘에서 진행합니다.

## 개발·운영 배포

운영은 `main` → `https://podoong.com` → 기존 서울 Supabase, 개발은 `develop` → `https://dev.podoong.com` → 별도 서울 Supabase로 구분합니다. 원격 환경은 두 개이며 로컬 DB는 자동 테스트에만 사용합니다. GitHub Actions의 검사 성공 후 환경별 DB 마이그레이션·함수·Next.js 배포를 실행하도록 설정했습니다. 도메인·계정·환경별 키를 준비하고 `DEPLOYMENTS_ENABLED`를 활성화하기 전에는 실제 배포하지 않습니다. 현재 `DEPLOYMENTS_ENABLED=true`이며 개발 배포는 동작 중입니다. 운영 준비 상태·리소스 위치는 [2026-11-03 점검](docs/operations/production-readiness-2026-11-03.md), 설정 절차와 과거 이력은 [배포 운영 문서](docs/operations/launch-and-release.md)를 따릅니다.

### 나들이 현재 위치

나들이 시작 버튼을 누르면 위치 권한을 요청합니다. 거절해도 기록은 저장됩니다. 나들이 중이고 위치를 허용한 경우에만 오늘 상단에 주변 정보를 표시하며, 종료·삭제 후에는 숨깁니다. 화면을 보는 동안 5분마다, 앱으로 돌아올 때 위치를 재확인합니다. HTTPS/localhost에서 사용할 수 있으며 일반 HTTP LAN 주소는 브라우저가 위치 기능을 제한합니다. 좌표는 DB에 보관하지 않습니다.

### 동네 친구들 로컬 예시

`npm run dev:playground` 실행 후 [로컬 예시](http://localhost:3190/api/local/playground-demo)를 열면 아기 8명이 입장한 화면을 볼 수 있습니다. 별도 로컬 DB·3190 포트를 사용하며 실제 개발/운영 DB와 기존 `.env.local`은 변경하지 않습니다. [예시 데이터와 실행 설정](docs/implementation/parenting-community.md)을 참고하세요.
