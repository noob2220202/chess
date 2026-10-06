# 증강전 · Augment Arena

체스에 **증강 카드 드래프트**를 더한 전략 게임입니다. 매 판 내 0·10·20번째 수에 오프닝/미들게임/엔드게임 카드 3장 중 1장을 고르고, 체크 없이 **상대 킹을 잡으면 승리**합니다. 레이팅전은 **미러 드래프트 + Glicko-2**로 운보다 실력이 드러나도록 설계했습니다.

- 웹 PWA (설치 가능, 오프라인 AI전·튜토리얼·카드 백과 지원)
- 리체스풍의 깔끔한 화면 + 체스닷컴풍 기능: 사이드바, 빠른 대전 타일, 대시보드, 기보(아이콘 표기)·지난 국면 보기, 잡은 기물·점수 차, 우클릭 화살표, 효과음, 보드 테마 5종, 다크/라이트
- 튜토리얼은 다음에 할 일을 자동으로 찾아 반짝이며 안내 (해답 탐색기 기반)
- 자체 제작 카드 60장 (각 카드마다 실제 보드에서 해보는 데모)
- 튜토리얼 7개 레슨 (22단계, 모두 실제 보드에서 진행)
- AI 3단계 (웹 워커에서 동작)
- 온라인 레이팅전/일반전: 서버가 모든 수와 시계를 검증 (치팅 방지)

## 구조

| 폴더 | 내용 |
|---|---|
| `engine/` | 순수 TypeScript 규칙 엔진 (의존성 없음). 기물/카드/드래프트/봇/시뮬레이터. 서버·웹 공용 |
| `server/` | Node HTTP + WebSocket 서버. 계정, 매칭, 권위 대국 처리, 시계, Glicko-2, Postgres |
| `web/` | Vite + React PWA |
| `docs/` | 원작 분석, 카드 분류, 밸런스 리포트 |
| `data/`, `tools/` | 원작 카드 카탈로그 분석 자료 (앱에는 사용하지 않음) |

## 개발

Node **22.18 이상** 필요 (TypeScript를 빌드 없이 바로 실행합니다).

```bash
npm run setup          # 세 패키지 의존성 설치
npm test               # 엔진 85 + 서버 18 + 웹 25 테스트
npm run typecheck

# 터미널 1: API 서버 (DATABASE_URL 없으면 메모리 저장소로 동작)
DATABASE_URL=postgres://user:pass@localhost:5432/chess npm run dev:server
# 터미널 2: 웹 개발 서버 (http://localhost:5173, /api·/ws는 8080으로 프록시)
npm run dev:web
```

Postgres 통합 테스트: `TEST_DATABASE_URL=postgres://... npm --prefix server test`

밸런스 시뮬레이션: `npm run sim -- 200 2 1 --mirror` (판수, 봇 레벨, 시드)

## 배포 (프로덕션)

하나의 컨테이너가 웹 앱, REST API, WebSocket을 모두 제공합니다.

```bash
POSTGRES_PASSWORD=강한비밀번호 docker compose up -d --build
# http://서버:8080
```

| 환경 변수 | 기본값 | 설명 |
|---|---|---|
| `DATABASE_URL` | (없음 → 메모리) | Postgres 연결 문자열. 시작 시 마이그레이션 자동 적용 |
| `PORT` | 8080 | |
| `SEASON` | 1 | 시즌 번호. 올리면 다음 접속부터 새 시즌(레이팅 절반 리셋) |
| `ABORT_MS` | 30000 | 첫 수를 두지 않으면 대국 취소되는 시간 |

**필수:** 앞단에 HTTPS 리버스 프록시(Caddy, Nginx, 클라우드 로드밸런서)를 두세요. PWA 설치와 `wss://` 연결에 HTTPS가 필요합니다. WebSocket 업그레이드(`/ws`)를 통과시키고 `X-Forwarded-For`를 전달하세요.

Fly.io / Render / Railway 같은 서비스는 이 Dockerfile을 그대로 쓰고 관리형 Postgres의 `DATABASE_URL`만 넣으면 됩니다. 현재 구조는 대국 상태를 서버 메모리에 두므로 **인스턴스 1대**로 운영하세요 (수평 확장 시 방 라우팅 필요).

## 게임 규칙 요약

- 체크·체크메이트 없음. 킹을 잡으면 승리, 둘 수 있는 수가 없으면 패배
- 3회 동형 / 100수(양측 합산) 포획·폰 이동 없음 / 300수 → 무승부
- 액티브 카드는 턴을 쓰지 않고, 한 차례에 한 장만
- 레이팅전: 10분 + 5초, 미러 드래프트, 배치 10판, 30초 내 첫 수 없으면 취소

## 크레딧

- 체스 기물 그림: Colin M.L. Burnett (Cburnett), CC BY-SA 3.0
- 카드 일러스트 아이콘: game-icons.net (Lorc, Delapouite 외), CC BY 3.0 — `npm --prefix web run gen:icons`로 사용하는 60개만 추출
- UI 아이콘: Lucide (ISC) · 글꼴: Pretendard (OFL)
- 카드 이름·효과·카드 프레임·앱 디자인은 이 프로젝트의 오리지널입니다.
