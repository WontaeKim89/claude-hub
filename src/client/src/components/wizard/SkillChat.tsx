import { useState, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Send, Loader2, Bot, User } from 'lucide-react'
import { api } from '../../lib/api-client'
import { useLang } from '../../hooks/useLang'
import type { SkillGenResult } from '../../lib/types'

interface Message {
  role: 'user' | 'assistant'
  content: string
  questions?: string[]
  skill_md?: string
  skill_name?: string
}

interface Props {
  onSave: (name: string, content: string) => void
  onSwitchToManual: (content: string) => void
}

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: 'What skill would you like to create? Describe the problem or behavior you want.',
}

export function SkillChat({ onSave, onSwitchToManual }: Props) {
  const { t } = useLang()
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const mutation = useMutation({
    mutationFn: (userMsg: string) => {
      // messages에는 이미 handleSend에서 추가된 사용자 메시지가 포함됨
      const updated: Array<{ role: string; content: string }> = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMsg },
      ]
      return api.wizard.generateSkill(updated)
    },
    onSuccess: (data: SkillGenResult) => {
      let aiContent = ''
      if (data.skill_md) {
        aiContent = data.questions?.length > 0
          ? 'Draft generated. A few more details would help refine it.'
          : 'Skill generated. Review below and save.'
      } else if (data.questions?.length > 0) {
        aiContent = 'A few more details would help create a better skill.'
      } else {
        aiContent = 'Skill generation failed. Please try again.'
      }

      const aiMessage: Message = {
        role: 'assistant',
        content: aiContent,
        questions: data.questions,
        skill_md: data.skill_md,
        skill_name: data.name,
      }

      // AI 응답만 추가 (사용자 메시지는 handleSend에서 이미 추가됨)
      setMessages((prev) => [...prev, aiMessage])
    },
  })

  const handleSend = () => {
    const text = input.trim()
    if (!text || mutation.isPending) return
    setInput('')
    // 사용자 메시지를 즉시 UI에 표시
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    mutation.mutate(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* 아바타 */}
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                msg.role === 'assistant' ? 'bg-purple-500/20 text-purple-400' : 'bg-fuchsia-500/20 text-fuchsia-400'
              }`}
            >
              {msg.role === 'assistant' ? <Bot size={13} /> : <User size={13} />}
            </div>

            <div className={`flex flex-col gap-1.5 max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              {/* 말풍선 */}
              <div
                className={`px-3 py-2 rounded-lg text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-fuchsia-600/20 text-sky-100 border border-fuchsia-500/20'
                    : 'bg-zinc-800 text-zinc-200 border border-zinc-700'
                }`}
              >
                {msg.content}
              </div>

              {/* 질문 pill 버튼 */}
              {msg.questions && msg.questions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {msg.questions.map((q, qi) => (
                    <button
                      key={qi}
                      onClick={() => { setInput(q); }}
                      className="px-2.5 py-1 text-xs border border-purple-500/40 text-purple-400 hover:border-purple-400 hover:bg-purple-500/10 rounded-full transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* 생성된 SKILL.md 미리보기 */}
              {msg.skill_md && (
                <div className="w-full border border-purple-500/30 rounded-md overflow-hidden">
                  <div className="px-3 py-1.5 bg-purple-500/10 border-b border-purple-500/20 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-purple-400">SKILL.md — {msg.skill_name || 'generated'}</span>
                  </div>
                  <pre className="px-3 py-2.5 text-[11px] font-mono text-zinc-400 overflow-x-auto max-h-40 bg-zinc-900">
                    {msg.skill_md}
                  </pre>
                  <div className="flex gap-1.5 px-3 py-2 border-t border-purple-500/20 bg-zinc-900/50">
                    <button
                      onClick={() => onSwitchToManual(msg.skill_md!)}
                      className="px-2.5 py-1 text-[11px] border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 rounded transition-colors"
                    >
                      {t('wizard.editInMonaco')}
                    </button>
                    <button
                      onClick={() => onSave(msg.skill_name || 'generated-skill', msg.skill_md!)}
                      className="px-2.5 py-1 text-[11px] bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors"
                    >
                      {t('wizard.saveSkill')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* 로딩 인디케이터 */}
        {mutation.isPending && (
          <div className="flex gap-2.5">
            <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
              <Bot size={13} />
            </div>
            <div className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700">
              <Loader2 size={13} className="text-zinc-500 animate-spin" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <div className="border-t border-zinc-800 p-3 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('wizard.chatPlaceholder')}
          rows={2}
          className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-100 font-mono resize-none focus:outline-none focus:border-fuchsia-500/50 placeholder-zinc-600"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || mutation.isPending}
          className="px-3 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded transition-colors disabled:opacity-50 self-end"
        >
          <Send size={13} />
        </button>
      </div>
    </div>
  )
}
