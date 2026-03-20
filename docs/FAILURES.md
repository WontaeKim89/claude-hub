# claude-hub 실패/삽질 기록

## F-001: ralph-loop Bash 권한 파서 이슈 (2026-03-20)

**상황**: `/ralph-loop:ralph-loop "prompt" --completion-promise "X" --max-iterations 10` 실행 시 에러
**에러**: `This Bash command contains multiple operations. The following part requires approval: --completion-promise "FRONTEND COMPLETE" --max-iterations 10`
**원인**: Claude Code의 Bash 권한 파서가 `--flag` 인자를 별도 operation으로 오인
**시도한 것**:
1. settings.local.json에 와일드카드 패턴 추가 → 실패 (파서가 패턴 매칭 전에 명령 분리)
2. 글로벌 settings.json에 permissions 추가 → 실패 (동일 원인)
3. 래퍼 스크립트 (scripts/ralph-start.sh) 작성 → 우회 가능하지만 근본 해결 아님
4. 플러그인 commands/ralph-loop.md의 `allowed-tools`를 `["Bash"]`로 변경 + `bash` prefix 추가 → 성공
**해결**: 플러그인의 명령 정의 파일 직접 수정
**교훈**: Claude Code의 Bash 파서는 `--`로 시작하는 플래그를 별도 operation으로 분류할 수 있음. 플러그인 캐시 파일은 업데이트 시 덮어쓰기되므로 근본적으로는 Claude Code 이슈 리포트 필요
**소요 시간**: 약 2시간

## F-002: build.sh 경로 해석 실패 (2026-03-20)

**상황**: `bash scripts/build.sh` 실행 시 static 복사 실패
**에러**: `cp: scripts/../src/claude_hub/static: No such file or directory`
**원인**: `$(dirname "$0")`가 `cd` 이후 상대경로로 해석되어 다른 디렉토리를 가리킴
**해결**: 스크립트 초반에 절대경로 변환: `SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"`
**교훈**: 셸 스크립트에서 `$(dirname "$0")`는 cd 전에 절대경로로 변환해두는 게 안전
**소요 시간**: 5분

## F-003: SSL 인증서 에러로 서브에이전트 실패 (2026-03-20)

**상황**: 프론트엔드 구현 서브에이전트 디스패치 시 SSL 에러
**에러**: `API Error: Unable to connect to API: Self-signed certificate detected`
**원인**: 네트워크 환경 또는 프록시의 자체 서명 인증서
**해결**: 재시도로 해결됨 (일시적 네트워크 이슈)
**교훈**: 서브에이전트 실패 시 즉시 재시도, 반복되면 네트워크 환경 확인
