# Pigeon Attack p5.js Game

웹캠과 ml5 FaceMesh를 사용하는 p5.js 기반 미니게임입니다.

## 실행

로컬 서버에서 열어야 카메라 권한이 정상 동작합니다.

```bash
python3 -m http.server 5173
```

브라우저에서 `http://127.0.0.1:5173`으로 접속하세요.

## 구조

- `index.html`: 앱 진입점 및 CDN 스크립트 로드
- `src/main.js`: 전역 상태, 화면 전환, 로컬 로그인/순위표 저장
- `src/screens/`: 화면별 UI
- `src/game/`: p5.js 게임 오브젝트와 FaceMesh 컨트롤러
- `src/styles/global.css`: 전체 UI 스타일

## 참고

Firebase 연동은 현재 제외되어 있으며, 로그인과 순위표는 `localStorage` 기반으로 동작합니다.
