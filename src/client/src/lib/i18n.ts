type Lang = 'ko' | 'en'

const translations: Record<string, Record<Lang, string>> = {
  'nav.dashboard': { ko: '대시보드', en: 'Dashboard' },
  'nav.skills': { ko: '스킬', en: 'Skills' },
  'nav.plugins': { ko: '플러그인', en: 'Plugins' },
  'nav.agents': { ko: '에이전트', en: 'Agents' },
  'nav.commands': { ko: '커맨드', en: 'Commands' },
  'nav.settings': { ko: '설정', en: 'Settings' },
  'nav.hooks': { ko: '훅', en: 'Hooks' },
  'nav.mcp': { ko: 'MCP 서버', en: 'MCP Servers' },
  'nav.keybindings': { ko: '키바인딩', en: 'Keybindings' },
  'nav.claudemd': { ko: 'CLAUDE.md', en: 'CLAUDE.md' },
  'nav.memory': { ko: '메모리', en: 'Memory' },
  'nav.teams': { ko: '팀', en: 'Teams' },
  'nav.marketplace': { ko: '마켓플레이스', en: 'Marketplace' },
  'nav.overview': { ko: '개요', en: 'Overview' },
  'nav.extensions': { ko: '확장', en: 'Extensions' },
  'nav.configuration': { ko: '구성', en: 'Configuration' },
  'nav.content': { ko: '콘텐츠', en: 'Content' },
  'nav.store': { ko: '스토어', en: 'Store' },
  'dashboard.title': { ko: '대시보드', en: 'Dashboard' },
  'dashboard.subtitle': { ko: 'Claude Code 환경 전체 현황', en: 'Overview of your Claude Code configuration' },
  'dashboard.skills': { ko: '스킬', en: 'Skills' },
  'dashboard.plugins': { ko: '플러그인', en: 'Plugins' },
  'dashboard.agents': { ko: '에이전트', en: 'Agents' },
  'dashboard.hooks': { ko: '훅', en: 'Hooks' },
  'dashboard.mcp': { ko: 'MCP 서버', en: 'MCP Servers' },
  'dashboard.projects': { ko: '프로젝트', en: 'Projects' },
  'dashboard.validation': { ko: '유효성 검증', en: 'Validation Status' },
  'dashboard.backupHistory': { ko: '백업 이력', en: 'Backup History' },
  'dashboard.allValid': { ko: '모두 정상', en: 'all valid' },
  'dashboard.loading': { ko: '로딩 중...', en: 'loading...' },
  'skills.title': { ko: '스킬 관리', en: 'Skills' },
  'skills.subtitle': { ko: '커스텀 및 설치된 스킬 관리', en: 'Manage custom and installed skills' },
  'skills.all': { ko: '전체', en: 'All' },
  'skills.custom': { ko: '커스텀', en: 'Custom' },
  'skills.installed': { ko: '설치됨', en: 'Installed' },
  'skills.search': { ko: '스킬 검색...', en: 'Search skills...' },
  'skills.newSkill': { ko: '새 스킬', en: 'New Skill' },
  'common.save': { ko: '저장', en: 'Save' },
  'common.cancel': { ko: '취소', en: 'Cancel' },
  'common.delete': { ko: '삭제', en: 'Delete' },
  'common.edit': { ko: '편집', en: 'Edit' },
  'common.create': { ko: '생성', en: 'Create' },
  'common.name': { ko: '이름', en: 'Name' },
  'common.description': { ko: '설명', en: 'Description' },
  'common.actions': { ko: '작업', en: 'Actions' },
  'common.source': { ko: '출처', en: 'Source' },
  'common.command': { ko: '명령', en: 'Command' },
  'common.enabled': { ko: '활성', en: 'Enabled' },
  'common.connected': { ko: '연결됨', en: 'Connected' },
  'marketplace.title': { ko: '마켓플레이스', en: 'Marketplace' },
  'marketplace.subtitle': { ko: '플러그인 및 스킬 탐색', en: 'Browse plugins and skills' },
  'marketplace.all': { ko: '전체', en: 'All' },
  'marketplace.search': { ko: '플러그인 검색...', en: 'Search plugins...' },
  'marketplace.install': { ko: '설치', en: 'Install' },
  'marketplace.installed': { ko: '설치됨', en: 'Installed' },
  'marketplace.noResults': { ko: '검색 결과가 없습니다', en: 'No results found' },
  'stats.topSkills': { ko: '많이 쓴 스킬', en: 'Top Used Skills' },
  'stats.topPlugins': { ko: '많이 쓴 플러그인', en: 'Top Used Plugins' },
  'stats.timeline': { ko: '사용 타임라인', en: 'Usage Timeline' },
  'stats.unused': { ko: '미사용 항목 경고', en: 'Unused Items' },
  'stats.noData': { ko: '사용 데이터 없음. Sync를 실행하세요.', en: 'No usage data yet. Run sync to import history.' },
  'stats.syncHistory': { ko: 'Sync 이력', en: 'Sync History' },
  'stats.syncResult': { ko: '파일 파싱 완료', en: 'files parsed' },
  'stats.unusedDays': { ko: '일간 미사용', en: 'days unused' },
  'stats.remove': { ko: '제거', en: 'Remove' },
  'stats.sync': { ko: 'Sync', en: 'Sync' },
}

let currentLang: Lang = (localStorage.getItem('claude-hub-lang') as Lang) || 'ko'

export function t(key: string): string {
  return translations[key]?.[currentLang] ?? key
}

export function getLang(): Lang {
  return currentLang
}

export function setLang(lang: Lang) {
  currentLang = lang
  localStorage.setItem('claude-hub-lang', lang)
}
