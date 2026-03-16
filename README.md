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
- `GET /debug/tx-received?limit=20` (최근 수신 tx 확인)
- `GET /debug/tx-received/:hash` (특정 tx hash 수신 여부 확인)

예시:

```bash
curl -X POST http://localhost:3000/blockchain/mock-tx \
  -H 'content-type: application/json' \
  -d '{"from":"0xabc...","to":"0xdef...","valueWei":"100000000000000000000"}'
```

## 기본 룰

- `whale-transfer`: `WHALE_THRESHOLD_ETH` 이상 전송 탐지
- `rapid-outflow`: `RAPID_OUTFLOW_WINDOW_SEC` 안에 `RAPID_OUTFLOW_TX_COUNT` 이상 송신 탐지

## 로컬 Besu/Remix 연동 테스트

1. Besu 네트워크 실행

```bash
cd /Users/logan/Blocko/besu-qbft-docker
docker compose up -d
```

2. FDS 인프라 실행

```bash
cd /Users/logan/Blocko/realtime-fds
docker compose up -d
```

3. FDS 앱 실행

```bash
cd /Users/logan/Blocko/realtime-fds
yarn start:dev
```

4. Remix에서 Besu RPC(`http://127.0.0.1:8545`)로 tx 전송 후 tx hash 복사

5. FDS 수신 여부 확인

```bash
curl -s http://localhost:3000/debug/tx-received/<tx-hash>
```

6. 최근 수신 목록 확인

```bash
curl -s 'http://localhost:3000/debug/tx-received?limit=20'
```

## CLI TX 전송 예시

`node -e`는 JavaScript를 파일 없이 즉시 실행하는 방식입니다.

```bash
cd /Users/logan/Blocko/realtime-fds
node -e "const {ethers}=require('ethers');(async()=>{const p=new ethers.JsonRpcProvider('http://127.0.0.1:8545');const w=new ethers.Wallet('0xc87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3',p);const tx=await w.sendTransaction({to:'0xf17f52151EbEF6C7334FAD080c5704D77216b732',value:ethers.parseEther('1')});console.log('TX_HASH='+tx.hash);await tx.wait();console.log('MINED');})();"
```

- `TX_HASH=...`: 네트워크에 전파된 트랜잭션 해시
- `MINED`: 트랜잭션이 블록에 포함되어 확정됨 (`tx.wait()` 완료)

## 폴더 구조

- `src/blockchain`: EVM 리스너 및 mock ingest
- `src/detection`: 룰 엔진 및 규칙
- `src/alerts`: anomaly 저장 + 조회 API + WebSocket gateway
- `src/infra/redis`: Redis provider
