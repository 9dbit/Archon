import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertCircle } from "lucide-react";

export default function WorkspaceBrief({ data }: { data: any }) {
  // API returns the brief row { id, projectId, brief: {...} } — unwrap it.
  const brief = data.brief?.brief ?? null;

  if (!brief) {
    return (
      <div className="p-8">
        <div className="text-center py-16 border border-dashed border-border rounded-lg bg-card/50">
          <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
          <h3 className="text-lg font-medium text-foreground">
            No Approved Brief
          </h3>
          <p className="text-muted-foreground text-sm mt-1 max-w-md mx-auto">
            This project currently has no canonical brief. Create a ChangeSet to
            establish the initial design brief.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Project Brief</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Approved requirements acting as canonical targets.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Site & Massing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 font-mono text-sm">
            <div className="flex justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">Site Dimensions</span>
              <span className="font-medium">
                {brief.siteWidthMm}mm × {brief.siteDepthMm}mm
              </span>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">Target GFA</span>
              <span className="font-medium">{brief.targetGfaSqm} sqm</span>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">Levels</span>
              <span className="font-medium">{brief.levels}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Setbacks (F/R/S)</span>
              <span className="font-medium">
                {brief.setbacks?.frontMm || 0} / {brief.setbacks?.rearMm || 0} /{" "}
                {brief.setbacks?.sideMm || 0}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Clearances & Standards
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 font-mono text-sm">
            <div className="flex justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">Min Corridor Width</span>
              <span className="font-medium">
                {brief.circulation?.minCorridorWidthMm || "N/A"} mm
              </span>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">Standard Door</span>
              <span className="font-medium">
                {brief.doorStandards?.widthMm || "N/A"} ×{" "}
                {brief.doorStandards?.heightMm || "N/A"} mm
              </span>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">
                Standard Window (Sill/Head)
              </span>
              <span className="font-medium">
                {brief.windowStandards?.sillMm || "N/A"} /{" "}
                {brief.windowStandards?.headMm || "N/A"} mm
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Floor-to-Floor</span>
              <span className="font-medium">
                {brief.floorToFloorHeightsMm?.[0] || "N/A"} mm
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Program Requirements
          </CardTitle>
        </CardHeader>
        <CardContent>
          {brief.programRequirements && brief.programRequirements.length > 0 ? (
            <div className="space-y-3">
              {brief.programRequirements.map((req: any, i: number) => (
                <div
                  key={i}
                  className="flex justify-between items-center p-3 rounded-md bg-muted/30 border border-border/50"
                >
                  <div>
                    <span className="font-medium">{req.name}</span>
                    {req.notes && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {req.notes}
                      </p>
                    )}
                  </div>
                  {req.areaSqm && (
                    <Badge
                      variant="outline"
                      className="font-mono bg-background"
                    >
                      {req.areaSqm} sqm
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No specific program requirements defined.
            </p>
          )}
        </CardContent>
      </Card>

      {brief.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Additional Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {brief.notes}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
