# 홈 화면에 추가

2026-10-27

- 전체 서비스와 계정 설정에서 `홈 화면에 추가` 버튼을 제공합니다.
- `beforeinstallprompt`를 지원하는 브라우저에서는 사용자가 버튼을 누를 때 설치 창을 엽니다. 이벤트는 언어별 공통 레이아웃에서 보관해 메뉴 이동 후에도 사용할 수 있습니다.
- 설치 창을 닫거나 취소하면 이벤트를 재사용하지 않습니다. `appinstalled` 또는 standalone 실행 상태에서는 버튼을 숨깁니다.
- iPhone/iPad에서는 공유 메뉴의 홈 화면 추가와 웹 앱으로 열기를 안내합니다. 지원하지 않는 브라우저는 메뉴 설치 방법을 안내합니다. HTTP 개발 주소에서는 설치 제한을 표시합니다.
- `/manifest.webmanifest`는 `display: standalone`, 루트 scope/start URL을 사용합니다. 기존 언어 선택 및 로그인 경로를 거쳐 오늘 화면으로 이동합니다. 앱 아이콘은 기존 포둥 둥지 SVG를 기반으로 생성했습니다.
- HTTPS 배포 후 실제 iOS/Android 설치 및 카카오 로그인 왕복을 확인해야 합니다. 안내와 브라우저 이벤트 처리는 자동 검증했지만, OS 설치 완료를 테스트한 것은 아닙니다.
- 이 작업은 서비스 워커나 오프라인 데이터 캐시를 추가하지 않습니다. 서버의 가족 기록과 인증 응답은 기존 방식으로 요청합니다.

참고: [설치 이벤트](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeinstallprompt_event), [Apple 홈 화면 웹앱](https://support.apple.com/ko-kr/guide/iphone/iphea86e5236/ios).
