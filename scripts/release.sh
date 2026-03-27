#!/bin/bash
# claude-hub 릴리스 스크립트
# 사용법: bash scripts/release.sh 0.3.0
#
# 수행 내용:
# 1. pyproject.toml 버전 업데이트
# 2. 프론트엔드 빌드 + static 복사
# 3. PyPI 빌드 + 업로드
# 4. Git tag 생성 + 푸시
# 5. GitHub Release 생성
# 6. Homebrew tap Formula 자동 업데이트

set -e

# 색상
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HOMEBREW_TAP="$HOME/Desktop/Persnal_Project/homebrew-tap"

# PyPI 토큰 확인 (환경변수 필수 — ~/.zshrc에 export UV_PUBLISH_TOKEN="pypi-..." 추가)
if [ -z "$UV_PUBLISH_TOKEN" ]; then
  echo -e "${RED}Error: UV_PUBLISH_TOKEN not set${NC}"
  echo -e "Add to ~/.zshrc: export UV_PUBLISH_TOKEN=\"pypi-XXXXXXXX\""
  exit 1
fi

# 버전 인자 확인
VERSION="${1}"
if [ -z "$VERSION" ]; then
  CURRENT=$(grep '^version' "$PROJECT_ROOT/pyproject.toml" | head -1 | sed 's/.*"\(.*\)".*/\1/')
  echo -e "${RED}Usage: bash scripts/release.sh <version>${NC}"
  echo -e "Current version: ${CYAN}${CURRENT}${NC}"
  echo -e "Example: bash scripts/release.sh 0.3.0"
  exit 1
fi

TAG="v${VERSION}"

echo ""
echo -e "${CYAN}══════════════════════════════════════${NC}"
echo -e "${CYAN}  claude-hub release ${TAG}${NC}"
echo -e "${CYAN}══════════════════════════════════════${NC}"
echo ""

# Step 1: 버전 업데이트
echo -e "${YELLOW}[1/6] Updating version to ${VERSION}...${NC}"
cd "$PROJECT_ROOT"
sed -i '' "s/^version = \".*\"/version = \"${VERSION}\"/" pyproject.toml
echo -e "${GREEN}  ✓ pyproject.toml updated${NC}"

# Step 2: 프론트엔드 빌드
echo -e "${YELLOW}[2/6] Building frontend...${NC}"
bash scripts/build.sh
echo -e "${GREEN}  ✓ Frontend built${NC}"

# Step 3: PyPI 빌드 + 업로드
echo -e "${YELLOW}[3/6] Publishing to PyPI...${NC}"
rm -rf dist/
uv build
uv publish
echo -e "${GREEN}  ✓ Published to PyPI${NC}"

# Step 4: Git commit + tag + push
echo -e "${YELLOW}[4/6] Creating git tag ${TAG}...${NC}"
git add pyproject.toml
git commit -m "chore: bump version to ${VERSION}" || true  # 이미 커밋된 경우 무시
git tag "${TAG}"
git push origin main
git push origin "${TAG}"
echo -e "${GREEN}  ✓ Tag ${TAG} pushed${NC}"

# Step 5: GitHub Release
echo -e "${YELLOW}[5/6] Creating GitHub Release...${NC}"
gh release create "${TAG}" \
  --title "${TAG}" \
  --generate-notes 2>/dev/null || echo -e "${YELLOW}  ⚠ gh release failed (create manually on GitHub)${NC}"
echo -e "${GREEN}  ✓ GitHub Release created${NC}"

# Step 6: Homebrew tap 업데이트
echo -e "${YELLOW}[6/6] Updating Homebrew tap...${NC}"
if [ -d "$HOMEBREW_TAP" ]; then
  SHA256=$(curl -sL "https://github.com/WontaeKim89/claude-hub/archive/refs/tags/${TAG}.tar.gz" | shasum -a 256 | awk '{print $1}')
  echo -e "  SHA256: ${CYAN}${SHA256}${NC}"

  FORMULA="$HOMEBREW_TAP/Formula/claude-hub.rb"
  sed -i '' "s|url \".*\"|url \"https://github.com/WontaeKim89/claude-hub/archive/refs/tags/${TAG}.tar.gz\"|" "$FORMULA"
  sed -i '' "s|sha256 \".*\"|sha256 \"${SHA256}\"|" "$FORMULA"

  cd "$HOMEBREW_TAP"
  git add Formula/claude-hub.rb
  git commit -m "claude-hub ${VERSION}"
  git push origin main
  echo -e "${GREEN}  ✓ Homebrew tap updated${NC}"
else
  echo -e "${YELLOW}  ⚠ homebrew-tap not found at ${HOMEBREW_TAP}${NC}"
  echo -e "${YELLOW}  Run manually: update Formula url + sha256${NC}"
fi

echo ""
echo -e "${GREEN}══════════════════════════════════════${NC}"
echo -e "${GREEN}  Release ${TAG} complete!${NC}"
echo -e "${GREEN}══════════════════════════════════════${NC}"
echo ""
echo -e "  PyPI:     https://pypi.org/project/claude-hub/${VERSION}/"
echo -e "  GitHub:   https://github.com/WontaeKim89/claude-hub/releases/tag/${TAG}"
echo -e "  Homebrew: brew update && brew upgrade claude-hub"
echo ""
