'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowRight, Bot, Check, ChevronDown, ChevronLeft, ChevronRight,
  ClipboardCheck, Clock3, Copy, DoorOpen, ExternalLink, FileBox, FileText,
  FolderOpen, Layers, ListChecks, LockKeyhole, Menu, PanelLeftClose,
  PanelLeftOpen, PanelTop, PenLine, Plus, RefreshCw, Ruler, ScanLine, Search,
  Send, Settings2, ShieldCheck, Square, Trash2, WandSparkles, X
} from 'lucide-react';
import { RevitApsViewer, type RevitViewerStatus } from './revit-aps-viewer';
import {
  REVIT_TOOLS, PILOT_INSTRUCTION, defaultsForTool, instructionForTool,
  validateRevitCommand,
  type RevitDraft, type RevitParameters, type RevitTool, type RevitSource
} from './revit-workflow-spec';

type Tab = 'assistant' | 'tools' | 'plans' | 'files';
type Project = { id: string; name: string; status?: string; buildingType?: string | null; locationText?: string | null };
type RevitStatus = { state: string; credentialsConfigured: boolean; nativeWorkItemVerified: boolean; executionEnabled: boolean; diagnostics: string[] };
type LogEvent = { id: string; at: string; level: 'INFO' | 'READY' | 'BLOCKED' | 'ERROR'; message: string };

const ICONS = {
  ai: Bot, wall: PenLine, door: DoorOpen, window: Square, floor: PanelTop,
  level: Layers, inspect: Search, section: ScanLine
};

const EXAMPLES = [
  { label: 'Create pilot', description: '12 × 20 m · four walls · two levels', instruction: PILOT_INSTRUCTION },
  { label: 'Inspect RVT', description: 'Levels, rooms, walls and dimensions',
    instruction: 'Read the attached RVT model. Report all levels, walls, floors, doors, windows, rooms, quantities and dimensions. Do not modify the model.' },
  { label: 'Bukit Jarian', description: 'Prepare a boarding-house BIM brief',
    instruction: 'Prepare a Revit BIM work plan for Bukit Jarian boarding house. Ground floor is for parking. Use approved zoning and existing dimensions, flag all missing drawings and assumptions. Do not run until the source model is checked.' }
];

function timeNow() {
  return new Date().toLocaleTimeString('en-GB', { hour12: false });
}

