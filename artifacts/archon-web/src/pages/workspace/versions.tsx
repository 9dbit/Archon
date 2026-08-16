import { useVersions } from "@/hooks/use-change-sets";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, GitCommit, Loader2 } from "lucide-react";

export default function WorkspaceVersions({
  projectId,
}: {
  projectId: string;
}) {
  const { data: versions, isLoading } = useVersions(projectId);

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Version History
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Immutable log of all committed states of the Building Model.
        </p>
      </div>

      {!versions || versions.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-border rounded-lg bg-card/50">
          <History className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
          <h3 className="text-lg font-medium">No Versions Yet</h3>
          <p className="text-sm text-muted-foreground">
            Approve a ChangeSet to create the first version.
          </p>
        </div>
      ) : (
        <div className="relative pl-6">
          {/* Timeline line */}
          <div className="absolute top-4 bottom-4 left-[27px] w-px bg-border z-0" />

          <div className="space-y-6 relative z-10">
            {versions.map((v: any, index: number) => (
              <div key={v.id} className="flex gap-6 items-start">
                <div className="mt-1.5 bg-background border border-border w-6 h-6 rounded-full flex items-center justify-center shrink-0">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                </div>

                <Card className="flex-1 hover:border-primary/30 transition-colors">
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <Badge className="bg-primary font-mono text-sm px-2">
                          v{v.versionNumber}
                        </Badge>
                        <Badge variant="outline" className="font-mono text-xs">
                          {v.id.slice(0, 8)}
                        </Badge>
                        {index === 0 && (
                          <Badge variant="secondary" className="text-[10px]">
                            LATEST
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">
                        {new Date(v.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="bg-muted/10 rounded-md p-3 border border-border/50 font-mono text-xs text-muted-foreground">
                      <div className="flex items-center gap-2 mb-2">
                        <GitCommit className="w-3.5 h-3.5" />
                        <span className="font-medium text-foreground">
                          ChangeSet:
                        </span>
                        <span>
                          {v.approvedChangeSetId
                            ? v.approvedChangeSetId.slice(0, 8)
                            : "—"}
                        </span>
                      </div>
                      <div className="flex gap-4">
                        <span>Rules: {v.snapshot.rules?.length || 0}</span>
                        <span>
                          Objects: {v.snapshot.canonicalObjects?.length || 0}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
