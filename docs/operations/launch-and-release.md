# 포둥 공개 준비와 배포 운영

작성일: 2026-10-29 · 현재 판정: 공개 전 준비 필요

## 먼저 할 일

| 우선순위  | 항목                     | 현재 상태 / 완료 조건                                                                                                                                                                                                                       |
| --------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 공개 전   | 운영 HTTPS 주소와 호스팅 | 현재 사용 주소는 LAN 개발 서버다. 외부 공개용 Next.js 운영 빌드, 도메인·TLS·서버 전용 환경변수를 구성한다. 개발 서버를 인터넷에 그대로 노출하지 않는다.                                                                                     |
| 공개 전   | 개발/검증/운영 DB 분리   | 현재 로컬 앱은 실제 서울 DB에 연결된다. 개발용 서울 프로젝트를 추가하고 develop은 개발 DB, main은 기존 운영 DB로 분리한다. 로컬 자동 테스트는 로컬 Supabase만 사용한다.                                                                     |
| 공개 전   | 약관·개인정보·동의       | 법률 문서는 초안·미시행이며 미확정 항목이 남아 있다. 시행일·보관기간·위탁/국외 처리 정보를 확정하고 문서 버전별 동의·아동 정보의 법정대리인 확인·건강정보·일기 공개/공유 선택을 실제 흐름에 연결한다. 자세한 내용은 `docs/legal/README.md`. |
| 공개 전   | 로그인과 초대            | 운영 도메인을 Supabase Site URL·Redirect URLs와 제공자 설정에 등록한다. 다른 휴대폰에서 로그인→아이 등록/가족 초대→재로그인까지 실제 확인한다. 표시한 소셜 제공자만 약속하지 말고 각각 검증한다.                                            |
| 공개 전   | DB·사진 복구             | DB 백업과 Storage 파일 바이트 백업을 따로 준비한다. 격리 프로젝트에 복원하고 파일 다운로드·권한을 검증한다. 로컬 DB 복원 검증만으로 운영 사진 복구가 준비됐다고 판단하지 않는다.                                                            |
| 공개 전   | 정리·알림 작업           | 계정/사진 삭제 큐 작업자의 운영 예약과 실패 감시를 구성한다. 식사 알림은 HTTPS 및 iPhone 홈 화면 설치 상태에서 실제 수신 확인한다. 예약 활성과 단말 수신 성공은 다르다.                                                                     |
| 공개 전   | 테스트와 권한            | 운영 빌드의 핵심 흐름을 검증하고 오래된 E2E 기대값을 현재 UI에 맞춘다. 관리자·가족·공유 링크·차단/비공개·탈퇴 후 접근을 구분한다.                                                                                                           |
| 공개 전   | 실제 자료 확인           | 예시 성장일기·테스트 계정과 실제 기록을 구분한다. 자동 삭제하지 말고 운영자가 식별한 예시 자료만 정리한다. 이전 시드니 사본과 백업의 파기 일정을 확정한다.                                                                                  |
| 운영 초기 | 장애·비용 관리           | 외부 가동 확인, 서버 오류 추적, 월 비용 알림, 업로드/공유 요청 제한을 구성한다. 현재 DB 오류 수집만으로 DB 자체 장애는 감지할 수 없다.                                                                                                      |
| 운영 초기 | 관리자 인증              | 현재 사용자 결정대로 서비스 관리자 MFA는 해제했다. 공개 범위가 넓어지기 전에 재도입 여부를 검토한다. Supabase·호스팅·GitHub 운영 계정의 보안도 따로 관리한다.                                                                               |

## 확정 환경 구성 — 2026-10-29

도메인 구매: 운영자가 Cloudflare에서 `podoong.com` 구매 완료를 확인했다. 2026-10-30 Vercel `jgcman3/podoong`을 생성하고 로컬 저장소를 연결했다. 혼동되는 `podung`, `podung-h6cu` 프로젝트는 사용자 요청으로 삭제했다. GitHub 저장소는 `jgcman3/podoong`이며 로컬 origin도 변경했다. DNS 레코드 적용·환경별 키·GitHub 배포 연결·HTTPS 및 로그인 검증은 아직 완료되지 않았다.

원격 환경은 **개발·운영 두 개만** 둔다. 별도 staging/PR별 DB는 만들지 않는다. 로컬 Supabase는 자동 테스트를 위한 임시 도구로 계속 사용하며 세 번째 공개 서비스 환경이 아니다.

