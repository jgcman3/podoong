# 운영 배포 전 점검과 리소스 위치

점검일: 2026-11-03 · 판정: 개발 배포 가능, 운영 공개 전 필수 준비 남음

이 문서는 2026-10-31 점검의 후속이다. 아래 확인은 조회와 저장소 검사에 기반하며 운영 DB·운영 앱은 변경하지 않았다. 과거 날짜별 기록보다 이 문서의 현재 상태를 우선한다.

## 확인한 상태

- 개발은 `develop` → `dev.podoong.com` → 서울 Supabase `aacmsohijybjiyidfzgy`, 운영은 `main` → `podoong.com` → 서울 Supabase `atdyjsxfxlhwxmxgtnte`다. Vercel 프로젝트는 `jgcman3/podoong` 하나이며 Preview/develop과 Production으로 나눈다.
- GitHub `DEPLOYMENTS_ENABLED=true`. application/integration 성공 후에만 배포된다. Vercel 자체 Git 자동 배포는 꺼져 있다. 작업 브랜치 푸시만으로 개발 배포되지 않는다.
- 운영 DB는 058까지, 저장소와 개발 릴리스는 086까지다. 운영 반영 대상은 **059–086, 총 28개 마이그레이션**이며 운영자가 입력한 자료를 유지한 채 적용 가능한지 사전 검토해야 한다. 운영에 `db reset`을 실행하지 않는다.
- 운영에는 비공개 사진 버킷 2개와 서비스 관리자 1명이 있다. 점검 시 사진 삭제 큐는 0건이었다. 큐가 비었다는 사실이 정기 작업자 구성을 증명하지 않는다.
- 개발 DB는 086까지 적용됐고 사진 삭제 대기 29건, 서비스 관리자 0명이다. 개발 사이트에서 관리자 화면을 시험하려면 개발 계정의 UID로 별도 지정해야 한다. 운영 관리자 UID를 개발에 그대로 가정하지 않는다. 대기 파일을 자동 정리할 작업자 구성은 개발에도 필요하다.
- 운영 `feeding-push` 함수 ACTIVE, 푸시 설정과 VAPID 공개/비밀키 존재, 매분 `podung-feeding-push` 예약을 확인했다. 실제 기기 수신 성공·최신 함수 반영을 증명하지는 않는다.
- main 브랜치 보호와 활성 Ruleset은 없다. GitHub Environment는 허용 브랜치를 제한하지만 reviewer 규칙은 없으므로 main 직접 푸시를 막지 않는다.
- 좋아요는 `growth_diary_likes`와 권한 검사 RPC로 저장한다. 로그인한 계정당 일기별 한 번이며 취소할 수 있다. 목록은 최대 20건을 한 번에 집계하며 공유 링크는 허용된 공개 일기의 합계만 반환하고 사용자 목록은 노출하지 않는다.
- 이번 공개 사진 수정은 다른 계정의 공개 권한을 RPC로 확인한 뒤 서버가 승인된 사진 경로만 읽는다. 개발 DB의 실제 공개 사진을 로컬 서버에서 다른 임시 계정으로 요청해 HTTP 200과 이미지 디코딩을 확인했고 임시 계정은 삭제했다. 비공개 전환 후 ETag를 보내도 404인지 로컬 통합 검사로 확인했다.

## 로그인·브랜치 설정 추가 확인 — 2026-11-03

환경별 Vercel 설정을 비공개 임시 파일로 조회한 뒤 삭제했다. 개발은 `dev.podoong.com`과 개발 Supabase, 운영은 `podoong.com`과 운영 Supabase에 연결돼 있음을 재확인했다. 두 환경의 활성 표시 목록은 `kakao`뿐이다.

| 항목   | 개발                                    | 운영                                    |
| ------ | --------------------------------------- | --------------------------------------- |
| Kakao  | 활성, 인가 요청이 카카오로 302 이동     | 활성, 인가 요청이 카카오로 302 이동     |
| Google | Supabase 비활성, 인가 요청 400          | Supabase 비활성, 인가 요청 400          |
| Naver  | `custom:naver` 인가 요청 400, 사용 불가 | `custom:naver` 인가 요청 400, 사용 불가 |

Google/Naver의 앱 연결 코드는 있지만 제공자 설정과 실제 계정 로그인 검증은 완료되지 않았다. 각 제공자의 앱 등록·Client ID/Secret·Callback 설정을 마친 뒤 Supabase 개발에서 검증하고 운영에 별도로 설정한다. 실제 검증 전에는 `NEXT_PUBLIC_AUTH_PROVIDERS`에 추가하지 않는다. 키 값은 채팅·문서에 남기지 않는다.

