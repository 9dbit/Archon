import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, CheckCircle2, Loader2, Pencil } from "lucide-react";
import { useCreateChangeSet } from "@/hooks/use-change-sets";

interface BriefFormState {
  siteWidthMm: string;
  siteDepthMm: string;
  levels: string;
  floorToFloorMm: string;
  targetGfaSqm: string;
  minCorridorWidthMm: string;
  notes: string;
}

function toFormState(brief: any): BriefFormState {
  return {
    siteWidthMm: brief?.siteWidthMm?.toString() ?? "",
    siteDepthMm: brief?.siteDepthMm?.toString() ?? "",
    levels: brief?.levels?.toString() ?? "",
    floorToFloorMm: brief?.floorToFloorHeightsMm?.[0]?.toString() ?? "",
    targetGfaSqm: brief?.targetGfaSqm?.toString() ?? "",
    minCorridorWidthMm:
      brief?.circulation?.minCorridorWidthMm?.toString() ?? "",
    notes: brief?.notes ?? "",
  };
}

function BriefEditForm({
  projectId,
  brief,
  onDone,
  onCancel,
}: {
  projectId: string;
  brief: any;
  onDone: () => void;
  onCancel: () => void;
}) {
  const create = useCreateChangeSet(projectId);
  const [form, setForm] = useState<BriefFormState>(() => toFormState(brief));
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof BriefFormState) => (e: any) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const numField = (
    label: string,
    key: keyof BriefFormState,
    testId: string,
  ) => (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase">
        {label}
      </label>
      <Input
        type="number"
        value={form[key]}
        onChange={set(key)}
        data-testid={testId}
      />
    </div>
  );

  const handleSubmit = () => {
    const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
    const levels = num(form.levels);
    const f2f = num(form.floorToFloorMm);
    const nextBrief: any = {
      ...(brief ?? {}),
      lengthUnit: "mm",
      siteWidthMm: num(form.siteWidthMm),
      siteDepthMm: num(form.siteDepthMm),
      levels,
      targetGfaSqm: num(form.targetGfaSqm),
      floorToFloorHeightsMm:
        f2f !== undefined
          ? Array.from({ length: levels ?? 1 }, () => f2f)
          : (brief?.floorToFloorHeightsMm ?? undefined),
      circulation:
        num(form.minCorridorWidthMm) !== undefined
          ? { minCorridorWidthMm: num(form.minCorridorWidthMm) }
          : (brief?.circulation ?? undefined),
      notes: form.notes || undefined,
    };
    // Strip undefined keys so the payload stays a valid brief.
    Object.keys(nextBrief).forEach(
      (k) => nextBrief[k] === undefined && delete nextBrief[k],
    );
    setError(null);
    create.mutate(
      {
        intentSummary: "Brief edited via structured form",
        source: "USER",
        createdBy: "user-1",
        affectedDomains: ["geometry"],
        operations: [{ type: "UPSERT_BRIEF", brief: nextBrief }],
      },
      {
        onSuccess: () => onDone(),
        onError: (e: any) => setError(e.message),
      },
    );
  };

  return (
    <Card>
      <CardHeader className="py-4 bg-muted/20 border-b border-border">
        <CardTitle className="text-base font-medium">
          Propose Brief Change
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {numField("Site Width (mm)", "siteWidthMm", "input-site-width")}
          {numField("Site Depth (mm)", "siteDepthMm", "input-site-depth")}
          {numField("Levels", "levels", "input-levels")}
          {numField(
            "Floor-to-Floor (mm)",
            "floorToFloorMm",
            "input-floor-to-floor",
          )}
          {numField("Target GFA (sqm)", "targetGfaSqm", "input-target-gfa")}
          {numField(
            "Min Corridor (mm)",
            "minCorridorWidthMm",
            "input-min-corridor",
          )}
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase">
            Notes
          </label>
          <Textarea
            value={form.notes}
            onChange={set("notes")}
            className="min-h-[80px] text-sm"
            data-testid="textarea-brief-notes"
          />
        </div>
        {error && (
          <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/20">
            {error}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Submitting creates a governed ChangeSet — it must pass validation and
          review before the brief becomes canonical.
        </p>
        <div className="flex gap-2 justify-end">
          <Button
            variant="ghost"
            onClick={onCancel}
            disabled={create.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={create.isPending}
            data-testid="button-submit-brief-change"
          >
            {create.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Propose ChangeSet"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function WorkspaceBrief({ data }: { data: any }) {
  // API returns the brief row { id, projectId, brief: {...} } — unwrap it.
  const brief = data.brief?.brief ?? null;
  const projectId = data.project?.id;
  const [editing, setEditing] = useState(false);
  const [proposed, setProposed] = useState(false);

  const editButton = (
    <Button
      variant="outline"
      className="gap-2"
      onClick={() => {
        setProposed(false);
        setEditing(true);
      }}
      data-testid="button-edit-brief"
    >
      <Pencil className="w-4 h-4" />
      {brief ? "Propose Brief Change" : "Create Brief"}
    </Button>
  );

  const proposedNotice = proposed && (
    <div
      className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-md flex items-center gap-3"
      data-testid="notice-brief-proposed"
    >
      <CheckCircle2 className="w-5 h-5" />
      <span className="text-sm font-medium">
        ChangeSet proposed. Open the ChangeSets area to validate, review, and
        approve it.
      </span>
    </div>
  );

  if (!brief && !editing) {
    return (
      <div className="p-8 space-y-6">
        {proposedNotice}
        <div className="text-center py-16 border border-dashed border-border rounded-lg bg-card/50">
          <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
          <h3 className="text-lg font-medium text-foreground">
            No Approved Brief
          </h3>
          <p className="text-muted-foreground text-sm mt-1 max-w-md mx-auto mb-4">
            This project currently has no canonical brief. Propose one through a
            governed ChangeSet.
          </p>
          {editButton}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Project Brief
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Approved requirements acting as canonical targets.
          </p>
        </div>
        {!editing && editButton}
      </div>

      {proposedNotice}

      {editing && (
        <BriefEditForm
          projectId={projectId}
          brief={brief}
          onDone={() => {
            setEditing(false);
            setProposed(true);
          }}
          onCancel={() => setEditing(false)}
        />
      )}

      {brief && (
        <>
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
                  <span className="text-muted-foreground">
                    Setbacks (F/R/S)
                  </span>
                  <span className="font-medium">
                    {brief.setbacks?.frontMm || 0} /{" "}
                    {brief.setbacks?.rearMm || 0} /{" "}
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
                  <span className="text-muted-foreground">
                    Min Corridor Width
                  </span>
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
              {brief.programRequirements &&
              brief.programRequirements.length > 0 ? (
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
        </>
      )}
    </div>
  );
}
