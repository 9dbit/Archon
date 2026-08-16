import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useProject } from "@/hooks/use-projects";
import {
  FileText,
  PenTool,
  Layers,
  Scale,
  GitPullRequest,
  CheckSquare,
  History,
  Network,
  AlertCircle,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// Sub-components to be imported later
import WorkspaceBrief from "./workspace/brief";
import WorkspaceCanvas from "./workspace/canvas";
import WorkspaceBuilding from "./workspace/building";
import WorkspaceRules from "./workspace/rules";
import WorkspaceChanges from "./workspace/changes";
import WorkspaceVersions from "./workspace/versions";
import WorkspaceIntegrations from "./workspace/integrations";

const TABS = [
  { id: "brief", label: "Brief", icon: FileText },
  { id: "canvas", label: "Canvas", icon: PenTool },
  { id: "building", label: "Building Model", icon: Layers },
  { id: "rules", label: "Rules & Governance", icon: Scale },
  { id: "changes", label: "ChangeSets", icon: GitPullRequest },
  { id: "versions", label: "Version History", icon: History },
  { id: "integrations", label: "Integrations", icon: Network },
];

export default function ProjectWorkspace({
  params,
}: {
  params: { id: string };
}) {
  const [activeTab, setActiveTab] = useState("brief");
  const { data: projectData, isLoading, error } = useProject(params.id);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p>Loading project workspace...</p>
        </div>
      </div>
    );
  }

  if (error || !projectData) {
    return (
      <div className="flex-1 p-8">
        <div className="p-6 border border-destructive/20 bg-destructive/5 text-destructive rounded-lg flex items-center gap-4">
          <AlertCircle className="w-8 h-8 opacity-80" />
          <div>
            <h3 className="font-semibold">Failed to load project</h3>
            <p className="text-sm opacity-80">
              The project might not exist or the server is unreachable.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { project, approved } = projectData;

  return (
    <div className="flex-1 flex overflow-hidden animate-in fade-in duration-300">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-border bg-sidebar flex flex-col shrink-0">
        <div className="p-4 border-b border-border/50">
          <h2 className="font-semibold text-lg truncate" title={project.name}>
            {project.name}
          </h2>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span>{project.buildingType}</span>
            <span>•</span>
            <span className="font-mono">v{approved?.versionNumber || 0}</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left
                  ${
                    isActive
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
              >
                <Icon
                  className={`w-4 h-4 ${isActive ? "opacity-100" : "opacity-70"}`}
                />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
        <div className="h-12 border-b border-border/50 flex items-center px-6 shrink-0 bg-card/50">
          <div className="flex items-center text-sm text-muted-foreground gap-2">
            <Link href="/" className="hover:text-foreground transition-colors">
              Projects
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="truncate max-w-[200px]">{project.name}</span>
            <ChevronRight className="w-4 h-4" />
            <span className="text-foreground font-medium">
              {TABS.find((t) => t.id === activeTab)?.label}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {activeTab === "brief" && <WorkspaceBrief data={projectData} />}
          {activeTab === "canvas" && <WorkspaceCanvas projectId={project.id} />}
          {activeTab === "building" && <WorkspaceBuilding data={projectData} />}
          {activeTab === "rules" && <WorkspaceRules data={projectData} />}
          {activeTab === "changes" && (
            <WorkspaceChanges projectId={project.id} />
          )}
          {activeTab === "versions" && (
            <WorkspaceVersions projectId={project.id} />
          )}
          {activeTab === "integrations" && (
            <WorkspaceIntegrations projectId={project.id} />
          )}
        </div>
      </main>
    </div>
  );
}
