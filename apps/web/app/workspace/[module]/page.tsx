import { AppShell } from '../../../components/app-shell';
import { RevitWorkspace } from '../../../components/revit-workspace';
import { WorkspaceRuntime } from '../../../components/workspace-runtime';

export default async function ModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  return <AppShell active={module}>
    {module === 'revit' ? <RevitWorkspace/> : <WorkspaceRuntime module={module}/>}
  </AppShell>;
}
