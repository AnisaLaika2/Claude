import { useRef, useState } from 'react';
import { useData } from '../store/DataContext';
import { runAssistant, type AssistantAnswer } from '../lib/assistant';

interface Msg {
  role: 'user' | 'assistant';
  text?: string;
  answer?: AssistantAnswer;
}

const SUGGESTIONS = [
  'Quanto ho speso da Amazon negli ultimi 6 mesi?',
  'Quanto ho speso in Trasporti questo mese?',
  'Dove spendo di più? Come posso risparmiare?',
  'Se ho una spesa extra di 300€, come sto a budget?',
  'Quanto ho di spese fisse?',
  'Qual è il mio saldo?',
];

export default function Assistant() {
  const { transactions, categories, groups, accounts, recurring, planned } = useData();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  function ask(text: string) {
    const q = text.trim();
    if (!q) return;
    const answer = runAssistant(q, {
      transactions,
      categories,
      groups,
      accounts,
      recurring,
      planned,
    });
    setMessages((m) => [...m, { role: 'user', text: q }, { role: 'assistant', answer }]);
    setInput('');
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Assistente 🤖</h2>
        <p className="mt-1 text-sm text-slate-500">
          Faccio i conti sui tuoi movimenti direttamente qui sul dispositivo: nessun
          dato viene inviato online. Chiedimi delle tue spese, del budget o come
          risparmiare.
        </p>
      </div>

      {messages.length === 0 && (
        <div className="card p-4">
          <p className="mb-2 text-sm font-medium text-slate-600">Prova a chiedere:</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => ask(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand-600 px-4 py-2 text-sm text-white">
                {m.text}
              </div>
            </div>
          ) : (
            <div key={i} className="flex justify-start">
              <div className="max-w-[90%] space-y-2 rounded-2xl rounded-bl-sm bg-white px-4 py-3 text-sm text-slate-700 shadow-sm ring-1 ring-slate-100">
                {m.answer?.text.split('\n').map((line, k) => (
                  <p key={k}>{line}</p>
                ))}
                {m.answer?.stats && m.answer.stats.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {m.answer.stats.map((s, k) => (
                      <div key={k} className="rounded-lg bg-slate-50 px-3 py-1.5">
                        <div className="text-xs text-slate-400">{s.label}</div>
                        <div className="font-semibold text-slate-800">{s.value}</div>
                      </div>
                    ))}
                  </div>
                )}
                {m.answer?.list && m.answer.list.length > 0 && (
                  <div className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                    {m.answer.list.map((it, k) => (
                      <div key={k} className="flex justify-between px-3 py-1.5">
                        <span className="truncate text-slate-600">{it.label}</span>
                        <span className="ml-2 shrink-0 font-medium text-slate-800">
                          {it.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ),
        )}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-0 flex gap-2 bg-slate-50 py-2">
        <input
          className="input"
          placeholder="Scrivi una domanda…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask(input)}
        />
        <button className="btn-primary" onClick={() => ask(input)}>
          Chiedi
        </button>
      </div>
    </div>
  );
}
