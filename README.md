# 포둥 · podoong

임신부터 육아까지 가족이 함께 관리하는 한국어·영어 웹 앱입니다. 현재 구현 범위는 개발 로드맵의 **A → B1 → B2 → B3 및 B4 운영 기반, D의 수면·기저귀·성장·예방접종 기록, 주간 인사이트**입니다. 외부 검증까지 마친 공개 서비스는 아닙니다.

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

| 용도 | 변수 이름 | 저장 위치 | 사용처 |
| --- | --- | --- | --- |
| 공공데이터 공통 키 | `DATA_SERVICE_KEY` | Vercel → podoong → Settings → Environment Variables | 병원·약국·공휴일·날씨·미세먼지의 서버 조회 |
| 유치원 | `KINDERGARTEN_API_KEY` | 위 Vercel 환경변수 | 유치원알리미 조회 |
| 어린이집 전국 목록 | `CHILDCARE_API_KEY` | 위 Vercel 환경변수 | `cpmsapi021` 전용. 개별 기본정보 API와 키를 혼용하지 않음 |
| 어린이집 개별 기본정보 | `CHILDCARE_DETAIL_API_KEY` | 위 Vercel 환경변수 | `cpmsapi030` 전용. 2026-11-02 운영계정용 키로 실제 정보·좌표 조회 확인 |
| 주소 좌표 보완(선택) | `KAKAO_REST_API_KEY` | 위 Vercel 환경변수 | 동네 수준의 주소 좌표 조회. 단말 GPS를 사용하지 않음 |
| Next.js 서버의 DB 관리자 작업 | `SUPABASE_SERVICE_ROLE_KEY` 또는 `SUPABASE_SECRET_KEY` | 위 Vercel 환경변수 | 비공개 사진·공유·계정 삭제 등 서버 작업. 해당 환경의 DB 키만 사용 |
| 정부·지역 지원금 수집 | `GOV24_SERVICE_KEY` | 해당 Supabase 프로젝트 → Edge Functions → Secrets | `parenting-support` 정기 수집. 공통 인증키와 같은 값 사용 가능 |
| 지원금 작업 호출 인증 | `SUPPORT_WORKER_TOKEN` | Supabase Edge Function Secrets와 해당 프로젝트 Vault | Cron이 수집 함수를 호출할 때 검증 |
| 웹 푸시 | `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY` | 해당 Supabase 프로젝트 → Edge Functions → Secrets | `feeding-push`. 비밀키는 브라우저에 전달하지 않음 |

- **개발:** Vercel `Preview`, Git branch `develop` → `dev.podoong.com` → 개발 Supabase `aacmsohijybjiyidfzgy`.
- **운영:** Vercel `Production` → `podoong.com` → 운영 Supabase `atdyjsxfxlhwxmxgtnte`. 개발 키를 운영에 자동 복사하지 않습니다.
- 2026-11-02 개발 Vercel 등록 확인: `DATA_SERVICE_KEY`, `KINDERGARTEN_API_KEY`, `CHILDCARE_API_KEY`, `CHILDCARE_DETAIL_API_KEY`. 어린이집 두 키는 운영계정용 키로 교체했습니다. 포털의 운영계정용 키와 포둥의 운영 배포 환경은 서로 다릅니다. 이번에는 개발 Vercel과 로컬만 갱신했으며 어린이집 화면 조회도 지역별 공유 캐시와 연결했습니다.
- Vercel 환경변수를 변경하면 **다음 배포부터** 반영됩니다. Supabase Edge Function Secrets는 별도의 저장소이며 Vercel과 자동 공유되지 않습니다.
- 일반 공공데이터 키를 Vercel에는 `DATA_SERVICE_KEY`, 지원금 함수에는 `GOV24_SERVICE_KEY`라는 이름으로 저장합니다. 로컬 비공개 파일의 `GOV24_SERVICE_KEY`는 다른 키로 덮어쓸 때만 필요하며, 비어 있으면 설정 스크립트가 `PUBLIC_DATA_SERVICE_KEY`를 사용합니다.
- Kakao 등 소셜 로그인 제공자의 client secret은 **각 Supabase 프로젝트 → Authentication → Sign In / Providers**에서 관리합니다.

