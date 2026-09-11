import { AppShell } from '../../../components/app-shell';
import { WorkspaceRuntime } from '../../../components/workspace-runtime';

export default async function ModulePage({ params }: { params: Promise<{module:string}> }) {
  const { module } = await params;
  return <AppShell active={module}><WorkspaceRuntime module={module}/></AppShell>;
}
