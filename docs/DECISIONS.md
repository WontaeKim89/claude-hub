# claude-hub 의사결정 기록 (ADR)

## D-001: 백엔드 언어 Python + FastAPI 선택 (2026-03-20)

**맥락**: 초기 설계에서 Hono (Node.js)를 추천했으나, 사용자가 Python 전환 요청
**대안 검토**:
| 옵션 | 장점 | 단점 |
|------|------|------|
| Hono (Node.js) | 경량, npx 실행 보장 | 메인테이너 비주력 언어 |
| Next.js | 주류 풀스택 | 로컬 도구치고 무거움 |
| **FastAPI (Python)** | 메인테이너 주력, Pydantic 강력 | Python 설치 필요 (uv가 관리) |

**결정**: FastAPI. 오픈소스에서 메인테이너가 편한 스택이 장기 유지보수에 유리
**결과**: 개발 속도 빠름, Pydantic 검증 코드 간결

## D-002: Python 3.13+ 요구사항 (2026-03-20)

**맥락**: 리뷰에서 "3.13+는 공격적" 피드백
**결정**: 사용자 명시적 요청으로 3.13+ 유지. uv가 Python 버전을 자동 관리하므로 사용자 설치 부담 없음
**위험**: 3.13 미지원 환경에서 직접 pip install 시 실패 가능 → README에 uv 사용 권장 명시

## D-003: uv 패키지 관리자 사용 (2026-03-20)

**맥락**: 사용자가 pip 대신 uv 명시적 요청
**결정**: pyproject.toml + uv.lock, 실행은 `uvx claude-hub`
**장점**: 빠른 의존성 해석, Python 버전 자동 관리, lockfile 재현성

## D-004: 로컬 웹 UI 방식 선택 (2026-03-20)

**대안 검토**: TUI, VS Code 확장, Electron, 로컬 웹 UI
**결정**: 로컬 웹 UI (`localhost:3847`)
**이유**: 풍부한 UI + 개발자 친숙 + 오픈소스 기여 용이 + 나중에 TUI/VS Code 확장 붙일 수 있음

## D-005: 안전장치 수준 — 강력 (2026-03-20)

**결정**: 자동 백업 + 변경 이력 (undo) + 유효성 검증 + dry-run
**이유**: ~/.claude/ 직접 수정하는 도구이므로 실수 시 복구 불가능할 수 있음. 파일 잠금(fcntl) + 원자적 쓰기(os.replace) + mtime 충돌 감지로 동시성 보장

## D-006: Marketplace 외부 레지스트리 Phase 3 분리 (2026-03-20)

**맥락**: 리뷰에서 MVP 범위 과다 지적
**결정**: 로컬 관리(Phase 1-2) 우선, Marketplace는 Phase 3
**이유**: 외부 API 의존성(SkillsMP, GitHub)은 추가 복잡도 큼, 핵심 가치는 로컬 관리
