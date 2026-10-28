# 화면 전환과 데이터 조회

## 변경 사항 (2026-10-27)

- 하단 메뉴와 PC 메뉴는 Next.js Link의 전환 상태를 즉시 표시한다. 배포 모드에서는 메뉴 목적지를 미리 불러온다. 개발 모드에는 동일한 사전 로딩이 적용되지 않는다.
- `family_access_context`는 가족, 구성원, 보호자, 소유자 여부, 쓰기 권한을 하나의 요청으로 반환한다. 기존 5개 HTTP 요청을 1개로 줄이며 RLS와 아이 접근 검사를 유지한다.
- `loadFamily`의 React `cache`는 동일한 서버 렌더 요청 안에서만 중복 호출을 합친다. 사용자 간 데이터나 권한을 공용 캐시에 보관하지 않는다.
- 로그인 사용자 확인 후 토큰 정보와 계정 상태는 병렬 확인한다.
- 인사이트는 현재 기간의 기능별 집계를 클라이언트에 전달한다. 기능 선택, 같은 기간의 하루·주간·일단위 통계 전환은 브라우저에서 처리한다. URL과 뒤로 가기, 아이 변경 시 선택 상태를 유지한다.
- 다른 기간이나 아직 받지 않은 6주 통계, 성장·발달 정보는 서버에서 새로 조회한다. 저장은 기존 서버 권한 검사와 갱신 경로를 유지한다.

## 검증

```sh
npm run test:local -- --grep 'insight presentation changes|menu navigation responds'
PODUNG_TEST_PRODUCTION=1 npm run test:local -- --grep 'insights supports|insight presentation changes'
npx supabase test db supabase/tests/family_access_context.test.sql
```

브라우저 테스트는 표시 변경으로 인한 인사이트 서버 요청이 0회인지, 기간 변경 시에는 조회하는지 검사한다. 메뉴 사전 로딩 요청은 별도이며, 전환 피드백은 응답을 지연시킨 상태에서 검사한다. DB 테스트는 조회 전용, 접근 권한 회수, 다른 아이, 익명 접근을 검사한다.

배포 모드 테스트는 로컬 Supabase와 별도 `.next-e2e`/3188 포트를 사용한다. 이 결과는 실제 모바일·원격 Supabase의 전환 시간 측정을 대체하지 않는다. 개발 서버 3187의 출력 디렉터리는 사용하지 않는다.

## 최근 메뉴 재사용 — 2026-10-28

클라이언트 라우터의 dynamic/static 재사용 시간을 30초로 설정했습니다. 개인 데이터는 서버 공용 캐시에 저장하지 않습니다. 기록 저장·삭제의 revalidatePath를 유지하며, 아이/가족 변경 시 locale layout을 갱신합니다. 다른 보호자가 바꾼 자료는 재조회 시 반영되므로 캐시 기간에는 최대 30초의 차이가 있을 수 있습니다.

오늘 페이지는 QuickTimeline에서 이미 읽는 care_records를 loadCare에서 중복 조회하지 않습니다. 과거 날짜 조회는 인증·아이 접근권한 확인을 유지한 GET /api/care/history로 분리하고 응답은 private, no-store로 제공합니다.

배포 빌드에서 메뉴 재방문, 기록 저장, 과거 날짜 조회 3개 동선을 검증했습니다. 반복 재방문 측정은 페이지 RSC 요청 0회, 화면 표시 약 59ms였습니다. 개발 서버는 별도의 컴파일/HMR 비용과 재요청이 있어 동일한 속도를 보장하지 않습니다. 회귀 검증: PODUNG_TEST_PRODUCTION=1 npm run test:local -- --grep 'returning to today reuses'.
