# 홈 화면에 추가

2026-10-27 · 수정 2026-10-31

- 계정 설정과 소개 페이지에서 설치 버튼을 제공합니다. 아이폰·안드로이드는 `홈 화면에 추가`, PC는 `앱으로 설치`로 표시합니다.
- `beforeinstallprompt`를 지원하는 브라우저에서는 사용자가 버튼을 누를 때 설치 창을 엽니다. 이벤트는 언어별 공통 레이아웃에서 보관해 메뉴 이동 후에도 사용할 수 있습니다.
- 설치 창을 닫거나 취소하면 이벤트를 재사용하지 않습니다. `appinstalled` 또는 standalone 실행 상태에서는 버튼을 숨깁니다.
- iPhone/iPad에서는 공유 메뉴의 홈 화면 추가와 웹 앱으로 열기를 안내합니다. 지원하지 않는 브라우저는 메뉴 설치 방법을 안내합니다. HTTP 개발 주소에서는 설치 제한을 표시합니다.
- `/manifest.webmanifest`는 `display: standalone`, 루트 scope/start URL을 사용합니다. 기존 언어 선택 및 로그인 경로를 거쳐 오늘 화면으로 이동합니다. 앱 아이콘은 사용자가 제공한 포둥 아기 이미지로 통일했습니다.
- HTTPS 배포 후 실제 iOS/Android 설치 및 카카오 로그인 왕복을 확인해야 합니다. 안내와 브라우저 이벤트 처리는 자동 검증했지만, OS 설치 완료를 테스트한 것은 아닙니다.
- 이 작업은 서비스 워커나 오프라인 데이터 캐시를 추가하지 않습니다. 서버의 가족 기록과 인증 응답은 기존 방식으로 요청합니다.

참고: [설치 이벤트](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeinstallprompt_event), [Apple 홈 화면 웹앱](https://support.apple.com/ko-kr/guide/iphone/iphea86e5236/ios).

## 공통 브랜드 이미지 (2026-10-29)

원본은 `public/brand/podung.png`에 보관하고 `BrandImage` 컴포넌트로 로그인·가입·초대·PC 메뉴·공유 일기와 공유 종료 화면에서 함께 사용합니다. 화면에는 Next Image가 필요한 크기로 최적화한 파일을 표시합니다. 앱/Apple Touch/푸시 아이콘은 같은 이미지의 180·192·512px 파일을 사용하며, 공유 링크 미리보기도 원본 브랜드 이미지를 참조합니다. 기존 둥지 SVG 컴포넌트와 사용하지 않는 SVG 아이콘은 제거했습니다.

투명한 전체 PNG로 원본과 아이콘을 교체했으며 화면 이미지는 `object-fit: contain`, 모서리 자르기 없이 표시합니다. 로그인 이미지 위로 겹치던 문구는 아래로 옮겼습니다. 아이콘 URL에는 `v=full-20261029`를 붙여 변경 파일의 재사용을 줄입니다. 기존 설치 아이콘의 즉시 교체는 기기/브라우저가 결정하므로 iPhone에서는 홈 화면 아이콘 제거 후 다시 추가가 필요할 수 있습니다. 서버에 저장한 기록은 유지되지만 재로그인·알림 재설정이 필요할 수 있습니다. Maskable 아이콘은 OS가 잘라도 캐릭터가 가려지지 않도록 별도의 안전 여백을 둡니다.

## 기기별 설치·알림 안내 (2026-10-31)

`devicePlatform`으로 iPhone/iPad(데스크톱 UA iPad 포함), Android, Mac Safari, 일반 PC를 구분합니다. 설치 팝업과 알림 설정은 공통 `DeviceGuide`를 사용하며 한글·영어를 제공합니다.

- iPhone/iPad: Safari 공유 → 홈 화면에 추가 → 웹 앱으로 열기 → 추가한 아이콘 실행 → 포둥에서 알림 켜기와 권한 허용. 웹 푸시는 iOS/iPadOS 16.4 이상이 필요합니다.
- Android: Chrome 메뉴의 홈 화면에 추가/앱 설치. 알림은 설치 없이도 지원 브라우저에서 권한을 허용하면 이용할 수 있습니다. 사이트 권한과 Android의 브라우저 알림 설정을 안내합니다.
- PC Chrome/Edge: 주소창 설치 아이콘 또는 브라우저 설치 메뉴. 설치는 알림의 필수 조건이 아닙니다. 브라우저 사이트 권한과 운영체제 알림 설정을 함께 확인합니다.
- Mac Safari: macOS Sonoma 이상에서 파일 → Dock에 추가. 설치 메뉴가 없는 환경에는 Chrome/Edge를 안내합니다. Safari의 웹 푸시 지원과 Dock 웹앱의 설치 조건은 구분합니다.

지원 기능은 실제 Push API·보안 접속·권한 상태로 판단합니다. 기기 분류만으로 알림 가능하다고 가정하지 않습니다. 설치가 끝나도 알림 권한을 자동 요청하지 않으며 사용자가 별도로 켭니다.

출처: [Apple iPhone 설치](https://support.apple.com/ko-kr/guide/iphone/iphea86e5236/ios), [Apple Mac 웹앱](https://support.apple.com/en-gb/104996), [Apple 웹 푸시](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers), [Chrome 웹앱](https://support.google.com/chrome/answer/9658361), [Chromium 웹사이트 알림](https://blog.chromium.org/2015/04/reaching-and-re-engaging-users-on.html).

## 이미지 안내와 소개 버튼 (2026-10-31)

소개 페이지의 설치 버튼은 가입 버튼 아래에 간격을 둔 보조 버튼으로 표시합니다. 설치 안내창은 소개 영역 바깥에 포털로 표시해 버튼·문단 서식이 섞이지 않게 합니다. 기기별 설치 3단계와 알림 허용 이미지를 한글·영어로 제공하고, 긴 내용은 본문만 스크롤해 확인 버튼을 유지합니다. 이미지는 실제 포둥 화면과 브라우저 메뉴 재현을 합친 안내 이미지이며 실기기 OS 캡처로 표시하지 않습니다. 파일·생성 방법은 [소개 페이지 이미지 기록](introduction-assets.md)을 참고하세요.