### GitHub 배포 인증

| 저장 위치 | 이름 | 역할 |
| --- | --- | --- |
| 저장소 Settings → Secrets and variables → Actions → Repository secrets | `VERCEL_TOKEN`, `SUPABASE_ACCESS_TOKEN` | 배포 CLI 인증. 공공데이터 API 키를 여기에 중복 보관하지 않음 |
| 저장소 Settings → Environments → `development` / `production` → Environment secrets | `SUPABASE_SERVICE_ROLE_KEY` | 각 환경의 배포·작업 설정에 필요한 프로젝트별 서버 키 |
| 같은 GitHub 환경의 Variables | `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `SUPABASE_PROJECT_REF`, `PODUNG_PRODUCTION_PROJECT_REF` | 대상 프로젝트 식별과 개발·운영 경계 검증. 비밀값이 아닌 설정 |

배포 워크플로는 선택된 GitHub 환경의 값을 읽습니다. 새 API 키를 GitHub에 입력했다고 Vercel이나 Supabase에 반영되지는 않습니다. 배포 절차는 [개발·운영 배포 문서](docs/operations/launch-and-release.md)를 참고합니다.

### 로컬 파일과 키 변경 절차

- `.secrets/development-public-data.env`: 개발 공공 API 키의 로컬 보관 파일. 파일 전체를 원격에 업로드하지 않습니다.
- `.secrets/development-app.env`, `.secrets/production-app.env`: 환경별 앱·DB 연결 설정의 로컬 보관 파일.
- `.secrets/development-push.env`: 개발 알림 설정의 로컬 보관 파일.
- `.env.local`: 로컬 Next.js가 실제 읽는 파일. 현재 공통 키의 `PUBLIC_DATA_SERVICE_KEY` 이름도 호환하며, 어린이집 두 키를 포함해 필요한 값을 여기에 반영합니다.
- 이 파일들은 모두 Git에서 제외합니다. `.secrets`를 수정하는 것만으로 `.env.local`, Vercel, Supabase 또는 GitHub가 갱신되지 않습니다. 키가 들어 있는 파일은 소유자만 읽고 쓰도록 보관합니다.

키 변경 시 **환경과 사용처 확인 → 해당 서버의 Secret 변경 → 로컬에서도 사용하면 `.env.local` 반영 → 필요한 재배포/서버 재시작 → 값 노출 없이 실제 요청 확인** 순서로 진행합니다. 운영·개발 프로젝트를 함께 변경하지 않습니다.

### 키즈카페 파일 관리와 서버 반영

관리 위치는 **`data/facilities/kids-cafes/`** 입니다. 이 폴더를 Git에 보관하고 Vercel 서버 배포 파일에 포함합니다. `public/`에 두지 않으며 원본을 브라우저에 내려주지 않습니다. 화면은 정리한 목록만 읽으므로 키즈카페 외부 API나 별도 DB 조회가 없습니다.

| 위치 | 관리 내용 |
| --- | --- |
| `data/facilities/kids-cafes/sources/` | 공식 원본 JSON·CSV 파일. 출처별·기준일별 파일명을 사용하며 CSV는 원본 CP949 인코딩을 보존 |
| `data/facilities/kids-cafes/manifest.json` | 파일 경로, 출처 URL, 자료 기준일, 내려받은 날짜, SHA-256, 제공 지역, 제외할 비키즈카페 시설, 미확보 자료 상태 |
| `data/facilities/kids-cafes/catalogue.json` | 원본으로 생성한 서비스 표시용 통합 목록. 직접 편집하지 않음 |
| `scripts/build-kids-cafes.mjs` | 파일 무결성 검사·주소 정리·중복 제거·서비스 목록 생성 |

현재 원본은 6개이며 **서울 공공형 151곳 + 부산 5개 구·군 44곳 = 195곳**을 제공합니다. 서울은 사용자 요청에 따라 **2026-10-03 기준 공공형만** 포함하고 민간 인허가 파일은 제외했습니다. 부산은 기장군·해운대구·부산진구·강서구·북구의 공식 파일만 포함합니다. 출처마다 기준일이 달라 목록 아래에 각각 표시합니다. 부산 전체를 빠짐없이 포괄하는 자료라는 뜻은 아닙니다. 경기도는 정확한 원본을 확보하지 못해 제공 목록에서 제외했습니다.

파일 교체 순서:

1. 공식 파일을 `sources/`에 넣고 `manifest.json`의 경로·출처·기준일·지역을 수정합니다. 자료 기준일과 다운로드 날짜를 구분합니다.
2. `npm run data:kids-cafes -- --update-hashes`를 실행해 원본 SHA-256과 `catalogue.json`을 갱신합니다.
3. 변경된 파일과 manifest·catalogue를 함께 검토하고 커밋합니다. `npm run data:kids-cafes -- --check`로 재생성 결과를 확인할 수 있으며 배포 빌드에서도 자동 검사합니다.
4. `develop` 반영 시 **dev.podoong.com**, 검증 후 `main` 반영 시 **podoong.com** 서버에 해당 파일들이 함께 배포됩니다. 운영 서버의 파일을 따로 수동 수정하지 않습니다.

키즈카페·기저귀맵 버튼은 **선택한 시·군·구에 실제 원본 기록이 있을 때만** 표시합니다. 자료가 없는 종류의 기존 주소로 접근하면 표시 가능한 기본 종류(병원)를 보여줍니다. 기저귀맵은 전국 공중화장실 중 기저귀 교환대 등록 자료를 사용하며, 부산 키즈카페는 확보한 5개 구·군에서만 버튼을 표시합니다.

좌표가 있는 시설만 등록 지역 기준 직선거리로 정렬하고, 없는 시설은 거리 숫자를 만들지 않습니다. 요금·이용 연령·운영일도 원본에 있을 때만 표시합니다. 기존 행정안전부 놀이시설 API와 `PLAYGROUND_API_KEY`는 사용하지 않습니다.


날씨 상태는 기상청 초단기 실황의 강수형태와 초단기예보의 하늘상태를 이용합니다. 안개는 이 응답에 없어 추정하지 않습니다. 미세먼지 표시는 [에어코리아 농도 구간](https://www.airkorea.or.kr/web/dustForecast)을 적용합니다(PM10: 30/80/150, PM2.5: 15/35/75 µg/m³). 수신값이 없으면 등급도 표시하지 않습니다.

### 키 유효기간과 갱신 일정

관리 기준일: **2026-11-02**. 아래의 어린이집 날짜는 사용자 요청에 따라 오늘부터 1년으로 정한 관리 일정입니다. 발급 포털의 실제 이용 종료일이 다르면 **포털 날짜를 우선**하고 이 표를 수정합니다. 다른 키의 만료일을 어린이집과 동일하게 추정하지 않습니다. 이 표의 점검일은 문서상 일정이며 별도 예약 알림은 아직 없습니다.

| 대상 | 유효기간·확인 상태 | 다음 갱신·점검 | 변경 위치와 절차 |
| --- | --- | --- | --- |
| `CHILDCARE_API_KEY` (`cpmsapi021`) | 운영계정 이용기간 12개월. 기준일 `2026-11-02` → 갱신 예정일 **`2027-11-02`** | **`2027-10-03`**부터 연장 확인, **`2027-10-26`** 최종 확인 | 어린이집정보공개포털 → 마이페이지 → 해당 API 운영계정 이용 신청현황에서 연장. 키가 변경되면 개발 Vercel `Preview/develop`·`.env.local` 갱신 후 재배포·재조회 |
| `CHILDCARE_DETAIL_API_KEY` (`cpmsapi030`) | 위와 별도 운영계정·키. 기준일 `2026-11-02` → 갱신 예정일 **`2027-11-02`** | **`2027-10-03`**부터 연장 확인, **`2027-10-26`** 최종 확인 | 전국 목록과 개별 기본정보의 신청을 각각 확인. 목록 키만 연장하고 상세 키를 빠뜨리지 않음 |
| 공공데이터 공통 키 (`DATA_SERVICE_KEY` / 로컬 `PUBLIC_DATA_SERVICE_KEY`)와 지원금 `GOV24_SERVICE_KEY` | 활용신청별 이용기간을 확인해야 함. 현재 신청별 종료일 **미확인** | `2026-12-02` 이용기간 점검. 종료일 확인 후 실제 갱신일 기록 | 공공데이터포털 → 마이페이지 → 데이터활용 → 활용신청 현황. 병원·약국·날씨·공휴일·미세먼지·지원금의 승인과 기간을 각각 확인. 같은 인증키를 쓴다고 모든 신청 기간이 같은 것은 아님 |
| `KINDERGARTEN_API_KEY` | 유치원알리미의 승인 계정 이용기간·키 만료일 **미확인** | `2026-12-02` 발급 계정에서 확인 후 날짜 보완 | 유치원알리미 → OPEN API → 발급·신청 내역 확인. 변경 시 Vercel의 해당 환경과 로컬 갱신 |
| `VERCEL_TOKEN` | 배포용 토큰의 실제 만료일 **미확인**. CLI 로그인 세션 및 소셜 로그인용 토큰과 구분 | `2026-12-02` 계정 Tokens에서 확인 후 만료 전 교체 | Vercel Account Settings → Tokens에서 새 배포 토큰 발급 → GitHub Repository secret 교체 → 개발 배포 검증 후 기존 토큰 폐기 |
| `SUPABASE_ACCESS_TOKEN` | 발급 시 선택한 기간 또는 무기한 설정에 따름. 현재 CI 등록 토큰의 실제 만료일 **미확인** | `2026-12-02` 계정 Access Tokens에서 확인 후 만료 전 교체 | Supabase Account → Access Tokens → 새 토큰 발급 → GitHub Repository secret 교체 → 개발 배포 검증 |
| Supabase 구형 JWT 서버·공개 키 | 로컬 보관본 `exp` 확인: 개발 `service_role`·공개 키 **`2036-10-29`**, 운영 `service_role` **`2036-10-27`** (UTC 날짜). 원격 등록본 일치 여부는 변경 시 재검증 | **`2026-12-01`** 신형 publishable/secret 키 전환 검토. JWT 만료일이 장기라고 지원 정책 점검을 생략하지 않음 | 각 Supabase 프로젝트 Settings → API Keys. Vercel 서버·공개 설정과 GitHub 환경별 서버 키를 함께 검토. 사용자 로그인 세션 만료와는 다른 키 |
| 신형 Supabase publishable/secret 키 | 문자열 자체에서 만료일을 확인할 수 없음. 프로젝트 대시보드·지원 정책을 따름 | `2026-12-02` 키 상태 점검. 폐기·재발급 시 필요한 환경만 교체 | Vercel의 해당 환경과 로컬에 반영. 다른 프로젝트의 키를 혼용하지 않음 |
| `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, `SUPPORT_WORKER_TOKEN`, 선택적 지도·소셜 앱 키 | 이 저장소에서 별도의 연간 만료를 설정하지 않음. 공급자 만료 정책은 해당 앱 설정에서 확인 | `2026-12-02` 공급자 설정·작업 정상 동작 점검 | 푸시·작업 토큰은 Supabase Secret과 연동 Vault 설정을 함께 변경. 푸시 키 변경은 기존 구독에 영향이 있으므로 매년 일괄 재발급하지 않음 |
| GitHub Actions 자동 `GITHUB_TOKEN` | 작업별 자동 발급·만료 | 수동 연장 불필요 | GitHub가 관리하며 위 `VERCEL_TOKEN`·`SUPABASE_ACCESS_TOKEN`을 자동 연장해 주지는 않음 |

