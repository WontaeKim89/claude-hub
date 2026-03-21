# claude-hub 배포 전략

최대한 많은 개발자가 간편하게 사용할 수 있는 방안.

---

## 배포 채널별 비교

| 채널 | 설치 명령 | 난이도 | 도달 범위 | 추천 |
|------|-----------|--------|-----------|------|
| **PyPI** | `uvx claude-hub` 또는 `pipx run claude-hub` | 매우 쉬움 | Python 개발자 전체 | ★★★★★ |
| **npm** | `npx claude-hub` | 매우 쉬움 | Node.js 개발자 (Claude Code 사용자 100%) | ★★★★★ |
| **Homebrew** | `brew install claude-hub` | 쉬움 | macOS 개발자 | ★★★★ |
| **GitHub Releases** | `.app` 다운로드 | 쉬움 | 비개발자 포함 | ★★★ |
| **Claude Plugin** | `claude plugin install claude-hub` | 가장 쉬움 | Claude Code 사용자 직접 | ★★★★★ |
| **Docker** | `docker run claude-hub` | 중간 | 격리 환경 선호자 | ★★★ |

## 추천 전략: 3단계 순차 배포

### Stage 1: PyPI + GitHub (즉시)

가장 빠르게 배포 가능. Python 패키지로 PyPI에 올리고, GitHub 오픈소스로 공개.

```bash
# 사용자 설치 방법
uvx claude-hub --app          # uv 사용자 (추천)
pipx run claude-hub --app     # pipx 사용자
pip install claude-hub && claude-hub --app  # pip 사용자
```

**필요 작업:**
1. PyPI 계정 + API 토큰
2. `uv publish` 또는 `twine upload`
3. GitHub repo 공개 + README + 스크린샷

**GitHub README에 포함할 것:**
- 한 줄 설치 명령 (복붙용)
- 스크린샷 (Dashboard, Skills, Analysis)
- 기능 목록 + GIF 데모
- "Star를 눌러주세요" CTA

### Stage 2: Claude Plugin 등록 (1-2주)

**가장 강력한 채널.** Claude Code 사용자가 `claude plugin install`로 바로 설치.

```bash
# 사용자 설치 방법
claude plugin install claude-hub@claude-hub-marketplace
```

**구현:**
1. claude-hub을 Claude Plugin 포맷으로 래핑
2. `.claude-plugin/plugin.json` 메타데이터 작성
3. `commands/open-hub.md` — `/open-hub` 명령어로 claude-hub 실행
4. 마켓플레이스에 등록 (GitHub repo 기반)

**plugin.json 예시:**
```json
{
  "name": "claude-hub",
  "description": "Visual dashboard for managing Claude Code configuration",
  "author": { "name": "claude-hub" },
  "version": "0.1.0",
  "category": "productivity"
}
```

**장점:** Claude Code 내부에서 `/open-hub` 한 줄로 대시보드 실행. 설치 장벽 최소.

### Stage 3: Homebrew + npm (2-4주)

macOS 개발자를 위한 Homebrew tap과, Node.js 개발자를 위한 npm 래퍼.

```bash
# Homebrew
brew tap claude-hub/tap
brew install claude-hub

# npm (Python 서버를 내부에서 실행하는 래퍼)
npx claude-hub
```

**npm 래퍼 전략:**
- `postinstall` 스크립트에서 `uv` 설치 + Python 의존성 자동 설정
- 또는 Python을 `pkg` 등으로 바이너리 번들링 (복잡하지만 의존성 제로)

---

## 즉시 실행 가능한 액션

### 1. GitHub 저장소 공개

```bash
# 저장소 생성
gh repo create claude-hub/claude-hub --public --source=. --push

# 또는 개인 계정으로
gh repo create gim-wontae/claude-hub --public --source=. --push
```

### 2. PyPI 배포

```bash
# 프론트엔드 빌드 + 패키지 빌드
bash scripts/build.sh
uv build

# PyPI 업로드
uv publish --token $PYPI_TOKEN
```

### 3. GitHub Releases에 macOS .app 첨부

```bash
# .app 번들 압축
cd /Applications
zip -r claude-hub-v0.1.0-macos.zip claude-hub.app

# GitHub Release 생성
gh release create v0.1.0 \
  --title "claude-hub v0.1.0" \
  --notes "Initial release" \
  ./claude-hub-v0.1.0-macos.zip
```

### 4. README 스크린샷

앱 실행 후 스크린샷 촬영:
- Dashboard (통계 카드 + Hit 차트)
- Skills 페이지 (필터 + 테이블)
- AI 분석 결과 화면
- 앱 창 전체 모습

---

## 마케팅/홍보 채널

| 채널 | 방법 | 기대 효과 |
|------|------|-----------|
| **GitHub Awesome Lists** | `awesome-claude-code`에 PR | 검색 유입 |
| **Reddit** | r/ClaudeAI, r/ChatGPTPro에 포스팅 | 커뮤니티 확산 |
| **X (Twitter)** | 데모 GIF + 스크린샷 포스트 | 바이럴 |
| **Hacker News** | Show HN 포스트 | 개발자 커뮤니티 대량 유입 |
| **Discord** | Claude/Anthropic 공식 Discord에 공유 | 타겟 사용자 직접 |
| **블로그 포스트** | "Claude Code 설정을 시각적으로 관리하는 방법" | SEO + 상세 소개 |

## 기여자 확보 전략

1. **CONTRIBUTING.md** 작성 — 빌드 방법, PR 가이드, 이슈 템플릿
2. **Good First Issues** — 번역 추가(일본어, 중국어), 새 테마, 차트 개선
3. **Plugin 생태계** — claude-hub 자체를 확장 가능하게 (커스텀 대시보드 위젯)

---

## 설치 원클릭 스크립트 (README용)

```bash
# 가장 간단한 설치 + 실행
curl -sSL https://raw.githubusercontent.com/claude-hub/claude-hub/main/install.sh | bash
```

`install.sh` 내용:
```bash
#!/bin/bash
set -e

# uv 설치 (없는 경우)
if ! command -v uv &>/dev/null; then
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
fi

# claude-hub 설치 + 실행
uv tool install claude-hub
claude-hub --app
```