CI/CD는 브랜치의 실제 파일과 준비된 코드를 구분한다. 최신 `develop`에는 application/integration 성공 후 해당 환경의 DB·함수·Vercel을 배포하는 분기가 있다. **현재 원격 `main` 커밋 `1461e80`에는 CI 검사만 있고 deploy job과 `vercel.json`은 없다.** 따라서 운영 CD 코드는 준비돼 있지만 main 반영과 첫 실제 운영 배포 검증은 미완료다. GitHub의 운영 환경과 배포 인증은 구성돼 있다.

현재 배포 활성 변수가 true이므로 최신 워크플로가 포함된 develop을 main에 병합하면 검사 성공 후 운영 DB 마이그레이션과 앱 배포가 실행된다. 운영 준비가 끝나기 전에 단순 코드 동기화 목적으로 main에 병합하지 않는다. 이번 확인에서는 브랜치·환경·제공자 설정을 변경하지 않았다.

## 운영 공개 전에 끝낼 일

| 우선순위  | 남은 일                    | 완료 기준과 담당                                                                                                                                                                                                                                                                                                       |
| --------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 필수      | Google·Naver 로그인        | 개발·운영 제공자 앱/Callback/Secret 등록, Google 기본 제공자와 Naver Custom OAuth2 설정, 실제 신규 가입·재로그인·계정 연결·동의/초대 복귀 검증 후 버튼 활성화. 현재 두 환경 모두 미완료다.                                                                                                                             |
| 필수      | 정식 문서·동의             | 현재 `signup-2026-11-03-draft.2`은 개발 초안이다. 운영자가 시행일·제공 국가·보관기간·공개 정책을 결정하고, 개발자가 정식 문서 버전과 필요한 항목별 동의·철회·증빙 흐름을 연결한다. 아동 대리권·건강정보·사진 공개/공유·국외 처리의 미확정 범위는 `docs/legal/README.md`에 남아 있다. 법률 검토 완료로 표시하지 않는다. |
| 필수      | 실제 정책과 문서 범위 일치 | 삭제한 나눔/장터·동네 신청 등 과거 문구와 실제 제공 기능을 대조한다. 한국어 초안의 빈칸과 영문 전문 준비도 함께 마무리한다. 개발용 문안을 그대로 정식 약관으로 배포하지 않는다.                                                                                                                                        |
| 필수      | 운영 릴리스 사전 검토      | 059–086 SQL, 데이터 삭제/제약 변경 및 기존 운영 자료 영향을 검토한다. DB·사진 백업 확보 후 검증된 develop을 main PR로 반영하고 CI를 통과시킨다. 운영 DB를 개발 DB로 덮어쓰지 않는다.                                                                                                                                   |
| 필수      | DB와 사진 복구             | 정기 DB 백업과 두 Storage 버킷 파일 바이트 백업, 암호화 보관·만료·복원 목표를 정하고 격리 복원으로 권한·사진 다운로드·삭제 이력 재적용을 검증한다. 현재 운영 복원 완료 증거가 없다.                                                                                                                                    |
| 필수      | 정기 삭제 작업자           | `scripts/process-operations.mjs`를 보안 환경변수로 주기 실행하고 실패·적체 감시를 연결한다. 저장소 CI에는 예약 실행이 없다. 외부 예약도 이번 점검에서 확인되지 않았다. 푸시 Cron은 사진/Auth 삭제 작업자가 아니다.                                                                                                     |
| 필수      | 배포 보호                  | main 직접/강제 푸시·삭제 차단, PR 및 application/integration 검사 요구를 구성한다. 혼자 운영할 경우 본인 승인 불가로 배포를 막는 규칙은 피하고 실제 계정 플랜에서 지원되는 보호를 적용한다.                                                                                                                            |
| 필수      | 운영 실기기 검증           | Kakao 신규 가입·문서 동의·초대·가족 병합, 기록 수정/삭제, 사진 업로드·공개·비공개·공유 해제, 탈퇴/삭제를 합성 자료로 확인한다. iPhone 설치·알림, Android 설치·알림, Kakao 내장 브라우저 안내을 실제 단말에서 확인한다.                                                                                                 |
| 운영 초기 | 장애·비용·보안             | 외부 가동 점검, 서버 오류/삭제 적체 연락 경로, Vercel/Supabase 용량·전송량 예산 알림과 플랜 적합성을 확인한다. DB 내부 오류 수집만으로 DB 전체 장애를 감지할 수 없다. 인프라 계정 MFA·복구 수단도 확인한다. 서비스 관리자 MFA는 기존 결정대로 요구하지 않는다.                                                         |
| 운영 초기 | 운영자 업무 절차           | `/ko/admin`의 요청·신고·오류 확인 주기와 처리 담당, 개인정보 요청 접수/삭제/백업 재노출 방지 절차를 확정한다. 기존 운영 자료와 테스트 자료를 식별 없이 일괄 삭제하지 않는다.                                                                                                                                           |

