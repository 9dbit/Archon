import { useCanvasArtifacts, usePromoteArtifact } from "@/hooks/use-canvas";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PenTool,
  ArrowUpCircle,
  ExternalLink,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { useLocation } from "wouter";

export default function WorkspaceCanvas({ projectId }: { projectId: string }) {
  const { data: artifacts, isLoading } = useCanvasArtifacts(projectId);
  const promote = usePromoteArtifact("", projectId);
  const [, setLocation] = useLocation();

  const handlePromote = async (artifact: any) => {
    try {
      // Create a promotion mutation
      // We pass the operations we want this artifact to promote.
      // For a demo artifact, we might just assume it wants to upsert a canonical object based on its metadata.
      const result = await promote.mutateAsync({
        operations: [
          {
            type: "UPSERT_CANONICAL_OBJECT",
            object: {
              archonId: `obj-${artifact.id.slice(0, 6)}`,
              objectType: artifact.artifactType,
              parameters: artifact.metadata || {},
              relationships: [],
              provenance: {
                sourceType: "CANVAS_PROMOTION",
                sourceReference: artifact.id,
              },
            },
          },
        ],
        intentSummary: `Promote canvas artifact: ${artifact.title}`,
        actor: "user-1",
      });
      // result.changeSet has the new changeset
      if (result.changeSet) {
        setLocation(`/projects/${projectId}`); // Navigate or toast. Handled manually for now.
        alert(`ChangeSet created: ${result.changeSet.id}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Canvas Mode</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Free exploration artifacts. Non-authoritative until promoted.
          </p>
        </div>
      </div>

      <div className="bg-accent/10 border border-accent/20 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-accent shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-accent-foreground">
            Exploratory Sandbox
          </p>
          <p className="text-muted-foreground mt-1">
            Items here are not part of the Building Model. When you are ready to
            make them canonical, use "Promote to ChangeSet". This routes them
            through the rules engine and governance pipeline.
          </p>
        </div>
      </div>

      {!artifacts || artifacts.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-lg bg-card/50">
          <PenTool className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
          <h3 className="text-lg font-medium">No Canvas Artifacts</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-2">
            Generate diagrams, sketches, or massing models in the canvas tools
            to see them appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {artifacts.map((artifact: any) => (
            <Card key={artifact.id} className="flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-start gap-2">
                  <CardTitle
                    className="text-base line-clamp-1"
                    title={artifact.title}
                  >
                    {artifact.title}
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-background"
                  >
                    {artifact.artifactType}
                  </Badge>
                </div>
                <CardDescription className="text-xs font-mono">
                  Src: {artifact.sourceType}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="text-xs bg-muted/30 p-2 rounded-md border border-border/50 font-mono text-muted-foreground h-full min-h-[80px] overflow-hidden relative">
                  <pre>{JSON.stringify(artifact.metadata, null, 2)}</pre>
                  <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-muted/30 to-transparent" />
                </div>
              </CardContent>
              <CardFooter className="pt-4 border-t border-border flex justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  disabled
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1" /> View Asset
                </Button>
                <Button
                  size="sm"
                  className="w-full text-xs gap-1"
                  onClick={() => handlePromote(artifact)}
                  disabled={promote.isPending}
                >
                  <ArrowUpCircle className="w-3.5 h-3.5" />
                  Promote
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
