export const CATEGORY_INFO = {
  skills: {
    title: 'Skills이란?',
    description: '특정 작업을 수행하도록 지시하는 마크다운 파일. /스킬명으로 호출합니다.',
    detail: '~/.claude/skills/{name}/SKILL.md',
  },
  plugins: {
    title: 'Plugins이란?',
    description: '스킬, 커맨드, 에이전트를 묶은 확장 패키지. 마켓플레이스에서 설치할 수 있습니다.',
    detail: '~/.claude/plugins/',
  },
  agents: {
    title: 'Agents란?',
    description: '독립적으로 작업을 수행하는 서브에이전트를 정의합니다.',
    detail: '~/.claude/agents/{name}.md',
  },
  commands: {
    title: 'Commands란?',
    description: '커스텀 CLI 명령어를 정의합니다.',
    detail: '~/.claude/commands/',
  },
  settings: {
    title: 'Settings란?',
    description: 'Claude Code 전역/로컬 설정 파일입니다. 모델, 권한, 플러그인 활성화 등을 관리합니다.',
    detail: '~/.claude/settings.json',
  },
  hooks: {
    title: 'Hooks란?',
    description: 'Claude Code의 이벤트(세션 시작, 도구 사용 등) 발생 시 자동 실행되는 셸 명령입니다.',
    detail: 'settings.json → hooks (11종 이벤트)',
  },
  mcp: {
    title: 'MCP Servers란?',
    description: '외부 서비스(GitHub, DB 등)와 연결하는 Model Context Protocol 서버입니다.',
    detail: 'settings.json → mcpServers',
  },
  keybindings: {
    title: 'Keybindings란?',
    description: 'Claude Code의 키보드 단축키를 커스터마이징합니다.',
    detail: '~/.claude/keybindings.json',
  },
  claudeMd: {
    title: 'CLAUDE.md란?',
    description: 'Claude에게 항상 전달되는 지시문 파일입니다. 전역 또는 프로젝트별로 설정 가능합니다.',
    detail: '~/.claude/CLAUDE.md',
  },
  memory: {
    title: 'Memory란?',
    description: '프로젝트별 기억 저장소입니다. 세션이 종료되어도 정보가 유지됩니다.',
    detail: '~/.claude/projects/{path}/memory/',
  },
  teams: {
    title: 'Teams란?',
    description: '여러 에이전트를 조합한 멀티 에이전트 팀을 구성합니다.',
    detail: '~/.claude/teams/',
  },
  marketplace: {
    title: 'Marketplace란?',
    description: '공식/커뮤니티 마켓플레이스에서 플러그인과 스킬을 탐색하고 설치합니다.',
    detail: '등록된 마켓플레이스에서 검색',
  },
  monitor: {
    title: 'Session Monitor란?',
    description: '최근 세션의 도구 호출 이벤트를 실시간으로 확인합니다. 10초 간격으로 자동 갱신됩니다.',
    detail: '~/.claude/projects/**/*.jsonl (최근 3개 파일, 마지막 200줄)',
  },
  cost: {
    title: '비용 추적이란?',
    description: '세션 JSONL 로그에서 토큰 사용량을 파싱하여 예상 비용을 계산합니다. 실제 청구 금액과 다를 수 있습니다.',
    detail: 'input/output 토큰 × 모델별 단가 (Opus/Sonnet/Haiku)',
  },
} as const
