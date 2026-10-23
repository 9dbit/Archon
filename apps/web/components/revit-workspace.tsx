'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, Check, ChevronDown, ClipboardList, Cloud, Copy, FileBox, FolderOpen,
  Layers, LockKeyhole, Play, Plus, RefreshCw, Search, Settings2, ShieldCheck,
  SlidersHorizontal, Terminal, Trash2, UploadCloud, WandSparkles
} from 'lucide-react';
import { RevitApsViewer, type RevitViewerStatus } from './revit-aps-viewer';
import {
  REVIT_TOOLS, PILOT_INSTRUCTION, defaultsForTool, instructionForTool,
  validateRevitCommand,
  type RevitDraft, type RevitParameters, type RevitTool, type RevitSource
} from './revit-workflow-spec';

type Project = { id: string; name: string; status?: string; buildingType?: string | null; locationText?: string | null };
type RevitStatus = { state: string; credentialsConfigured: boolean; nativeWorkItemVerified: boolean; executionEnabled: boolean; diagnostics: string[] };
type Tab = 'model' | 'files' | 'jobs';
type InspectorTab = 'properties' | 'plan' | 'system';
type ConsoleEvent = { id: string; time: string; type: 'INFO' | 'READY' | 'BLOCKED' | 'ERROR'; message: string };

const fmt = () => new Date().toLocaleTimeString('en-GB', { hour12: false });
const initialEvent: ConsoleEvent = { id: 'init', time: '--:--:--', type: 'INFO', message: 'Workspace initialized. Native execution remains disabled.' };
const toolGroups = [
  { title: 'Model', ids: ['wall', 'door', 'window', 'floor', 'level'] },
  { title: 'Review', ids: ['inspect', 'section'] }
] as const;