GitHub Secrets는 저장한 값을 다시 읽을 수 없으므로 등록 날짜만으로 원래 토큰의 만료일을 계산하지 않습니다. 실제 만료일을 확인한 뒤 `확인일·갱신일·점검일·변경 대상 환경`만 README에 남깁니다. 비밀값은 기록하지 않습니다.

어린이집 포털은 운영계정 이용기간을 12개월로 제한하고 만료 30일·7일 전에 안내한다고 명시합니다. 연장 신청이 키 값까지 변경하는지는 포털 결과를 확인하며, 기존 키가 유지되면 불필요하게 재발급하지 않습니다. 새 키로 검증한 뒤에만 기존 키를 폐기합니다.

근거: [어린이집 운영계정 기간](https://info.childcare.go.kr/info_html5/oais/introduction/Policy.jsp), [Supabase Access Token 만료 설정](https://supabase.com/changelog/38248-personal-access-tokens-expiration-usage-tracking), [Supabase API 키와 구형 키 정책](https://supabase.com/docs/guides/getting-started/api-keys), [Vercel 계정 Tokens](https://vercel.com/account/settings/tokens), [GitHub 자동 토큰 수명](https://docs.github.com/en/actions/concepts/security/github_token).

## 시설 정보의 공유 캐시

현재 결정은 **요청받은 지역의 공식 API 응답을 사용자끼리 공유 캐시**하는 방식입니다. 전국 모든 지역을 이용할 수 있도록 하되, 매일 전국 자료를 미리 수집하거나 시설용 DB 테이블을 새로 만들지 않습니다. API 키도 조회를 실행하는 Vercel에 둡니다. 지원금 정기 수집은 기존 Supabase 작업과 DB 저장을 유지합니다.

병원·약국·유치원은 현재 코드에서 24시간 공유 캐시를 사용합니다. 어린이집도 목록·지역 기본정보를 각각 24시간 캐시하며, 시설 ID로 결합해 거리 정렬 후 10곳씩 표시합니다. 기본정보에만 있는 시설은 목록에 추가하지 않고, 기본정보 조회 실패 시 목록의 실제 이름·주소·전화는 유지하며 좌표를 임의로 만들지 않습니다. XML의 예시 값·중복 ID·잘못된 지역·인증 오류는 캐시나 화면에 게시하지 않습니다. 캐시 키는 시설 종류·정규화한 지역·진료과·목록 페이지 또는 시설 ID로 구성하고 사용자·아이·가족 ID를 넣지 않습니다. ‘운영중’은 캐시한 시간표와 현재 시각·공휴일로 계산합니다.

캐시가 없으면 API를 조회하고, 오래된 캐시는 다음 요청 때 갱신합니다. 목록 페이지·상세 조회에는 각각 호출이 필요하므로 사용자 수와 별개로 실제 이용 지역·시설 수에 맞춰 API 호출량을 확인합니다. 첫 조회 지연·갱신 실패·캐시 보관 한계는 DB와 다른 특성이며, 단일 API 호출이나 무제한 조회를 보장하지 않습니다. 날씨·미세먼지는 더 짧은 캐시를 사용합니다.

2026-11-02 어린이집 운영계정용 키 재검증: 용산구 전국 목록(`cpmsapi021`)은 **81건**, 지역 기본정보(`cpmsapi030`, `arcode`만 지정)는 **82건**이 반환됐습니다. 기본정보는 정상 80건·휴지 1건·재개 1건이며 82건 모두 한국 범위의 좌표가 있습니다. 새꿈어린이집은 이름·주소·좌표가 실제 값으로 반환됐습니다. 효창방과후어린이집은 최초 개별 ID 요청의 일시적 HTTP 500 이후 재시도에서 실제 이름·주소가 정상 반환됐습니다. 두 API의 건수 차이와 상태를 보존하고 불완전 응답을 임의로 합쳐 ‘전체 정상 시설’이라고 게시하지 않습니다.

상세 규칙과 검증 상태는 [공공데이터 연결 문서](docs/implementation/public-data.md)를 참고합니다.

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

오늘의 빠른 기록과 새 먹이기 기록은 모유 수유·분유·이유식 세 가지입니다. 시작 시각을 지정하고 먹인 시간(분)을 버튼으로 선택하면 종료 시각은 자동 계산해 저장합니다. 직접 모유 수유는 시간, 분유·새 이유식 기록은 ml를 선택해 기록합니다. 기존 이유식 g 기록은 단위 그대로 보존합니다. 자주 쓰는 값과 다른 값을 선택할 수 있으며 양을 모르면 ‘양 모름’을 선택해 NULL로 저장합니다. 음식 이름 입력은 제거했습니다. 기존 기록의 시간·양이 선택 목록 밖에 있어도 현재 값으로 유지하며, 이전 음식 이름 자료는 보존합니다. 오늘 화면에서는 설정된 시간대의 오늘 기록을 보여주며, 상단에는 마지막 기저귀·식사·수면을 경과 시간으로 표시합니다. 기록 영역을 좌우로 밀면 과거 날짜의 기록과 섭취량을 확인할 수 있습니다. 마이그레이션 011로 기존 유축·유축 모유·식사 기록과 연결된 알림을 삭제하고 식사 시간 설정 컬럼도 제거했습니다. 폐기한 종류의 새 저장은 DB에서 차단합니다.

`010`은 기존 기록을 보존하면서 `amount_g`, `food_name`, `record_timezone`과 확장 저장 RPC를 추가합니다. 시간은 UTC로 저장하고 새 기록에 입력 시간대를 함께 남깁니다. 기존 기록의 미확인 시간대는 추정하지 않습니다. 2026-10-14 연결된 프로젝트에 적용했으며 통계 화면은 추가하지 않았습니다.

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

운영은 `main` → `https://podoong.com` → 기존 서울 Supabase, 개발은 `develop` → `https://dev.podoong.com` → 별도 서울 Supabase로 구분합니다. 원격 환경은 두 개이며 로컬 DB는 자동 테스트에만 사용합니다. GitHub Actions의 검사 성공 후 환경별 DB 마이그레이션·함수·Next.js 배포를 실행하도록 설정했습니다. 도메인·계정·환경별 키를 준비하고 `DEPLOYMENTS_ENABLED`를 활성화하기 전에는 실제 배포하지 않습니다. 설정 항목과 처음 연결하는 순서는 [배포 운영 문서](docs/operations/launch-and-release.md)를 따릅니다.

### 기저귀맵 공공데이터와 현재 위치

- `data/facilities/diaper-map/`에서 원본 gzip, UTF-8 변환본, 출처·해시, 표시용 catalogue를 관리합니다. `npm run data:diaper-map`으로 재생성합니다.
- 2026-11-02 행정안전부 공중화장실정보 53,578건 중 기저귀교환대 `Y`인 9,833건을 표시합니다. 시설별 자료 기준일은 목록에 표시합니다.
- 최신 자료는 좌표가 제외되어, 이름과 도로명 또는 지번 주소가 모두 일치하는 공식 표준데이터 좌표만 결합합니다. 571건에만 좌표가 있으며 나머지 시설의 거리는 추정하지 않습니다. 좌표 없는 시설도 지역 목록에는 표시됩니다.
- 오늘 화면은 HTTPS/localhost에서 나들이 기록이 진행 중이고 위치를 허용한 경우에만 주변 정보를 비동기로 표시합니다. 나들이 전에는 위치를 요청하지 않고 종료·삭제 후 주변 정보를 숨깁니다. 화면을 보고 있는 동안 5분마다, 앱으로 돌아올 때 위치와 정보를 다시 확인합니다. LAN의 일반 HTTP 주소에서는 브라우저가 위치 기능을 제공하지 않아 표시되지 않습니다. 위치를 거절하면 전체 미노출입니다.
- 위치는 DB에 보관하지 않습니다. 약국 API 공유 캐시는 약 1km 격자를 사용하며, 병원은 전국 소아청소년과 등록 목록을 24시간 공유합니다. 가까운 시설은 좌표가 있는 수집 자료 중 직선거리 20km 이내입니다.
- 미세먼지는 현재 위치에 대응하는 동네/구 이름과 일치하는 측정소만 표시합니다. 측정소정보 API는 현재 키의 승인 전이므로 무관한 측정소로 대체하지 않습니다.

기존 시설 링크 호환을 위해 기저귀맵의 내부 URL 종류 값 `kind=nursing`은 유지합니다. 사용자에게 표시되는 이름과 데이터는 기저귀맵으로 교체했습니다.