| 구분 | 브랜치    | 주소                      | Supabase                                  |
| ---- | --------- | ------------------------- | ----------------------------------------- |
| 개발 | `develop` | `https://dev.podoong.com` | 새 서울 프로젝트, 테스트 자료만 사용      |
| 운영 | `main`    | `https://podoong.com`     | 기존 서울 프로젝트 `atdyjsxfxlhwxmxgtnte` |

Vercel 한 프로젝트의 Preview 설정을 개발, Production 설정을 운영으로 사용한다. Vercel의 Preview는 여기서 개발 환경을 뜻하며 별도 검증 DB를 의미하지 않는다. 서버 함수는 `vercel.json`에서 서울 `icn1`로 지정한다. 정적 파일·이미지·로그의 처리 위치까지 모두 서울로 제한하는 설정은 아니다.

브랜치만 분리하면 DB가 분리되지 않는다. DB/Auth/Storage/소셜 제공자/서버 키/알림 키는 프로젝트별로 분리한다. 운영 사용자·사진은 개발에 복제하지 않는다. 개발 DB에 실제 아동 자료를 입력하는 경우 개인정보 처리 의무가 사라지는 것은 아니다.

## 자동 배포 절차

`.github/workflows/ci.yml`에 검사와 배포를 함께 둔다. PR에서는 검사만, `develop`/`main` push에서는 **타입·린트·단위·빌드·로컬 DB·E2E 검사 성공 후** 해당 환경을 배포한다. `main` 보호 규칙으로 `develop → main` PR 병합을 운영 반영 지점으로 삼는다. 다른 작업 브랜치는 검사만 실행한다.

배포는 환경별 직렬 처리하며 진행 중 DB 마이그레이션을 자동 취소하지 않는다. 다음 순서로 실행한다.

1. GitHub Environment의 연결 정보로 Vercel 환경을 가져온다.
2. `check-release-environment.mjs`로 브랜치·도메인·앱 DB·마이그레이션 대상 일치 및 개발의 운영 DB 연결 금지를 확인한다.
3. 해당 환경으로 앱을 먼저 빌드한다. 빌드 실패 시 DB를 변경하지 않는다.
4. 같은 프로젝트에 `supabase db push`로 누적 마이그레이션을 적용하고 `feeding-push` 함수를 배포한다.
5. 사전 빌드한 앱을 Vercel에 배포한다. 개발은 `dev.podoong.com` alias를 갱신하고 운영은 Production 도메인을 갱신한다.

`DEPLOYMENTS_ENABLED=true`가 설정되기 전에는 배포 job을 건너뛴다. 설정 파일을 작성했다고 실제 배포·DB 생성·브랜치 생성이 완료된 것은 아니다. 현재 작업 파일의 커밋/통합 후 그 커밋에서 `develop`을 생성하고, `main`에는 검토한 변경만 병합한다. 기존 원격 브랜치를 강제로 덮어쓰지 않는다.

처음 DB 연결 시 마이그레이션 이력을 확인한다. 현재 운영에는 058까지 적용되어 있고 059/060은 로컬에만 있다. 첫 자동 배포 활성화는 이 변경을 함께 적용하므로 SQL 검토·백업 준비 뒤 진행한다. 자동 `db reset`, 임의 `migration repair`, 운영 데이터 덤프의 개발 복원은 사용하지 않는다.

### 처음 한 번 필요한 계정·설정

1. 운영자 본인 계정으로 `podoong.com`을 구매한다. `dev.podoong.com`은 별도 구매 없이 DNS 레코드로 만든다. Vercel Domains에서 두 도메인을 추가하고 표시되는 DNS 값을 Cloudflare에 입력한다. `podoong.com`은 Production, `dev.podoong.com`은 `develop` Preview 브랜치 도메인으로 지정해 운영 배포가 개발 도메인을 가져가지 않게 한다.
2. Vercel 프로젝트를 생성하고 Node 22와 서울 함수 리전을 확인한다. Git 자동 배포는 `vercel.json`에서 끄고 GitHub Actions만 배포하게 한다. 요금제의 실제 서비스 이용 조건과 사용량 한도를 확인한다.
3. Supabase 개발 프로젝트를 서울에 생성한다. 이름 예: `podoong-development`. 운영은 기존 프로젝트를 유지한다. 초기 스키마는 마이그레이션으로 만들며 소셜 제공자 설정은 별도로 구성한다.
4. GitHub Settings → Environments에 `development`와 `production`을 생성한다. 각각 허용 브랜치를 `develop`, `main`으로 제한한다. 운영 승인 단계가 필요하면 `production` reviewer를 지정한다. 개인 저장소의 요금제에 따라 승인/보호 기능 지원 범위를 확인한다.
5. 아래 변수·비밀값을 저장하고 도메인/로그인/보관 정책·동의 절차 준비 뒤 배포를 활성화한다. 비밀값을 채팅이나 저장소 파일에 기록하지 않는다.

