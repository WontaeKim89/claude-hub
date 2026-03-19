import Editor from '@monaco-editor/react'

interface Props {
  value: string
  onChange: (value: string) => void
  language?: string
  height?: string
}

export function MonacoWrapper({ value, onChange, language = 'markdown', height = '400px' }: Props) {
  return (
    <Editor
      height={height}
      defaultLanguage={language}
      value={value}
      onChange={(v) => onChange(v ?? '')}
      theme="vs-dark"
      options={{ minimap: { enabled: false }, fontSize: 14, wordWrap: 'on' }}
    />
  )
}