export function RevitWorkspace() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('pilot');
  const [projectError, setProjectError] = useState('');
  const [source, setSource] = useState<RevitSource>('pilot');
  const [activeTab, setActiveTab] = useState<Tab>('assistant');
  const [panelOpen, setPanelOpen] = useState(true);
  const [logOpen, setLogOpen] = useState(false);
  const [revit, setRevit] = useState<RevitStatus | null>(null);
  const [viewer, setViewer] = useState<RevitViewerStatus | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [tool, setTool] = useState<RevitTool>('wall');
  const [toolSearch, setToolSearch] = useState('');
  const [parameters, setParameters] = useState<RevitParameters>(() => defaultsForTool('wall'));
  const [prompt, setPrompt] = useState(PILOT_INSTRUCTION);
  const [drafts, setDrafts] = useState<RevitDraft[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);

  const selectedProject = projects.find(item => item.id === projectId);
  const projectName = selectedProject?.name ?? 'Revit Sandbox';
  const selected = drafts.find(item => item.id === selectedId) ?? null;
  const activeDefinition = REVIT_TOOLS.find(item => item.id === tool)!;
  const paramsErrors = useMemo(() => validateRevitCommand(tool, parameters, ''), [tool, parameters]);
  const promptErrors = useMemo(() => validateRevitCommand('ai', {}, prompt), [prompt]);
  const filteredTools = useMemo(() => REVIT_TOOLS.filter(item =>
    item.id !== 'ai' && (item.name.toLowerCase().includes(toolSearch.toLowerCase()) ||
      item.description.toLowerCase().includes(toolSearch.toLowerCase()))
  ), [toolSearch]);
  const nativeEnabled = revit?.executionEnabled === true && revit?.nativeWorkItemVerified === true;
  const hasViewer = viewer?.state === 'READY';

  const addLog = useCallback((level: LogEvent['level'], message: string) => {
    const entry: LogEvent = {
      id: String(Date.now()) + Math.random().toString(36).slice(2, 7),
      at: timeNow(), level, message
    };
    setEvents(old => [entry, ...old].slice(0, 40));
  }, []);

  const refreshStatus = useCallback(async () => {
    setRefreshing(true);
    try {
      const [a, b] = await Promise.all([
        fetch('/api/integrations/revit/status', { cache: 'no-store' }),
        fetch('/api/integrations/revit/viewer/status', { cache: 'no-store' })
      ]);
      if (!a.ok || !b.ok) throw new Error('connection_check_failed');
      const revitResult = await a.json() as RevitStatus;
      const viewerResult = await b.json() as RevitViewerStatus;
      setRevit(revitResult);
      setViewer(viewerResult);
      setConnectionError(false);
      addLog('INFO', 'APS configuration checked. Revit: ' + revitResult.state + '. Viewer: ' + viewerResult.state);
    } catch {
      setConnectionError(true);
      addLog('ERROR', 'Connection status request failed. No Revit jobs submitted.');
    } finally {
      setRefreshing(false);
    }
  }, [addLog]);

  useEffect(() => {
    if (window.matchMedia('(max-width: 780px)').matches) setPanelOpen(false);
    void refreshStatus();
    let live = true;
    void fetch('/api/projects', { cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error('projects unavailable');
      const payload = await response.json() as { projects?: Project[] };
      if (live) setProjects(Array.isArray(payload.projects) ? payload.projects : []);
    }).catch(() => { if (live) setProjectError('Project database unavailable'); });
    return () => { live = false; };
  }, [refreshStatus]);

  function showPanel(next: Tab) {
    setActiveTab(next);
    setPanelOpen(true);
    setNotice('');
  }

  function startExample(instruction: string) {
    setPrompt(instruction);
    setNotice('');
    showPanel('assistant');
  }

  function chooseTool(next: RevitTool) {
    setTool(next);
    setParameters(defaultsForTool(next));
    setNotice('');
    setActiveTab('tools');
  }

  function createDraft(which: RevitTool) {
    const data = which === 'ai' ? {} : { ...parameters };
    const instruction = which === 'ai' ? prompt.trim() : instructionForTool(which, data, '');
    const errors = validateRevitCommand(which, data, instruction);
    if (errors.length) {
      setNotice(errors.join(' · '));
      addLog('BLOCKED', 'Plan validation: ' + errors.join('; '));
      return;
    }
    const item: RevitDraft = {
      id: String(Date.now()) + Math.random().toString(36).slice(2, 6),
      projectId, projectName, source,
      sourceLabel: source === 'pilot' ? 'New synthetic model' :
        source === 'local' ? 'Local RVT not attached' : 'Project RVT not attached',
      localOnly: true, tool: which, instruction,
      parameters: data, createdAt: new Date().toISOString(),
      reviewed: false, validation: []
    };
    setDrafts(old => [item, ...old]);
    setSelectedId(item.id);
    setCopied(false);
    setNotice('');
    addLog('READY', 'Draft ' + which.toUpperCase() + ' created in browser. Revit execution not submitted.');
    showPanel('plans');
  }

  function reviewPlan() {
    if (!selected) return;
    const errors = validateRevitCommand(selected.tool, selected.parameters, selected.instruction);
    if (errors.length) {
      setNotice(errors.join(' · '));
      addLog('BLOCKED', 'Plan validation: ' + errors.join('; '));
      return;
    }
    setDrafts(old => old.map(item => item.id === selected.id
      ? { ...item, reviewed: true, validation: ['Input fields validated', 'Manual review acknowledged', 'Native execution not available'] }
      : item));
    setNotice('Reviewed locally. No model changes were executed.');
    addLog('READY', 'Draft reviewed; Revit WorkItem remains locked.');
  }

  async function copyPlan() {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify({
        project: selected.projectName, tool: selected.tool, origin: selected.sourceLabel,
        parameters: selected.parameters, instruction: selected.instruction,
        status: 'LOCAL_DRAFT_NOT_EXECUTED'
      }, null, 2));
      setCopied(true);
      setNotice('Plan copied.');
    } catch {
      setNotice('Clipboard unavailable. Select text to copy manually.');
    }
  }

  function removePlan() {
    if (!selected) return;
    setDrafts(old => old.filter(item => item.id !== selected.id));
    setSelectedId(null);
    setNotice('Draft removed.');
    addLog('INFO', 'Local draft removed.');
  }

  function setProject(id: string) {
    setProjectId(id);
    setSource(id === 'pilot' ? 'pilot' : 'project');
    setSelectedId(null);
    setNotice('');
    addLog('INFO', 'Current project changed. Previous drafts keep their original project.');
  }

  const stage = !selected ? 1 : selected.reviewed ? 3 : 2;
  const openModel = () => { setPanelOpen(false); setLogOpen(false); };
  const sourceStatus = source === 'pilot' ? 'New sandbox model' :
    source === 'project' ? 'Project RVT not linked' : 'Local RVT upload unavailable';

  return <div className={'aw-workspace' + (!panelOpen ? ' aw-is-wide' : '')}>
    <div className="aw-toolbar">
      <div className="aw-toolbar-start">
        <button type="button" className="aw-icon-control aw-sidebar-toggle" onClick={() => setPanelOpen(value => !value)}
          aria-label={panelOpen ? 'Hide command panel' : 'Show command panel'} aria-expanded={panelOpen}>
          {panelOpen ? <PanelLeftClose size={18}/> : <PanelLeftOpen size={18}/>}
        </button>
        <div className="aw-project-picker">
          <label htmlFor="aw-project">Project</label>
          <select id="aw-project" value={projectId} onChange={event => setProject(event.target.value)}>
            <option value="pilot">Sandbox / Revit Pilot</option>
            {projects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <span className="aw-toolbar-separator"/>
        <button type="button" className="aw-model-source" onClick={() => showPanel('files')}>
          <FileBox size={15}/><span>{sourceStatus}</span><ChevronRight size={14}/>
        </button>
      </div>
      <div className="aw-toolbar-end">
        <span className={'aw-engine-status' + (nativeEnabled ? ' is-online' : '')}>
          <span className="aw-light"/> Revit {nativeEnabled ? 'ready' : 'not connected'}
        </span>
        <button className="aw-icon-control" type="button" onClick={() => void refreshStatus()}
          title="Refresh APS status" aria-label="Refresh APS status" disabled={refreshing}>
          <RefreshCw size={16} className={refreshing ? 'aw-spinning' : ''}/>
        </button>
      </div>
    </div>

    <div className="aw-layout">
      {panelOpen && <aside className="aw-panel" aria-label="AI and BIM controls">
        <div className="aw-panel-head">
          <div><strong>Command</strong><small>Plan, review, execute</small></div>
          <button type="button" className="aw-icon-control aw-close-panel" onClick={openModel}
            aria-label="Close command panel"><X size={17}/></button>
        </div>
        <div className="aw-tabs" role="tablist" aria-label="Command panel sections">
          {([
            ['assistant', Bot, 'AI'],
            ['tools', PenLine, 'Tools'],
            ['plans', ClipboardCheck, 'Plans'],
            ['files', FolderOpen, 'Files']
          ] as const).map(([id, Icon, label]) =>
            <button key={id} type="button" role="tab" aria-selected={activeTab === id}
              className={activeTab === id ? 'active' : ''} onClick={() => { setActiveTab(id); setNotice(''); }}>
              <Icon size={16}/><span>{label}</span>
              {id === 'plans' && drafts.length > 0 && <em>{drafts.length}</em>}
            </button>)}
        </div>

        {activeTab === 'assistant' && <div className="aw-panel-body">
          <div className="aw-panel-scroll aw-ai-flow">
            <div className="aw-section-title"><Bot size={18}/><div><strong>AI instructions</strong><small>{projectName} · {sourceStatus}</small></div></div>
            <div className="aw-workflow-mini" aria-label="Command progress">
              <div className={stage >= 1 ? 'active' : ''}><span>1</span> Draft</div>
              <ChevronRight size={13}/>
              <div className={stage >= 2 ? 'active' : ''}><span>2</span> Review</div>
              <ChevronRight size={13}/>
              <div className={stage >= 3 ? 'active' : ''}><span>3</span> Run <LockKeyhole size={12}/></div>
            </div>
            <div className="aw-group-head">Quick commands</div>
            <div className="aw-example-list">
              {EXAMPLES.map(item => <button type="button" key={item.label} onClick={() => startExample(item.instruction)}>
                <span><strong>{item.label}</strong><small>{item.description}</small></span><ChevronRight size={15}/>
              </button>)}
            </div>
            <div className="aw-context-note"><ShieldCheck size={15}/> Preparing a command creates a local plan only. Native execution is disabled.</div>
            {selected && <button type="button" className="aw-current-plan" onClick={() => showPanel('plans')}>
              <ClipboardCheck size={16}/><span>Current plan: {selected.tool.toUpperCase()}<small>{selected.reviewed ? 'Reviewed' : 'Needs review'}</small></span><ChevronRight size={16}/>
            </button>}
          </div>
          <div className="aw-composer">
            <label htmlFor="aw-prompt">Instruction</label>
            <textarea id="aw-prompt" rows={6} maxLength={3000} value={prompt}
              onChange={event => { setPrompt(event.target.value); setNotice(''); }}
              onKeyDown={event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault(); createDraft('ai');
              }}}
              placeholder="Describe a Revit task with dimensions, level and constraints..."/>
            <div className="aw-composer-footer">
              <span>{prompt.length}/3000</span><span>⌘ / Ctrl + Enter</span>
            </div>
            {promptErrors.length > 0 && <div className="aw-issues" role="alert">{promptErrors[0]}</div>}
            <button type="button" className="aw-primary" disabled={promptErrors.length > 0} onClick={() => createDraft('ai')}>
              <Plus size={16}/> Prepare plan <ArrowRight size={16}/>
            </button>
          </div>
        </div>}

        {activeTab === 'tools' && <div className="aw-panel-body">
          <div className="aw-panel-scroll">
            <div className="aw-section-title"><PenLine size={18}/><div><strong>BIM tools</strong><small>Structured parameters · draft only</small></div></div>
            <label className="aw-search-box"><Search size={15}/>
              <input value={toolSearch} onChange={event => setToolSearch(event.target.value)}
                placeholder="Find tool" aria-label="Search BIM tools"/>
            </label>
            <div className="aw-tool-tiles">
              {filteredTools.map(item => {
                const Icon = ICONS[item.id];
                return <button type="button" key={item.id} className={tool === item.id ? 'active' : ''}
                  aria-pressed={tool === item.id} onClick={() => chooseTool(item.id)}>
                  <Icon size={18}/><span>{item.name}</span><small>{item.readOnly ? 'Read' : 'Draft'}</small>
                </button>;
              })}
              {filteredTools.length === 0 && <p>No tools match that search.</p>}
            </div>
            <div className="aw-tool-editor">
              <div className="aw-group-head">Parameters / {activeDefinition.name}</div>
              <p>{activeDefinition.description}</p>
              <div className="aw-fields">
                {activeDefinition.fields.map(field => <label key={field.key} className="aw-field">
                  <span>{field.label} {field.unit && <small>{field.unit}</small>}</span>
                  <input type={field.kind === 'number' ? 'number' : 'text'}
                    step={field.kind === 'number' ? 'any' : undefined}
                    min={field.kind === 'number' ? field.min : undefined}
                    value={parameters[field.key] ?? ''}
                    onChange={event => { setParameters(old => ({ ...old, [field.key]: event.target.value })); setNotice(''); }}
                  />
                </label>)}
              </div>
              {paramsErrors.length > 0 && <div className="aw-issues" role="alert">{paramsErrors.map(error => <span key={error}>{error}</span>)}</div>}
              <div className="aw-preview"><strong>Operation preview</strong><p>{instructionForTool(tool, parameters, '')}</p></div>
              <button type="button" className="aw-primary" disabled={paramsErrors.length > 0}
                onClick={() => createDraft(tool)}><Plus size={16}/> Add to plan <ArrowRight size={16}/></button>
            </div>
          </div>
        </div>}

        {activeTab === 'plans' && <div className="aw-panel-body">
          <div className="aw-panel-scroll">
            <div className="aw-section-title"><ClipboardCheck size={18}/><div><strong>Plans & review</strong><small>{drafts.length} local draft{drafts.length === 1 ? '' : 's'}</small></div></div>
            {drafts.length === 0 ? <div className="aw-empty-list">
              <ListChecks size={26}/><strong>No plans</strong><p>Prepare an AI instruction or choose a BIM tool.</p>
              <button type="button" className="aw-secondary" onClick={() => showPanel('assistant')}>New instruction <ArrowRight size={15}/></button>
            </div> : <>
              <div className="aw-plan-list">
                {drafts.map(item => <button type="button" key={item.id}
                  className={selectedId === item.id ? 'active' : ''}
                  onClick={() => { setSelectedId(item.id); setCopied(false); setNotice(''); }}>
                  <span className="aw-plan-symbol"><FileText size={16}/></span>
                  <span className="aw-plan-summary"><strong>{item.tool.toUpperCase()} / {item.projectName}</strong>
                    <small>{new Date(item.createdAt).toLocaleTimeString()} · {item.reviewed ? 'Reviewed' : 'Needs review'}</small></span>
                  <ChevronRight size={15}/>
                </button>)}
              </div>
              {selected && <div className="aw-review">
                <div className="aw-review-heading"><strong>Review plan</strong><span>{selected.reviewed ? 'REVIEWED' : 'DRAFT'}</span></div>
                <dl>
                  <dt>Project</dt><dd>{selected.projectName}</dd>
                  <dt>Source</dt><dd>{selected.sourceLabel}</dd>
                  <dt>Tool</dt><dd>{selected.tool}</dd>
                </dl>
                <div className="aw-review-body">{selected.instruction}</div>
                <div className="aw-checklist">
                  <div><Check size={14}/> Input validation</div>
                  <div className={hasViewer ? '' : 'pending'}>{hasViewer ? <Check size={14}/> : <Clock3 size={14}/>} RVT viewable</div>
                  <div className={selected.reviewed ? '' : 'pending'}>{selected.reviewed ? <Check size={14}/> : <Clock3 size={14}/>} Human review</div>
                  <div className="pending"><LockKeyhole size={14}/> Revit execution adapter</div>
                </div>
                <div className="aw-action-pair">
                  <button type="button" className="aw-secondary" onClick={() => void copyPlan()}>
                    {copied ? <Check size={15}/> : <Copy size={15}/>} {copied ? 'Copied' : 'Copy'}
                  </button>
                  <button type="button" className="aw-secondary" onClick={removePlan}><Trash2 size={15}/> Delete</button>
                </div>
                <button type="button" className="aw-primary" disabled={selected.reviewed}
                  onClick={reviewPlan}><ClipboardCheck size={16}/> {selected.reviewed ? 'Review complete' : 'Mark reviewed'}</button>
                <button type="button" className="aw-locked" disabled title="The Autodesk Revit WorkItem endpoint is not connected in this staging app">
                  <LockKeyhole size={15}/> Run in Revit
                </button>
                <p className="aw-run-caption">Native WorkItem not connected. This is not an execution queue.</p>
              </div>}
            </>}
          </div>
        </div>}

        {activeTab === 'files' && <div className="aw-panel-body">
          <div className="aw-panel-scroll">
            <div className="aw-section-title"><FolderOpen size={18}/><div><strong>Model source</strong><small>Current project: {projectName}</small></div></div>
            <div className="aw-source-options" role="group" aria-label="Select RVT source">
              {([
                ['pilot','New sandbox model','No customer files; Revit generation required'],
                ['project','Project model','An authorized RVT must be linked'],
                ['local','Local RVT','Upload endpoint is not implemented']
              ] as const).map(([id, label, detail]) =>
                <button type="button" key={id} className={source === id ? 'active' : ''}
                  aria-pressed={source === id} onClick={() => { setSource(id); setNotice(''); addLog('INFO', 'Source selected: ' + id); }}>
                  <span className="aw-radio">{source === id && <span/>}</span>
                  <span><strong>{label}</strong><small>{detail}</small></span>
                </button>)}
            </div>
            <div className="aw-group-head">Files</div>
            <div className="aw-file-inventory">
              <div><FileBox size={16}/><span>Source RVT</span><em>Not attached</em></div>
              <div><FileBox size={16}/><span>Viewable / SVF2</span><em>{hasViewer ? 'Configured' : 'Not available'}</em></div>
              <div><ListChecks size={16}/><span>Model report</span><em>Not available</em></div>
            </div>
            {source === 'pilot' && <button type="button" className="aw-primary" onClick={() => startExample(PILOT_INSTRUCTION)}>
              <Plus size={15}/> Prepare pilot instruction
            </button>}
            {source !== 'pilot' && <p className="aw-blocked-note"><LockKeyhole size={16}/> Automatic project import and local RVT upload are not yet connected. No files have been transferred.</p>}
            <a className="aw-external-link" href="https://viewer.autodesk.com/" target="_blank" rel="noreferrer">
              Open Autodesk Viewer externally <ExternalLink size={14}/>
            </a>
            {projectError && <p className="aw-error">{projectError}</p>}
          </div>
        </div>}

        {notice && <div className="aw-notice" role="status">
          <span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Dismiss message"><X size={14}/></button>
        </div>}
      </aside>}

      <main className="aw-main" aria-label="Autodesk model workspace">
        <div className="aw-view-header">
          <div className="aw-view-caption">
            <strong>Model</strong><span>/</span><span>{projectName}</span>
            {!hasViewer && <span className="aw-no-rvt">No RVT loaded</span>}
          </div>
          <div className="aw-view-actions">
            <button type="button" onClick={() => showPanel('files')}><FolderOpen size={15}/> Files</button>
            <button type="button" onClick={() => setLogOpen(value => !value)} aria-expanded={logOpen}><Activity size={15}/> Activity {events.length > 0 && <span>{events.length}</span>}</button>
          </div>
        </div>
        <div className="aw-viewer-frame">
          <RevitApsViewer status={viewer}/>
        </div>
        {logOpen && <div className="aw-activity-drawer" aria-label="Activity log">
          <div className="aw-activity-header"><strong>Activity log</strong><button type="button" onClick={() => setLogOpen(false)} aria-label="Close activity"><X size={15}/></button></div>
          <div className="aw-activity-scroll" role="log" aria-live="off">
            {events.length === 0 && <p>No activity in this session.</p>}
            {events.map(event => <div key={event.id}>
              <time>{event.at}</time><strong className={'aw-log-' + event.level.toLowerCase()}>{event.level}</strong>
              <span>{event.message}</span>
            </div>)}
          </div>
        </div>}
      </main>
    </div>

    <div className="aw-statusbar" role="status">
      <span><span className={nativeEnabled ? 'aw-light is-online' : 'aw-light'}/> Revit {connectionError ? 'status unavailable' : nativeEnabled ? 'ready' : 'offline'}</span>
      <span>Viewer: {viewer?.state === 'READY' ? 'configured' : viewer?.state === 'TRANSLATION_PENDING' ? 'translation pending' : 'no viewable'}</span>
      <span>{drafts.length} local plan{drafts.length === 1 ? '' : 's'}</span>
      <span>Staging / no model writes</span>
    </div>

    <nav className="aw-mobile-dock" aria-label="Mobile workspace navigation">
      {([
        ['model', FileBox, 'Model'],
        ['assistant', Bot, 'AI'],
        ['tools', PenLine, 'Tools'],
        ['plans', ClipboardCheck, 'Plans'],
        ['files', FolderOpen, 'Files']
      ] as const).map(([id, Icon, label]) => <button type="button" key={id}
        className={(id === 'model' && !panelOpen) || (panelOpen && activeTab === id) ? 'active' : ''}
        aria-current={(id === 'model' && !panelOpen) || (panelOpen && activeTab === id) ? 'page' : undefined}
        onClick={() => id === 'model' ? openModel() : showPanel(id)}>
        <Icon size={18}/><span>{label}</span>
      </button>)}
    </nav>
  </div>;
}
