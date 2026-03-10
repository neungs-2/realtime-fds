# realtime-fds (MVP)

NestJS 기반 실시간 블록체인 이상거래 탐지 MVP 입니다.

## MVP 범위

- EVM WebSocket 리스닝으로 TX 수신
- 룰 기반 탐지만 수행 (ML 미연동)
- Redis: 단기 윈도우 상태(급격한 outflow 룰)
- PostgreSQL: 탐지 이벤트 저장
- WebSocket(`/alerts`)으로 anomaly push

## 요구사항

- Node.js `v22.x`
- Yarn
- Docker (Redis/PostgreSQL 실행 용도)

## 실행 방법

1. 의존성 설치

```bash
yarn install
```

2. 인프라 실행

```bash
docker compose up -d
```

3. 환경변수 설정

```bash
cp .env.example .env
```

- 실제 체인 수신을 쓰려면 `.env`에 `EVM_WSS_URL` 입력
- 미입력 시 체인 리스너는 비활성화되고, `mock-tx` 엔드포인트로 테스트 가능

4. 앱 실행

```bash
yarn start:dev
```

## 주요 API

- `GET /health`
- `GET /alerts?limit=50`
- `POST /blockchain/mock-tx`

예시:

```bash
curl -X POST http://localhost:3000/blockchain/mock-tx \
  -H 'content-type: application/json' \
  -d '{"from":"0xabc...","to":"0xdef...","valueWei":"100000000000000000000"}'
```

## 기본 룰

- `whale-transfer`: `WHALE_THRESHOLD_ETH` 이상 전송 탐지
- `rapid-outflow`: `RAPID_OUTFLOW_WINDOW_SEC` 안에 `RAPID_OUTFLOW_TX_COUNT` 이상 송신 탐지

## 폴더 구조

- `src/blockchain`: EVM 리스너 및 mock ingest
- `src/detection`: 룰 엔진 및 규칙
- `src/alerts`: WebSocket gateway + anomaly 저장
- `src/infra/redis`: Redis provider
- `src/transactions`: 탐지 이벤트 조회 API