| 저장 위치                        | 항목                                                                                                                                                                                         |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub Repository Variables      | `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `PODUNG_PRODUCTION_PROJECT_REF=atdyjsxfxlhwxmxgtnte`; 준비 완료 후 `DEPLOYMENTS_ENABLED=true`                                                          |
| 각 GitHub Environment Variables  | `SUPABASE_PROJECT_REF`: 각 환경의 프로젝트 ID                                                                                                                                                |
| GitHub Repository Secrets        | `VERCEL_TOKEN`, `SUPABASE_ACCESS_TOKEN`: CI 전용 배포 토큰                                                                                          |
| 각 GitHub Environment Secrets    | `SUPABASE_SERVICE_ROLE_KEY`: 해당 환경의 서버 키 |
| Vercel Preview / Production 각각 | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` 또는 `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`, 실제 검증한 `NEXT_PUBLIC_AUTH_PROVIDERS` |

Vercel Preview의 SITE_URL은 `https://dev.podoong.com`, Production은 `https://podoong.com`이다. 각 Supabase의 Site URL·Redirect URLs도 해당 환경에 맞춘다. `/auth/callback`과 앱에서 사용하는 locale/next 쿼리 복귀 주소를 허용하고 두 언어로 로그인 후 복귀를 확인한다. 카카오 등의 제공자 Redirect URI는 **각 Supabase가 안내하는 `/auth/v1/callback`**이다. 네이버의 사용자 정보 어댑터 주소도 개발/운영 앱 주소로 구분한다.

푸시의 VAPID 비밀키와 발송 설정은 각 Supabase에 따로 설정한다. 함수 코드 배포만으로 이 설정이 생성되지는 않는다. [알림 초기 구성](../implementation/feeding-web-push.md)을 따른다. 개발에서는 테스트 기기만 등록한다. 삭제 작업자·백업·비용 알림 등 기존 운영 예약 작업도 환경별로 확인한다.

## 해외 공개 범위

해외 보호자도 사용할 수 있는 방향을 목표로 한다. 영어 화면과 해외 주소를 지원하지만 이를 전 세계 법령 검토 완료나 모든 국가의 출시 승인으로 표현하지 않는다. 우선 대상 국가, 성인 보호자 이용 조건, 국외 처리·권리행사·아동/건강정보 절차와 영문 문서를 확정한다. 국가별 DB는 초기 필수 구성이 아니며 서울 DB로 시작해 해외 응답시간과 전송량을 측정한다.

### DB 변경과 되돌리기

운영은 이전 앱과 새 앱이 잠시 공존할 수 있다. `컬럼/테이블 추가 → 양쪽 앱 호환 → 필요 시 백필 → 새 코드 배포 → 충분히 관찰 후 이전 컬럼 제거` 순서를 사용한다. 이름 변경·타입 변경·삭제를 한 번에 수행하지 않는다.

앱 버전 되돌리기는 DB를 되돌리지 않는다. 우선 직전 호환 앱을 재배포하고 DB는 보정 마이그레이션으로 복구한다. 운영 백업을 그대로 덮어쓰면 배포 이후 기록이 사라질 수 있으므로 마지막 수단으로 취급한다. 인덱스가 큰 운영 테이블에 추가될 때는 잠금 시간과 `CREATE INDEX CONCURRENTLY` 적용 방식을 별도로 검토한다.

## 환경 혼선 검사

`npm run env:check`는 키를 출력하거나 DB에 연결하지 않고, 개발/Preview의 운영 DB 연결과 공개 변수의 비밀키 노출 등을 차단한다. 실제 환경을 자동 전환하거나 기존 `.env.local`을 바꾸지는 않는다.

```sh
# 로컬 파일을 명시적으로 읽어 개발 환경을 확인
node --env-file=.env.local scripts/check-environment.mjs --target development --production-ref atdyjsxfxlhwxmxgtnte

# 호스팅/CI에 환경변수가 주입된 상태
npm run env:check -- --target preview
npm run env:check -- --target production
```