## 중요한 리소스 위치

| 리소스             | 위치 / 관리 방법                                                                                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 소스·브랜치·검사   | GitHub `jgcman3/podoong`, 개발 `develop`, 운영 `main`, `.github/workflows/ci.yml`. 실행 기록은 저장소 Actions.                                                                           |
| 호스팅·도메인 연결 | Vercel `jgcman3/podoong` → Deployments / Settings → Domains. 개발 Preview/develop, 운영 Production. 서버 리전은 `vercel.json`의 `icn1`.                                                  |
| 도메인 소유·DNS    | Cloudflare → podoong.com → DNS. 레코드는 DNS only로 관리하며 실제 변경 시 Vercel Domains의 현재 권장값과 대조한다.                                                                       |
| DB·로그인·사진     | Supabase 개발/운영 프로젝트. Database·Authentication·Storage·Logs 각각 확인. 버킷 `child-care-photos`는 아이 사진/일기, `community-photos`는 게시글 사진이며 둘 다 비공개.               |
| 운영자 화면        | `/ko/admin` 또는 `/en/admin`. 권한은 해당 DB의 `service_admins`; 가족 관리자와 별개다.                                                                                                   |
| 앱/API 키          | Vercel → Settings → Environment Variables. 공개 앱 설정, 해당 DB 서버 키, Preview/develop과 Production을 분리한다.                                                                       |
| 소셜 제공자 비밀값 | 각 Supabase → Authentication → Providers. Kakao Developers에는 각 프로젝트의 Auth callback을 등록한다.                                                                                   |
| 푸시 키·예약       | 각 Supabase → Edge Functions → Secrets의 `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`; `feeding-push` 함수, `feeding_push_config`, Vault, Cron `podung-feeding-push`.                   |
| 배포 인증          | GitHub Repository Secrets의 `VERCEL_TOKEN`, `SUPABASE_ACCESS_TOKEN`; Environment development/production Secrets의 `SUPABASE_SERVICE_ROLE_KEY`. 실제 값은 문서·로그·커밋에 남기지 않는다. |
| 배포 대상 식별     | GitHub Variables의 `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `PODUNG_PRODUCTION_PROJECT_REF`, 환경별 `SUPABASE_PROJECT_REF`.                                                                 |
| 로컬 설정          | `.env.local`이 로컬 앱 설정. `.secrets/development-app.env`, `production-app.env`, `development-push.env`는 비공개 보관본이며 수정만으로 원격 반영되지 않는다.                           |
| 기능 코드          | `src/features/community/` 게시판·놀이터, `growth-community/` 일기·사진·공유, `care/` 돌봄 기록.                                                                                          |
| 앱 설치·시작 화면  | `public/icons/`, `public/splash/v1/`, `src/components/app-splash.tsx`. iPhone 시작 이미지 재생성은 `npm run assets:splash`; 설치/실행의 OS별 최종 표시는 실기기 검증한다.                |
| 스키마·검증        | `supabase/migrations/`, `supabase/tests/`, `tests/unit/`, `tests/e2e/`. 운영 DB 수정은 검토한 마이그레이션으로만 진행한다.                                                               |
| 문서·절차          | `docs/legal/` 약관·미확정 정책, `docs/operations/data-and-backup.md` 삭제·복구, `docs/implementation/feeding-web-push.md` 알림, README의 키 위치/갱신 표.                                |

## 권장 다음 순서

1. 운영 정책과 출시 범위를 결정하고 정식 동의·문서 흐름을 마무리한다.
2. main 보호, 정기 삭제 작업자와 장애 감시를 구성한다.
3. 운영 DB·사진 백업/복구를 확인하고 059–086 적용 계획을 검토한다.
4. develop → main PR로 운영 릴리스한 뒤 실제 단말에서 핵심 흐름을 검증하고 공개 범위를 넓힌다.

이번 요청은 개발 서버 배포와 운영 준비 정리다. 이 문서 작성으로 정식 운영 공개·약관 시행·운영 DB 변경을 승인받은 것으로 처리하지 않는다.
