# 소개 페이지 이미지와 설치 안내

수정일: 2026-10-31

## 성장일기 예시 이미지

실제 사용자 사진이나 포둥 브랜드 캐릭터를 재사용하지 않고, 내장 `image_gen` 도구로 서로 다른 가상 아이 두 명을 생성했다. 생성 PNG는 원위치에 보존하고, 서비스에는 가로 512px WebP로 최적화한 파일을 넣었다.

- `public/illustrations/diary-baby-boy.webp`: 곱슬머리, 초록색 멜빵옷의 가상 아이.
- `public/illustrations/diary-baby-girl.webp`: 옆으로 넘긴 머리, 작은 리본, 아이보리 옷의 가상 아이.

소개 페이지의 예시 카드에서만 사용한다. 실제 아이 자료와 연결되지 않는다. 브랜드 이미지와 앱 아이콘은 기존 포둥 이미지를 유지한다.

### 최종 생성 프롬프트

첫 번째 이미지:

> Use case: stylized-concept. Asset type: fictional baby portrait for an example growth diary card on podoong parenting website. Create a polished warm 3D animated-family-film style illustration of one fictional infant boy, round friendly face, short soft curly dark brown hair, curious smile, wearing muted sage green cotton overalls over an ivory shirt. Seated upper body portrait facing camera, hands visible, natural baby proportions, clean soft oatmeal studio background, diffuse warm daylight, refined soft textures, uncluttered composition, square image, generous margin around entire head and torso. Entire head visible. No text, no letters, no logo, no border, no watermark. The subject must be a distinct new fictional character, not the existing podoong mascot with straight bangs and pink top.

두 번째 이미지:

> Use case: stylized-concept. Asset type: fictional baby portrait for a second example growth diary card on podoong parenting website. Create a polished warm 3D animated-family-film style illustration of one fictional infant girl, round friendly face, sparse soft light brown wispy hair swept sideways with a tiny muted peach fabric bow, bright eyes, joyful open-mouth smile, wearing an ivory ribbed onesie with a subtle small peach collar. Upper body portrait slightly turned three-quarter, natural baby proportions, clean pale warm beige studio background, diffuse daylight, refined soft textures, uncluttered composition, square image, generous margins, entire head and shoulders visible. No text, no letters, no logo, no border, no watermark. The subject must be a distinct new fictional character, not the existing podoong mascot with straight dark bangs and pink top, and not a boy with curly hair and green overalls.

## 설치 및 알림 안내 이미지

`public/guides/install/v1/`에 아이폰·안드로이드·PC Chrome/Edge·Mac Safari의 한글·영어 안내 이미지 32개를 저장했다. 각 환경별 1–3번은 설치 과정, 4번은 알림 허용 안내다.

이 이미지는 **로그인하지 않은 실제 포둥 소개 페이지 캡처와 코드로 재현한 브라우저 메뉴**를 합친 안내 화면이다. 실기기의 OS 메뉴를 캡처한 것으로 표시하지 않는다. 화면과 설명에 재현 이미지이며 브라우저 버전별 차이가 있음을 명시한다. 실제 사용자 계정·아이 사진·가족 자료를 캡처하지 않는다. 개발자 표시도 숨긴다.

재생성:

```sh
npm run dev
node scripts/capture-install-guide.mjs
```

기본 캡처 주소는 `http://127.0.0.1:3187`이다. 로컬 주소만 허용하며 클라우드 계정이나 로그인 정보를 사용하지 않는다. 이미지 파일은 WebP로 최적화한다. 설치 안내는 한 단계씩 넘겨보고, 알림 설정 안내는 별도로 펼칠 수 있다. 안내창은 `document.body`에 배치해 소개 페이지 버튼·문단 스타일이 섞이지 않게 한다. 긴 안내가 스크롤되어도 하단 확인 버튼을 유지한다.

메뉴 참고: [Chrome Android](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=ko), [Chrome PC](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DDesktop&hl=ko), [Apple iPhone](https://support.apple.com/ko-kr/guide/iphone/iphea86e5236/ios), [Apple Mac](https://support.apple.com/en-gb/104996).
