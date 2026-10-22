'use client';

import Link from 'next/link';
import {
  CheckCircle2, CircleDot, MessageSquare, Search, Send, TriangleAlert,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

const examples = [
  { title: 'Lebarkan kitchen menjadi 6.4 m', meta: 'Layout · 2D Plan', prompt: 'Ubah lebar kitchen menjadi 6400 mm' },
  { title: 'Adjust seating 120 pax', meta: 'Space Planning', prompt: 'Atur kapasitas seating menjadi 120 pax' },
  { title: 'Add dimension to all walls', meta: '2D Plan · Dimension', prompt: 'Tambahkan dimensi pada semua dinding yang dipilih' },
  { title: 'Check circulation 1.5 m', meta: 'Analysis · Compliance', prompt: 'Periksa lebar sirkulasi minimum 1500 mm' },
  { title: 'Zoning alternatif', meta: 'Layout · Zoning', prompt: 'Buat alternatif zoning untuk proyek ini' },
  { title: 'Material palette selection', meta: 'Design · Concept', prompt: 'Tampilkan alternatif palet material untuk objek ini' },
  { title: 'Revit export settings', meta: 'Integrations · BIM', prompt: 'Periksa pengaturan ekspor Revit untuk model ini' },
] as const;

type AssistantRailProps = {
  projectName?: string;
  intent?: string;
  changeSetState?: string;
  validationPass?: number;
  validationWarning?: number;
  selectedObjectLabel?: string | null;
  onSubmitCommand?: (command: string) => Promise<void>;
};

export function AssistantRail({
  projectName = 'ARCHON Project',
  intent = 'Select an object and describe a governed edit',
  changeSetState = 'READY',
  validationPass = 0,
  validationWarning = 0,
  selectedObjectLabel,
  onSubmitCommand,
}: AssistantRailProps) {
  const [command, setCommand] = useState('');
  const [search, setSearch] = useState('');
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const matchingExamples = useMemo(() => {
    const value = search.trim().toLocaleLowerCase();
    return examples.filter(example =>
      !value || `${example.title} ${example.meta}`.toLocaleLowerCase().includes(value)
    );
  }, [search]);

  const readyToSubmit = Boolean(command.trim() && selectedObjectLabel && onSubmitCommand && !busy);

  function selectPrompt(text: string, title?: string) {
    setCommand(text);
    setSelectedPrompt(title ?? null);
    setError(null);
    setNotice('Example added to the editor. Review it before submitting.');
    inputRef.current?.focus();
  }

  function newDraft() {
    setCommand('');
    setSelectedPrompt(null);
    setSearch('');
    setError(null);
    setNotice('New draft ready. Select an object in 3D Studio to submit an edit.');
    inputRef.current?.focus();
  }

  async function submit() {
    const value = command.trim();
    if (!value || busy) return;
    if (!onSubmitCommand || !selectedObjectLabel) {
      setError('Select an object in 3D Studio before sending a governed edit.');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice('');
    try {
      await onSubmitCommand(value);
      setCommand('');
      setSelectedPrompt(null);
      setNotice('Your proposed edit has been sent for governed review.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'COMMAND_FAILED');
    } finally {
      setBusy(false);
    }
  }

  return <aside className="assistant-panel" aria-label="ARCHON Assistant">
    <div className="assistant-head">
      <div className="assistant-heading">
        <strong>ARCHON Assistant</strong>
        <span className="online">● Draft tools</span>
        <small>{projectName}</small>
      </div>
      <button type="button" className="ghost" onClick={newDraft}>+ New Chat</button>
    </div>

    <label className="conversation-search">
      <Search size={17} aria-hidden="true"/>
      <span className="sr-only">Search example prompts</span>
      <input
        value={search}
        onChange={event => setSearch(event.target.value)}
        placeholder="Search prompts..."
        aria-label="Search example prompts"
      />
    </label>

    <div className="conversation-scroll">
      <h4>Agent Execution</h4>
      <div className="execution-card">
        <div className="execution-title">
          <CircleDot size={16} aria-hidden="true"/>
          <span><b>{intent}</b><small>Governed execution · {changeSetState}</small></span>
        </div>
        <div className="execution-step"><CheckCircle2 size={15} aria-hidden="true"/>
          <span><b>Analyzing</b><small>{selectedObjectLabel
            ? `${selectedObjectLabel} identified in Building Graph`
            : 'Select a canonical object in the viewport'}</small></span>
        </div>
        <div className="execution-step"><CheckCircle2 size={15} aria-hidden="true"/>
          <span><b>Planning</b><small>Approved Building state remains locked</small></span>
        </div>
        <div className="execution-step"><CheckCircle2 size={15} aria-hidden="true"/>
          <span><b>Sandboxing</b><small>Move and dimension edits use structured operations</small></span>
        </div>
        <div className="execution-step active"><TriangleAlert size={15} aria-hidden="true"/>
          <span><b>Verifying</b><small>{validationPass} pass · {validationWarning} warning · approval required</small></span>
        </div>
        <div className="execution-progress" role="progressbar"
          aria-valuemin={0} aria-valuemax={100}
          aria-valuenow={changeSetState === 'NEEDS_REVIEW' ? 88 : 35}
          aria-label="Governed workflow progress">
          <span style={{width:changeSetState === 'NEEDS_REVIEW' ? '88%' : '35%'}}/>
        </div>
      </div>

      <h4>Prompt examples</h4>
      {matchingExamples.length ? matchingExamples.map(example =>
        <button type="button" key={example.title}
          className={selectedPrompt === example.title ? 'conversation active' : 'conversation'}
          onClick={() => selectPrompt(example.prompt, example.title)}
          aria-label={`Use prompt: ${example.title}`}>
          <MessageSquare size={17} aria-hidden="true"/>
          <span><b>{example.title}</b><small>{example.meta}</small></span>
        </button>
      ) : <p className="assistant-empty-search">No examples match your search.</p>}
    </div>

    <div className="suggestions">
      <small>Quick 3D edit examples</small>
      <button type="button" onClick={() => selectPrompt('Geser object ini 600 mm ke kanan')}>Move 600 mm right</button>
      <button type="button" onClick={() => selectPrompt('Ubah lebar object ini menjadi 6400 mm')}>Set width 6400 mm</button>
      <button type="button" onClick={() => selectPrompt('Ubah tinggi object ini menjadi 3200 mm')}>Set height 3200 mm</button>
    </div>

    {(error || notice) && <div role="status" className={error ? 'assistant-feedback-error' : 'assistant-feedback'}>
      {error ?? notice}
    </div>}

    <form className="composer" onSubmit={event => {event.preventDefault(); void submit();}}>
      <input
        ref={inputRef}
        value={command}
        onChange={event => {setCommand(event.target.value);setNotice('');}}
        placeholder={selectedObjectLabel ? `Edit ${selectedObjectLabel}...` : 'Describe an edit...'}
        aria-label="Governed edit command"
      />
      <button type="submit" disabled={!readyToSubmit} aria-label="Submit governed edit">
        <Send size={18} aria-hidden="true"/>
      </button>
    </form>
    <div className="tip">
      {selectedObjectLabel ? `Target selected: ${selectedObjectLabel}` :
        <>To execute an edit, open <Link href="/workspace/3d">3D Studio</Link> and select an object.</>}
    </div>
  </aside>;
}