CI/호스팅에는 `PODUNG_PRODUCTION_PROJECT_REF`를 운영 프로젝트 ID로 설정한다. 운영 대상에는 서울 프로젝트만 허용하며, Preview(개발)에는 다른 DB와 공개 HTTPS 주소를 요구한다. Vercel의 `VERCEL_ENV`가 있으면 검사 대상과 같은지도 확인한다. 이 검사 자체가 OAuth·버킷·비밀키 소유 프로젝트의 실제 연결 검증을 대체하지 않는다.

## 운영자가 직접 결정·설정할 것

- 도메인 구매·Vercel 계정과 예산, 개발용 서울 Supabase 프로젝트 생성.
- 프로젝트별 OAuth 제공자 설정, 환경변수와 비밀키, HTTPS 주소.
- GitHub main/develop 보호·환경별 배포 권한·필요한 운영 승인 규칙.
- 법률 문서 미확정 항목과 실제 동의/법정대리인 확인 방식.
- DB 및 사진 백업 보관기간·복원 목표, 정리 작업자 예약, 장애 연락·비용 알림.

처음에는 소수 가족에게 제한적으로 검증하고, 데이터·동의·복구 절차가 준비된 뒤 공개 범위를 넓히는 방식이 적합하다. 실제 아동 자료를 받는 제한 테스트도 개인정보 처리 준비가 필요하다.

## 근거 문서