export function RevitWorkspace() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('pilot');
  const [projectLoad, setProjectLoad] = useState('Loading projects');
  const [viewerStatus, setViewerStatus] = useState<RevitViewerStatus | null>(null);
  const [revitStatus, setRevitStatus] = useState<RevitStatus | null>(null);
  const [statusLoad, setStatusLoad] = useState(false);
  const [tool, setTool] = useState<RevitTool>('ai');
  const [parameters, setParameters] = useState<RevitParameters>({});
  const [prompt, setPrompt] = useState(PILOT_INSTRUCTION);
  const [source, setSource] = useState<RevitSource>('pilot');
  const [tab, setTab] = useState<Tab>('model');
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('plan');
  const [drafts, setDrafts] = useState<RevitDraft[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [events, setEvents] = useState<ConsoleEvent[]>([initialEvent]);
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeWorkflow, setActiveWorkflow] = useState<'setup' | 'draft' | 'review' | 'execute' | 'inspect'>('setup');

  const project = projects.find(item => item.id === projectId);
  const projectName = project?.name ?? 'Sandbox Pilot';
  const definition = REVIT_TOOLS.find(item => item.id === tool)!;
  const selectedDraft = drafts.find(item => item.id === selectedDraftId) ?? null;
  const currentInstruction = instructionForTool(tool, parameters, prompt);
  const issues = useMemo(() => validateRevitCommand(tool, parameters, prompt), [tool, parameters, prompt]);
  const nativeReady = revitStatus?.executionEnabled === true && revitStatus?.nativeWorkItemVerified === true;
  const uploadedRvtAvailable = viewerStatus?.state === 'READY';
  const modelAttached = source === 'project' && uploadedRvtAvailable;
  const isPilot = source === 'pilot';

  const addEvent = useCallback((type: ConsoleEvent['type'], message: string) => {
    setEvents(current => [{ id: String(Date.now()) + Math.random().toString(36).slice(2), time: fmt(), type, message }, ...current].slice(0, 30));
  }, []);

  const refresh = useCallback(async () => {
    setStatusLoad(true);
    try {
      const [r, v] = await Promise.all([
        fetch('/api/integrations/revit/status', { cache: 'no-store' }),
        fetch('/api/integrations/revit/viewer/status', { cache: 'no-store' })
      ]);
      if (!r.ok || !v.ok) throw new Error('STATUS_FETCH_FAILED');
      const nextRevit = await r.json() as RevitStatus;
      const nextViewer = await v.json() as RevitViewerStatus;
      setRevitStatus(nextRevit);
      setViewerStatus(nextViewer);
      addEvent('INFO', 'Connection status refreshed. Revit: ' + nextRevit.state + ', Viewer: ' + nextViewer.state);
    } catch {
      addEvent('ERROR', 'Unable to retrieve Revit connection status.');
    } finally {
      setStatusLoad(false);
    }
  }, [addEvent]);

  useEffect(() => {
    void refresh();
    let alive = true;
    void fetch('/api/projects', { cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error();
      const json = await response.json() as { projects?: Project[] };
      if (alive) { setProjects(Array.isArray(json.projects) ? json.projects : []); setProjectLoad(''); }
    }).catch(() => { if (alive) setProjectLoad('Project database unavailable. Sandbox mode only.'); });
    return () => { alive = false; };
  }, [refresh]);

  function chooseTool(next: RevitTool) {
    setTool(next);
    setParameters(defaultsForTool(next));
    if (next === 'ai') setPrompt(PILOT_INSTRUCTION);
    setInspectorTab('plan');
    setActiveWorkflow('draft');
    addEvent('INFO', 'Tool selected: ' + next.toUpperCase());
  }

  function createPlan() {
    const errors = validateRevitCommand(tool, parameters, prompt);
    if (errors.length) { addEvent('BLOCKED', 'Plan validation failed: ' + errors.join('; ')); return; }
    const item: RevitDraft = {
      id: String(Date.now()),
      projectId, projectName,
      source, sourceLabel: isPilot ? 'New isolated metric model' : source === 'local' ? 'Local RVT (not uploaded)' : 'Project RVT (not attached)',
      localOnly: true, tool,
      instruction: currentInstruction, parameters: { ...parameters },
      createdAt: new Date().toISOString(), reviewed: false, validation: []
    };
    setDrafts(items => [item, ...items]);
    setSelectedDraftId(item.id);
    setActiveWorkflow('review');
    setInspectorTab('plan');
    addEvent('READY', 'Plan created locally: ' + definition.name + '. Review required; no Autodesk WorkItem submitted.');
  }

  function reviewSelected() {
    if (!selectedDraft) return;
    const errors = validateRevitCommand(selectedDraft.tool, selectedDraft.parameters,
      selectedDraft.tool === 'ai' ? selectedDraft.instruction : '');
    if (errors.length) { addEvent('BLOCKED', errors.join('; ')); return; }
    setDrafts(all => all.map(item => item.id === selectedDraft.id ? { ...item, reviewed: true, validation: ['Field validation passed', 'Execution not available'] } : item));
    setActiveWorkflow('execute');
    addEvent('READY', 'Plan reviewed. No model modification. Native execution is still locked.');
  }

  function clearPlan(id: string) {
    setDrafts(all => all.filter(item => item.id !== id));
    if (selectedDraftId === id) setSelectedDraftId(null);
    setActiveWorkflow('draft');
    addEvent('INFO', 'Draft removed from this session.');
  }

  async function copyPlan() {
    if (!selectedDraft) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify({
        project: selectedDraft.projectName, tool: selectedDraft.tool,
        source: selectedDraft.sourceLabel, parameters: selectedDraft.parameters,
        instruction: selectedDraft.instruction, state: 'LOCAL_DRAFT_NOT_EXECUTED'
      }, null, 2));
      setCopied(true);
      addEvent('INFO', 'Plan copied to clipboard.');
    } catch { addEvent('ERROR', 'Clipboard access denied by browser.'); }
  }

  return <section className="rw-workspace rw-workspace-v2">
    <div className="rw-workbar">
      <div className="rw-workbar-project">
        <div className="rw-workbar-logo"><FileBox size={18}/></div>
        <div className="rw-project-field">
          <label htmlFor="rw-project">Project</label>
          <select id="rw-project" value={projectId} onChange={event => {
            setProjectId(event.target.value);
            setSource(event.target.value === 'pilot' ? 'pilot' : 'project');
            setActiveWorkflow('setup');
            addEvent('INFO', 'Project context changed. Existing drafts remain attached to their original project.');
          }}>
            <option value="pilot">Sandbox / Native Revit Pilot</option>
            {projects.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}
          </select>
        </div>
        <div className="rw-workbar-meta"><span>RVT {uploadedRvtAvailable ? 'configured' : 'not attached'}</span><span>Units: mm</span></div>
      </div>
      <div className="rw-workbar-actions">
        <span className="rw-workbar-runtime"><span className={nativeReady ? 'rw-signal on' : 'rw-signal'}/>{nativeReady ? 'Revit ready' : 'Revit offline'}</span>
        <button className="rw-utility-button" type="button" onClick={() => void refresh()} disabled={statusLoad} title="Refresh integration status"><RefreshCw size={15}/><span>Refresh</span></button>
      </div>
    </div>

    <nav className="rw-process-nav" aria-label="Revit workflow">
      {([
        ['setup', '01', 'Source'],
        ['draft', '02', 'Build plan'],
        ['review', '03', 'Validate'],
        ['execute', '04', 'Execute'],
        ['inspect', '05', 'Inspect RVT']
      ] as const).map(([id, number, title]) =>
        <button key={id} type="button" className={activeWorkflow === id ? 'active' : ''} onClick={() => setActiveWorkflow(id)}>
          <span>{number}</span>{title}{id === 'execute' && !nativeReady && <LockKeyhole size={12}/>}
        </button>)}
    </nav>

    <div className="rw-workbench">
      <aside className="rw-left-pane" aria-label="Model tools">
        <div className="rw-panel-header"><strong>Model operations</strong><small>{projectName}</small></div>
        <div className="rw-left-scroll">
          <div className="rw-pane-group">
            <label className="rw-field-label" htmlFor="rw-model-source">Input source</label>
            <select id="rw-model-source" value={source} onChange={event => { setSource(event.target.value as RevitSource); setActiveWorkflow('setup'); }}>
              <option value="pilot">New sandbox model</option>
              <option value="project">Project model</option>
              <option value="local">Local .rvt file</option>
            </select>
            <p className="rw-inline-note">{source === 'pilot' ? 'New model. No customer files.' : source === 'local' ? 'Direct RVT upload is not connected. Select a project or use a sandbox.' : 'Requires an authorized RVT attachment. No model linked yet.'}</p>
          </div>
          <div className="rw-pane-group">
            <div className="rw-group-heading"><strong>AI</strong><small>Natural language</small></div>
            <button type="button" className={tool === 'ai' ? 'rw-operation active' : 'rw-operation'} onClick={() => chooseTool('ai')}>
              <WandSparkles size={17}/> Prompt command <ChevronDown size={14}/>
            </button>
          </div>
          {toolGroups.map(group => <div className="rw-pane-group" key={group.title}>
            <div className="rw-group-heading"><strong>{group.title}</strong><small>{group.title === 'Model' ? 'BIM elements' : 'Read and views'}</small></div>
            <div className="rw-operation-list">
              {group.ids.map(id => { const item = REVIT_TOOLS.find(entry => entry.id === id)!;
                return <button type="button" className={tool === id ? 'rw-operation active' : 'rw-operation'}
                  key={id} onClick={() => chooseTool(id)} aria-pressed={tool === id}>
                  <Layers size={16}/>{item.name}<span>{item.readOnly ? 'READ' : 'DRAFT'}</span>
                </button>;
              })}
            </div>
          </div>)}
          <div className="rw-pane-group">
            <div className="rw-group-heading"><strong>Model browser</strong><small>Autodesk RVT</small></div>
            <div className="rw-tree">
              <div><FolderOpen size={15}/>{projectName}</div>
              <div className="rw-tree-child"><FileBox size={15}/>{modelAttached ? 'Configured Autodesk viewable' : 'No RVT file connected'}</div>
              <div className="rw-tree-child"><Layers size={15}/> Levels <small>Unavailable</small></div>
              <div className="rw-tree-child"><Layers size={15}/> Categories <small>Unavailable</small></div>
              <div className="rw-tree-child"><Layers size={15}/> Views <small>Unavailable</small></div>
            </div>
          </div>
        </div>
      </aside>

      <main className="rw-stage-pane" aria-label="Project working area">
        <div className="rw-stage-tabs">
          <div className="rw-tab-list" role="tablist" aria-label="Workspace panels">
            <button role="tab" aria-selected={tab === 'model'} className={tab === 'model' ? 'active' : ''} onClick={() => setTab('model')}><FileBox size={15}/> Viewer</button>
            <button role="tab" aria-selected={tab === 'files'} className={tab === 'files' ? 'active' : ''} onClick={() => setTab('files')}><FolderOpen size={15}/> Files</button>
            <button role="tab" aria-selected={tab === 'jobs'} className={tab === 'jobs' ? 'active' : ''} onClick={() => setTab('jobs')}><Activity size={15}/> Jobs <span>{drafts.length}</span></button>
          </div>
          <span className="rw-stage-mode">{tab === 'model' ? 'APS VIEWER · READ ONLY' : tab === 'files' ? 'FILE INVENTORY' : 'LOCAL QUEUE'}</span>
        </div>
        {tab === 'model' ? <RevitApsViewer status={viewerStatus}/> : tab === 'files' ?
          <div className="rw-stage-empty">
            <UploadCloud size={28}/><strong>Model files</strong>
            <p>{source === 'pilot' ? 'No pilot.rvt has been generated.' : 'No native RVT is attached to this workspace.'}</p>
            <div className="rw-file-row"><FileBox size={16}/> Current RVT <span>Not available</span></div>
            <div className="rw-file-row"><FileBox size={16}/> SVF2 derivative <span>{uploadedRvtAvailable ? 'Configured' : 'Not available'}</span></div>
            <small>Upload, version storage and Autodesk translation are pending. File controls do not transfer data yet.</small>
          </div> :
          <div className="rw-job-list">
            <div className="rw-job-list-head">Local plans <span>{drafts.length} in this session</span></div>
            {drafts.length ? drafts.map(item => <button type="button" key={item.id} className={selectedDraftId === item.id ? 'rw-job active' : 'rw-job'} onClick={() => { setSelectedDraftId(item.id); setInspectorTab('plan'); }}>
              <ClipboardList size={17}/><span><strong>{item.tool.toUpperCase()} · {item.projectName}</strong><small>{new Date(item.createdAt).toLocaleString()} · {item.reviewed ? 'Reviewed' : 'Needs review'}</small></span><span>LOCAL</span>
            </button>) : <div className="rw-stage-empty compact"><ClipboardList size={25}/><strong>No plans yet</strong><small>Choose a tool, define parameters and create a plan.</small></div>}
          </div>}
        <div className="rw-console">
          <button type="button" className="rw-console-heading" onClick={() => setConsoleOpen(value => !value)} aria-expanded={consoleOpen}>
            <span><Terminal size={15}/> Activity console <small>{events.length} entries</small></span><ChevronDown size={15}/>
          </button>
          {consoleOpen && <div className="rw-console-body" role="log" aria-label="Workspace activity">
            {events.map(item => <div key={item.id}><time>{item.time}</time><span className={'rw-console-' + item.type.toLowerCase()}>{item.type}</span><span>{item.message}</span></div>)}
          </div>}
        </div>
      </main>

      <aside className="rw-right-pane" aria-label="Commands and properties">
        <div className="rw-inspector-tabs" role="tablist" aria-label="Inspector tabs">
          {([['properties','Parameters'],['plan','Command'],['system','Status']] as const).map(([id,title]) =>
            <button key={id} type="button" role="tab" aria-selected={inspectorTab === id} className={inspectorTab === id ? 'active' : ''} onClick={() => setInspectorTab(id)}>{title}</button>)}
        </div>
        <div className="rw-right-scroll">
          {inspectorTab === 'system' ? <div className="rw-inspector-section">
            <strong>System connections</strong>
            <div className="rw-status-grid">
              <div>Revit credentials <span>{revitStatus?.credentialsConfigured ? 'Present, not verified' : 'Not configured'}</span></div>
              <div>Native WorkItems <span>Not verified</span></div>
              <div>RVT generation <span>Pending</span></div>
              <div>Model derivative <span>{viewerStatus?.translationStatus ?? 'Checking'}</span></div>
              <div>APS Viewer <span>{viewerStatus?.state ?? 'Checking'}</span></div>
              <div>Write API <span>Locked</span></div>
            </div>
            <button type="button" className="rw-button rw-button-secondary" disabled={statusLoad} onClick={() => void refresh()}><RefreshCw size={15}/> Refresh</button>
          </div> : inspectorTab === 'properties' ? <div className="rw-inspector-section">
            <strong>{definition.name} parameters</strong>
            <p>{definition.description}</p>
            {definition.fields.length ? <div className="rw-parameter-grid">
              {definition.fields.map(field => <label key={field.key} className="rw-parameter-field">
                <span>{field.label} {field.unit && <small>{field.unit}</small>}</span>
                <input type={field.kind === 'number' ? 'number' : 'text'} value={parameters[field.key] ?? ''}
                  step={field.kind === 'number' ? 'any' : undefined}
                  onChange={event => setParameters(current => ({ ...current, [field.key]: event.target.value }))}/>
              </label>)}
            </div> : <p>Use the Command tab to enter a natural language instruction.</p>}
            {issues.length > 0 && <div role="alert" className="rw-validation-errors">{issues.map(e => <div key={e}>{e}</div>)}</div>}
            <button type="button" className="rw-button rw-button-primary rw-wide" disabled={issues.length > 0} onClick={createPlan}><Plus size={15}/> Create plan</button>
          </div> : <div className="rw-inspector-section">
            <strong>Command editor</strong>
            <div className="rw-brief-line">Tool <b>{definition.name}</b></div>
            <div className="rw-brief-line">Source <b>{source === 'pilot' ? 'New sandbox RVT' : source === 'local' ? 'Local file not uploaded' : 'Project RVT pending'}</b></div>
            {tool === 'ai' ? <label className="rw-field-label" htmlFor="rw-command">Instruction
              <textarea id="rw-command" rows={7} value={prompt} maxLength={3000} onChange={event => setPrompt(event.target.value)} placeholder="Describe a Revit operation..."/>
            </label> : <div>
              <p className="rw-inspector-help">Structured BIM tool. Edit parameters under the Parameters tab. The generated instruction is shown below.</p>
              <div className="rw-preview-text">{currentInstruction}</div>
              <button type="button" className="rw-inline-button" onClick={() => setInspectorTab('properties')}><SlidersHorizontal size={14}/> Edit parameters</button>
            </div>}
            {issues.length > 0 && <div role="alert" className="rw-validation-errors">{issues.map(e => <div key={e}>{e}</div>)}</div>}
            <button type="button" className="rw-button rw-button-primary rw-wide" disabled={issues.length > 0} onClick={createPlan}><Plus size={15}/> Create plan</button>
          </div>}
          <div className="rw-inspector-section rw-plan-section">
            <div className="rw-section-row"><strong>Plan review</strong><span>{selectedDraft ? (selectedDraft.reviewed ? 'REVIEWED' : 'DRAFT') : 'EMPTY'}</span></div>
            {selectedDraft ? <>
              <div className="rw-brief-line">Project <b>{selectedDraft.projectName}</b></div>
              <div className="rw-brief-line">Tool <b>{selectedDraft.tool}</b></div>
              <div className="rw-brief-line">Origin <b>{selectedDraft.sourceLabel}</b></div>
              <div className="rw-preview-text">{selectedDraft.instruction}</div>
              <div className="rw-plan-actions">
                <button type="button" className="rw-button rw-button-secondary" onClick={() => void copyPlan()}>{copied ? <Check size={14}/> : <Copy size={14}/>} Copy</button>
                <button type="button" className="rw-button rw-button-secondary" onClick={() => clearPlan(selectedDraft.id)}><Trash2 size={14}/> Remove</button>
              </div>
              <button type="button" className="rw-button rw-button-primary rw-wide" disabled={selectedDraft.reviewed} onClick={reviewSelected}><ShieldCheck size={15}/> {selectedDraft.reviewed ? 'Reviewed' : 'Validate & review'}</button>
            </> : <p>No active plan. Choose a tool and create one.</p>}
          </div>
          <div className="rw-inspector-section rw-execution">
            <div className="rw-section-row"><strong>Revit execution</strong><LockKeyhole size={15}/></div>
            <div className="rw-status-grid">
              <div>Plan validated <span>{selectedDraft?.reviewed ? 'Yes' : 'No'}</span></div>
              <div>Native adapter <span>{nativeReady ? 'Verified' : 'Unverified'}</span></div>
              <div>Execution gate <span>Closed</span></div>
            </div>
            <button type="button" className="rw-button rw-wide rw-execute-button" disabled title="Native Revit WorkItem submission is not connected in this staging UI"><Play size={15}/> Run in Revit</button>
            <p>Locked until native generation, provenance checks and the approved WorkItem workflow are integrated. No changes sent to Autodesk.</p>
          </div>
        </div>
      </aside>
    </div>
    <footer className="rw-operational-footer">
      <span><span className={nativeReady ? 'rw-signal on' : 'rw-signal'}/> Revit {nativeReady ? 'available' : 'not connected'}</span>
      <span>Model: {uploadedRvtAvailable ? 'viewable configured' : 'no translated RVT'}</span>
      <span>Drafts: {drafts.length}</span>
      <span>Session only · No changes committed</span>
    </footer>
  </section>;
}
