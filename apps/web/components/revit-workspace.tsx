'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, Check, ChevronRight, Clock3, Cloud, Copy, DoorOpen,
  FileText, Layers3, Loader2, PanelTop, PenLine, RefreshCw,
  Ruler, ScanLine, Send, Settings2, ShieldCheck, Square, SquareStack
} from 'lucide-react';
import { RevitApsViewer, type RevitViewerStatus } from './revit-aps-viewer';

type Project = {
  id: string;
  name: string;
  status?: string;
  buildingType?: string | null;
  locationText?: string | null;
};

type RevitStatus = {
  state: string;
  credentialsConfigured: boolean;
  appBundleConfigured: boolean;
  activityConfigured: boolean;
  nativeWorkItemVerified: false;
  pilotRvtVerified: false;
  executionEnabled: false;
  diagnostics: string[];
};

type Prepared = { project: string; instruction: string; requestedTool: string | null };
const pilotCommand = 'Buat satu model uji Revit baru berukuran 12 x 20 meter dengan empat dinding perimeter setinggi 3,5 meter. Tambahkan level +0,00 dan +3,50 meter. Simpan sebagai pilot.rvt. Jangan menggunakan atau mengubah model proyek pelanggan.';

const templates = [
  { name: 'Wall', Icon: PenLine, detail: 'Dinding', prompt: 'Buat dinding Revit baru sepanjang 5 meter, tebal 150 mm, tinggi 3.500 mm pada Level 1. Tampilkan perubahan untuk review sebelum dieksekusi.' },
  { name: 'Door', Icon: DoorOpen, detail: 'Pintu', prompt: 'Tambahkan pintu tipe single leaf lebar 900 mm dan tinggi 2.100 mm pada dinding terpilih. Verifikasi host wall terlebih dahulu.' },
  { name: 'Window', Icon: Square, detail: 'Jendela', prompt: 'Tambahkan jendela lebar 1.200 mm, tinggi 1.200 mm, sill 900 mm pada dinding terpilih. Periksa host dan collision.' },
  { name: 'Floor', Icon: PanelTop, detail: 'Pelat lantai', prompt: 'Buat floor slab berdasarkan batas tertutup pada Level 1. Tampilkan boundary, tipe dan tebal sebelum execution.' },
  { name: 'Level', Icon: Layers3, detail: 'Elevasi lantai', prompt: 'Buat Level 2 pada elevasi +3.500 mm. Periksa level yang sudah ada agar tidak membuat duplikat.' },
  { name: 'Measure', Icon: Ruler, detail: 'Ukur model', prompt: 'Baca model RVT dan laporkan panjang, lebar, tinggi dan area objek yang dipilih. Jangan mengubah model.' },
  { name: 'Section', Icon: ScanLine, detail: 'Potongan', prompt: 'Siapkan section view bangunan melewati sumbu utama. Laporkan arah pandang dan crop region untuk review.' },
  { name: 'Properties', Icon: SquareStack, detail: 'Parameter BIM', prompt: 'Baca kategori, family, type, dimensi dan parameter objek Revit yang dipilih. Mode hanya baca.' }
];

const suggestions = [
  { title: 'Start with a test model', subtitle: '12 x 20 m / 4 walls / 2 levels', prompt: pilotCommand },
  { title: 'Inspect an existing RVT', subtitle: 'Walls, floors, rooms and levels', prompt: 'Baca file RVT yang sudah tersedia di Autodesk Automation. Laporkan level, luas, jumlah wall, door, window, floor dan room. Jangan membuat atau mengubah objek apa pun.' },
  { title: 'Boarding house brief', subtitle: 'Bukit Jarian / architecture', prompt: 'Untuk proyek Bukit Jarian, siapkan brief model BIM kos-kosan berdasarkan zoning yang disetujui. Pertahankan lantai dasar untuk parkir, 5 lantai hunian dan rooftop. Jangan menebak geometri atau menjalankan Revit sebelum dokumen acuan dan ukurannya diverifikasi.' }
];

function Step({ number, title, subtitle, active = false }: { number: string; title: string; subtitle: string; active?: boolean }) {
  return <div className="rw-step">
    <span className={active ? 'rw-step-number is-active' : 'rw-step-number'}>{number}</span>
    <div><strong>{title}</strong><small>{subtitle}</small></div>
  </div>;
}