- [Supabase 환경 분리와 마이그레이션](https://supabase.com/docs/guides/deployment/managing-environments)
- [Supabase 운영 준비](https://supabase.com/docs/guides/deployment/going-into-prod)
- [DB 백업에 Storage 파일이 포함되지 않는 범위](https://supabase.com/docs/guides/platform/backups)
- [Vercel Preview/Production 환경](https://vercel.com/docs/deployments/environments)
- [Vercel 환경변수 분리](https://vercel.com/docs/environment-variables)
- [Vercel 앱 배포 롤백](https://vercel.com/docs/instant-rollback)
- [개인정보 보호법](https://www.law.go.kr/lsInfoP.do?ancYnChk=0&lsId=011357)

### Vercel Secret과 Actions 빌드

Vercel의 서버 키는 Secret 타입으로 저장해 다시 조회할 수 없게 한다. 따라서 Actions의 사전 빌드/환경 검사에 필요한 서버 키는 같은 환경의 GitHub Environment Secret `SUPABASE_SERVICE_ROLE_KEY`에도 설정한다. `vercel pull`로 Secret 원문을 다시 가져올 수 있다고 가정하지 않는다. 공개 키·사이트 주소 등 일반 설정은 Vercel Config 타입으로 관리한다. 내려받은 환경 파일과 빌드 산출물을 로그나 artifact로 올리지 않는다.

## 실제 구성 진행 상태 — 2026-10-30

- GitHub `jgcman3/podoong`에 `develop` 브랜치를 생성했다. 현재 커밋에서 생성했으며 로컬 미커밋 파일을 포함한 새 릴리스는 아직 올리지 않았다. Vercel Git 저장소 연결을 확인했다.
- Vercel의 `podoong.com`은 운영, `dev.podoong.com`은 `develop` Preview 브랜치에 등록했다. 도메인 소유권 확인과 별개로 DNS 설정 검사 결과는 아직 `misconfigured=true`다.
- Production에 서울 운영 URL·공개 키·서버 역할 키·소셜 제공자 목록·`NEXT_PUBLIC_SITE_URL=https://podoong.com`을 등록했다. 서버 역할 키는 Secret이며 개발/Preview에는 운영 키를 등록하지 않았다.
- 개발 Supabase 생성은 무료 프로젝트 2개 한도로 차단됐다. 이후 2026-10-30 운영자 승인으로 시드니 프로젝트를 삭제해 한도를 확보하고 개발 프로젝트를 생성했다.
- Cloudflare에는 아직 인증된 접근 수단이 없어 DNS를 변경하지 않았다. Vercel이 반환한 권장 값은 다음과 같다. 적용 시 Vercel Domains의 현재 값과 다시 대조한다.

| 타입  | 이름  | 값                                    | Proxy    |
| ----- | ----- | ------------------------------------- | -------- |
| A     | `@`   | `216.198.79.1`                        | DNS only |
| A     | `@`   | `64.29.17.1`                          | DNS only |
| CNAME | `dev` | `b56296d4f74499dc.vercel-dns-017.com` | DNS only |

TTL은 Auto로 설정할 수 있다. 같은 이름에 충돌하는 기존 A/AAAA/CNAME 레코드가 있으면 먼저 확인한다. 네임서버를 Vercel로 변경하지 않는다. DNS 연결 후 HTTPS·로그인 콜백·환경별 실제 DB를 확인한다.

GitHub CLI는 현재 로그인되지 않아 GitHub Environment·Variables·Secrets 설정은 아직 못 했다. 저장소/브랜치 연결과 Actions 배포 활성화를 혼동하지 않는다. `.github/workflows/ci.yml` 및 `vercel.json` 등 로컬 배포 변경은 아직 커밋·푸시 전이므로 Git 자동 배포 비활성화 설정도 원격에 반영 전이다. 처음 배포 준비가 끝날 때까지 임의 push로 앱 배포를 시작하지 않는다.

### 개발 DB 생성 완료 — 2026-10-30

- 개발 Supabase: `podoong-development`, `aacmsohijybjiyidfzgy`, 서울 `ap-northeast-2`.
- 운영 Supabase: 기존 `atdyjsxfxlhwxmxgtnte`, 서울. 이번 작업에서는 운영 스키마·자료를 변경하지 않았다.
- 개발에는 마이그레이션 001–060을 적용했고 사용자·가족·아이·돌봄·일기·사진 메타데이터 0건과 비공개 버킷 2개를 확인했다.
- 개발 Auth Site URL 및 dev/LAN callback 허용 목록, 수동 identity linking 설정을 적용했다. 소셜 제공자는 아직 미설정이다.
- Vercel `develop` Preview에 개발 URL·공개 키·서버 Secret·Site URL을 등록했다. 개발 제공자 목록은 미등록으로 비활성 상태다.
- 카카오 개발 로그인 설정 시 사용할 Supabase Redirect URI: `https://aacmsohijybjiyidfzgy.supabase.co/auth/v1/callback`. 기존 운영 콜백을 덮어쓰지 않고 추가한다. 설정·실제 로그인 확인 후 개발 Preview와 로컬에서 `kakao`를 활성화한다.

로컬 전환용 값은 커밋 제외 `.secrets/development-app.env`에 준비했다. 개발 카카오 설정과 실제 로그인 확인 전까지 기존 `.env.local` 및 루트 CLI의 운영 연결은 변경하지 않았다. 개발 DB 생성 작업은 `/private/tmp/podoong-development-bootstrap`의 별도 작업 폴더와 명시적 프로젝트 ID로 실행했다. 따라서 현재 로컬 앱이 이미 개발 DB로 전환됐다고 안내하면 안 된다.

### DNS 및 GitHub 환경 확인 — 2026-10-30

운영자가 Cloudflare 레코드를 DNS only로 변경했고 Vercel 조회에서 두 도메인 모두 `misconfigured=false`를 확인했다. 운영 A 값과 개발 CNAME도 권장값에 일치했다. 이는 DNS 검사 결과이며 실제 앱 배포·HTTPS·소셜 로그인 완료와는 다르다.

GitHub CLI 로그인을 승인받아 `development`/`production` Environment를 만들고 각각 `develop`/`main` 브랜치만 허용했다. 저장소 연결 변수와 환경별 서버 Secret을 등록했으며 `DEPLOYMENTS_ENABLED=false`로 유지했다. CI 전용 Vercel/Supabase 토큰 및 아직 미커밋인 배포 파일 반영은 별도 완료해야 한다.

CLI 2.120.0에서 운영·개발 각각 `db push --project-ref <ref> --dry-run`을 DB 비밀번호 없이 실행해 임시 CLI 로그인 역할로 접속되는 것을 확인했다. 워크플로는 명시적 프로젝트 ID로 이 방식을 사용하므로 운영 DB 비밀번호를 별도 GitHub Secret으로 요구하지 않는다. 실행 계정의 Management API 권한과 `SUPABASE_ACCESS_TOKEN`은 필요하다. 운영 dry-run은 059·060 대기만 확인했으며 적용하지 않았다.


### 개발 카카오 및 로컬 전환 — 2026-10-30

운영자가 카카오 Developers의 개발 Redirect URI 추가와 개발 Supabase의 Kakao Provider 등록을 완료했다고 확인했다. 개발 Auth settings에서 카카오 활성화와 실제 인가 요청의 `kauth.kakao.com` 302·개발 Supabase callback·`profile_nickname` 단독 scope를 확인했다. Vercel develop Preview의 제공자 목록을 `kakao`로 활성화했다.

`.env.local`과 루트 Supabase CLI는 이제 개발 `aacmsohijybjiyidfzgy`를 가리킨다. 로컬 Site URL은 기존 LAN 주소를 유지한다. 기존 운영 환경은 커밋 제외 비공개 `.secrets/production-app.env`에 보관했다. 앞의 ‘로컬 미전환’ 상태는 이 시점부터 해소됐다. 개발에서는 별도 계정/아이를 등록하므로 기존 운영 자료가 보이지 않는 것이 정상이다. 실제 카카오 계정의 최종 로그인 성공과 이메일 미제공 사용자 허용 여부는 사용자 기기에서 확인한다.

Actions용 전용 토큰 `VERCEL_TOKEN`, `SUPABASE_ACCESS_TOKEN`은 사용자가 각 계정에서 발급해 GitHub Repository Secrets에 등록하도록 요청했다. 기존 CLI 로그인과 Actions 실행 서버의 인증은 별개이며 토큰을 채팅·Git에 남기지 않는다. 토큰 준비 전에는 자동 배포 비활성 상태를 유지한다.


### 초기 전체 브라우저 검사 정리

전체 검사에서 예전 게시판 홈, 날짜 좌우 이동, 오늘 화면의 일정/할 일 등 폐기한 화면을 기대하는 테스트가 남아 있음을 확인했다. 현재 동네 생활·세로 기록·캘린더 전용 일정에 맞춰 시나리오를 갱신하며, 직접 접근 가능한 기존 게시글의 댓글/사진 권한 검증은 유지한다. 먹인 소요시간이 선택값인 기록은 종료 시각이 없어도 기록된 ml를 집계하므로 통계 테스트도 이를 반영한다.

검사 중 실제로 발견한 투표·게시글 사진/댓글 저장 후 라우터 캐시가 즉시 갱신되지 않는 문제는 해당 경로의 `revalidatePath`로 수정했다. 투표 폼은 저장된 선택값에 맞춰 초기화하도록 키를 부여했다. 전체 E2E 완료 전에는 통과했다고 보고하지 않는다. Actions에는 Safari 관련 WebKit 검사를 위해 Chromium과 WebKit을 함께 설치한다.


### CI 토큰 등록 및 접근 검사 완료 — 2026-10-30

운영자가 Repository Secrets에 `VERCEL_TOKEN`, `SUPABASE_ACCESS_TOKEN`을 등록했고 이름만 조회해 확인했다. `.github/workflows/deployment-access.yml`을 작업 브랜치에 별도 커밋·푸시해 GitHub 실행 서버에서 Vercel `podoong` 프로젝트와 개발·운영 Supabase 프로젝트, 연결 풀, Edge Functions의 조회를 모두 검증했다.

검사 실행: https://github.com/jgcman3/podoong/actions/runs/41029731952 . 이 워크플로는 조회만 하며 앱 배포·DB 마이그레이션·함수 배포를 수행하지 않는다. 조회 성공이 쓰기 권한 및 실제 배포 성공을 증명하지는 않는다. 비밀값·API 응답 원문은 로그나 artifact에 남기지 않는다.

`DEPLOYMENTS_ENABLED=false`는 유지한다. 현재 로컬 앱·DB 검증과 오래된 브라우저 테스트 정리가 진행 중이며, 배포용 전체 변경과 CI 워크플로는 아직 원격 `develop`/`main`에 반영하지 않았다. 이번 접근 검사 파일의 푸시만으로 사이트가 배포되었다고 안내하지 않는다.


### 개발 배포 검사 준비 — 2026-10-30

로컬 단위 테스트 143개, 린트·타입 검사와 갱신한 브라우저 시나리오를 순차 검증했다. 사용자 설정을 기다리는 상태가 아니며, 현재 UI와 다른 테스트 기대값을 수정했다. 설정의 추가 섹션·해외 주소 입력·일기 작성자 표시를 반영하고, 스크롤 중 위치 측정과 더보기 렌더링 완료를 구분했다. 화면 캡처는 caret 원본 상태를 유지해 React hydration 전에 Playwright가 입력 요소의 inline style을 바꾸지 않도록 했다.

이제 전체 코드를 개발 브랜치로 반영해 원격 CI를 실행한다. 로컬에서 나누어 통과한 시나리오를 전체 CI 성공으로 표현하지 않는다. 운영 마이그레이션 059/060과 운영 앱 공개는 이번 개발 배포와 구분한다.
