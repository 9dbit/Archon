import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Layers, Box, Link2 } from "lucide-react";

export default function WorkspaceBuilding({ data }: { data: any }) {
  const objects = data.canonicalObjects || [];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Building Model
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          The approved, canonical representation of the project geometry and
          data.
        </p>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        <Card className="lg:col-span-1 bg-sidebar border-sidebar-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Layers className="w-4 h-4" />
              Hierarchy
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Simple tree visualization */}
            {objects.length === 0 ? (
              <p className="text-sm text-muted-foreground">Model is empty.</p>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <Box className="w-3.5 h-3.5 text-primary" />
                  Project Root
                </div>
                <div className="pl-4 border-l border-border/50 ml-1.5 space-y-2 mt-2">
                  {objects.map((obj: any) => (
                    <div
                      key={obj.id}
                      className="flex items-center gap-2 text-muted-foreground"
                    >
                      <div className="w-4 border-t border-border/50" />
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-background"
                      >
                        {obj.objectType}
                      </Badge>
                      <span
                        className="truncate max-w-[120px]"
                        title={obj.archonId}
                      >
                        {obj.archonId}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          {objects.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-border rounded-lg bg-card/50">
              <Layers className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <h3 className="text-lg font-medium text-foreground">
                No Canonical Objects
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-2">
                Promote canvas artifacts or use the API to propose geometry and
                data to the Building Model.
              </p>
            </div>
          ) : (
            objects.map((obj: any) => (
              <Card key={obj.id}>
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-primary text-primary-foreground">
                        {obj.objectType}
                      </Badge>
                      <span className="font-mono text-xs text-muted-foreground">
                        {obj.archonId}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {obj.provenance.sourceType}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="py-3 border-t border-border/50 bg-muted/10 grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Parameters
                    </h4>
                    <div className="space-y-1 font-mono text-[11px]">
                      {Object.entries(obj.parameters || {}).map(([k, v]) => (
                        <div
                          key={k}
                          className="flex justify-between p-1.5 bg-background rounded border border-border/50"
                        >
                          <span className="text-muted-foreground">{k}</span>
                          <span className="font-medium truncate max-w-[120px]">
                            {String(v)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Relationships
                    </h4>
                    {obj.relationships?.length > 0 ? (
                      <div className="space-y-1 font-mono text-[11px]">
                        {obj.relationships.map((rel: any, i: number) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 p-1.5 bg-background rounded border border-border/50"
                          >
                            <Link2 className="w-3 h-3 text-muted-foreground" />
                            <span className="text-primary">{rel.kind}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="truncate max-w-[80px]">
                              {rel.targetArchonId}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        None
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