export function RevitWorkspace() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('sandbox');
  const [projectLoading, setProjectLoading] = useState(true);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [revit, setRevit] = useState<RevitStatus | null>(null);
  const [viewer, setViewer] = useState<RevitViewerStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [prompt, setPrompt] = useState(pilotCommand);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);

  const selectedProject = useMemo(() => projects.find(project => project.id === projectId), [projects, projectId]);
  const projectName = selectedProject?.name ?? 'Revit Sandbox Pilot';

  useEffect(() => {
    let mounted = true;
    const getProjects = async () => {
      try {
        const response = await fetch('/api/projects', { cache: 'no-store' });
        if (!response.ok) throw new Error('PROJECT_LIST_UNAVAILABLE');
        const body = await response.json() as { projects?: Project[] };
        if (mounted) setProjects(Array.isArray(body.projects) ? body.projects : []);
      } catch {
        if (mounted) setProjectError('Project database unavailable. Sandbox drafting remains available.');
      } finally {
        if (mounted) setProjectLoading(false);
      }
    };
    void getProjects();
    return () => { mounted = false; };
  }, []);

  const refreshConnections = useCallback(async () => {
    setStatusLoading(true);
    setStatusError(null);
    try {
      const [revitResponse, viewerResponse] = await Promise.all([
        fetch('/api/integrations/revit/status', { cache: 'no-store' }),
        fetch('/api/integrations/revit/viewer/status', { cache: 'no-store' })
      ]);
      if (!revitResponse.ok || !viewerResponse.ok) throw new Error('CONNECTION_STATUS_UNAVAILABLE');
      setRevit(await revitResponse.json() as RevitStatus);
      setViewer(await viewerResponse.json() as RevitViewerStatus);
    } catch {
      setStatusError('Could not check Autodesk integration readiness. No Revit job was submitted.');
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => { void refreshConnections(); }, [refreshConnections]);

  function chooseTool(name: string, template: string) {
    setActiveTool(name);
    setPrompt(template);
    setPrepared(null);
    setFeedback(null);
    setDraftError(null);
    document.getElementById('rw-command-input')?.focus();
  }

  function updatePrompt(value: string) {
    setPrompt(value);
    setPrepared(null);
    setFeedback(null);
    setDraftError(null);
  }

  function prepareInstruction() {
    const instruction = prompt.trim();
    if (instruction.length < 12) {
      setDraftError('Tuliskan instruksi yang lebih spesifik, minimal 12 karakter.');
      return;
    }
    if (instruction.length > 3000) {
      setDraftError('Instruksi terlalu panjang. Maksimum 3.000 karakter.');
      return;
    }
    setPrepared({ project: projectName, instruction, requestedTool: activeTool });
    setDraftError(null);
    setFeedback('Instruction prepared locally. It has NOT been sent to Revit.');
  }

  async function copyDraft() {
    if (!prepared) return;
    try {
      await navigator.clipboard.writeText('ARCHON | Revit command draft\nProject: ' + prepared.project +
        '\nTool: ' + (prepared.requestedTool ?? 'AI command') + '\n\n' + prepared.instruction +
        '\n\nExecution: NOT AUTHORIZED / NOT SUBMITTED');
      setFeedback('Instruction copied. No model was changed.');
    } catch {
      setDraftError('Copy failed. You can still select and copy the instruction above.');
    }
  }

  return <div className="rw-workspace">
    <div className="rw-context-bar">
      <div className="rw-context-heading">
        <span className="rw-eyebrow">YOUR DESIGN WORKSPACE</span>
        <h1>Design with Revit, <span>without the complexity.</span></h1>
        <p>Write a design instruction, review it, then inspect native BIM in Autodesk Viewer when the cloud engine is ready.</p>
      </div>
      <div className="rw-context-controls">
        <label htmlFor="rw-project-select">Working project</label>
        <select id="rw-project-select" value={projectId} onChange={event => {
          setProjectId(event.target.value);
          setPrepared(null);
          setFeedback(null);
        }} aria-label="Select ARCHON project">
          <option value="sandbox">Revit Sandbox Pilot (test only)</option>
          {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
        {projectLoading ? <small>Loading projects...</small> : selectedProject
          ? <small>{selectedProject.locationText ?? selectedProject.buildingType ?? 'ARCHON project'} · No RVT associated yet</small>
          : <small>Safe, isolated draft workspace · no customer model attached</small>}
        {projectError && <small className="rw-small-warning">{projectError}</small>}
      </div>
    </div>

    <div className="rw-main-grid">
      <aside className="rw-control-pane" aria-label="Revit command center">
        <section className="rw-pane-section rw-command-section">
          <div className="rw-section-title"><span className="rw-number-label">01</span><div><h2>Command Center</h2><p>Describe what you want Revit to do.</p></div></div>
          <div className="rw-suggestion-list">
            {suggestions.map(item => <button type="button" key={item.title} className="rw-suggestion" onClick={() => {
              setActiveTool(null);
              updatePrompt(item.prompt);
            }}>
              <span><b>{item.title}</b><small>{item.subtitle}</small></span><ChevronRight size={16}/>
            </button>)}
          </div>
          <label htmlFor="rw-command-input" className="rw-field-title">Your instruction</label>
          <textarea id="rw-command-input" className="rw-command-input" rows={5} maxLength={3000}
            value={prompt} onChange={event => updatePrompt(event.target.value)}
            placeholder="Example: Create four perimeter walls, then add levels at 0 and +3500 mm..."/>
          <div className="rw-command-meta"><span>{activeTool ? 'Manual tool / ' + activeTool : 'AI instruction / Draft'}</span><span>{prompt.length}/3000</span></div>
          <button type="button" className="rw-button rw-button-primary rw-prepare" onClick={prepareInstruction}>
            <Send size={16}/> Prepare instruction <ArrowRight size={16}/>
          </button>
          {draftError && <p className="rw-message rw-message-error" role="alert">{draftError}</p>}
          {feedback && <p className="rw-message" role="status">{feedback}</p>}
          {prepared && <div className="rw-prepared" role="region" aria-label="Prepared Revit instruction">
            <div className="rw-prepared-header"><span><Check size={15}/> Instruction prepared</span><strong>NOT EXECUTED</strong></div>
            <p>{prepared.instruction}</p>
            <small>Project: {prepared.project}. Revit WorkItem submission is still locked.</small>
            <button type="button" className="rw-button rw-button-secondary" onClick={() => void copyDraft()}><Copy size={15}/> Copy instruction</button>
          </div>}
        </section>

        <section className="rw-pane-section rw-tools-section">
          <div className="rw-section-title"><span className="rw-number-label">02</span><div><h2>Manual BIM Tools</h2><p>Tap a tool to prepare its instruction.</p></div></div>
          <div className="rw-tool-grid">
            {templates.map(({ name, Icon, detail, prompt: template }) =>
              <button type="button" key={name} className={activeTool === name ? 'rw-tool is-selected' : 'rw-tool'}
                onClick={() => chooseTool(name, template)} aria-pressed={activeTool === name} title={'Prepare ' + name + ' command'}>
                <Icon size={19} strokeWidth={1.6}/><strong>{name}</strong><small>{detail}</small>
              </button>)}
          </div>
          <p className="rw-tool-note"><ShieldCheck size={14}/> These tools prepare commands only. They do not edit Revit until a native adapter and approval flow are enabled.</p>
        </section>
      </aside>

      <div className="rw-viewer-column">
        <RevitApsViewer status={viewer}/>
        <section className="rw-readiness" aria-label="Revit integration readiness">
          <div className="rw-readiness-header">
            <div><span className="rw-eyebrow">SYSTEM READINESS</span><h2>Cloud engine connection</h2></div>
            <button type="button" className="rw-button rw-button-secondary rw-refresh" disabled={statusLoading}
              onClick={() => void refreshConnections()}>
              {statusLoading ? <Loader2 size={15} className="rw-spin"/> : <RefreshCw size={15}/>}
              Refresh status
            </button>
          </div>
          {statusError && <p className="rw-message rw-message-error" role="alert">{statusError}</p>}
          <div className="rw-readiness-grid">
            <div className="rw-readiness-item"><Cloud size={19}/>
              <strong>Revit API</strong><span>{revit?.credentialsConfigured ? 'Credentials present, unverified' : 'Staging configuration pending'}</span>
            </div>
            <div className="rw-readiness-item"><Clock3 size={19}/>
              <strong>Native model generation</strong><span>Not run yet · no pilot.rvt verified</span>
            </div>
            <div className="rw-readiness-item"><FileText size={19}/>
              <strong>Autodesk Viewer</strong><span>{viewer?.state === 'READY' ? 'Viewable configured' : 'Waiting for translated RVT'}</span>
            </div>
          </div>
          <div className="rw-connection-footnote">
            <span>No production Autodesk jobs are launched by this UI.</span>
            <Link href="/workspace/integrations">Existing connections <Settings2 size={14}/></Link>
          </div>
        </section>
        <section className="rw-workflow">
          <div><span className="rw-eyebrow">SIMPLE PROCESS</span><h2>Four steps from idea to BIM</h2></div>
          <div className="rw-steps">
            <Step number="1" title="Describe" subtitle="Draft your instruction" active/>
            <Step number="2" title="Review" subtitle="Approve a change plan"/>
            <Step number="3" title="Run in Revit" subtitle="Cloud Automation WorkItem"/>
            <Step number="4" title="Inspect" subtitle="Rotate the real RVT model"/>
          </div>
          <p>The last three stages require the native APS integration. The Revit generator remains in <Link href="https://github.com/9dbit/Archon/pull/93" target="_blank">Draft PR #93</Link>; no native RVT has been produced by the current production integration.</p>
        </section>
      </div>
    </div>
    <footer className="rw-footer"><span>ARCHON <span className="rw-muted">/ Native BIM control plane</span></span><span>Draft first. Verify before execution. Original files protected.</span></footer>
  </div>;
}
