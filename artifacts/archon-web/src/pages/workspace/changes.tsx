import { useState } from "react";
import {
  useChangeSets,
  useChangeSet,
  useValidateChangeSet,
  useApproveChangeSet,
  useRejectChangeSet,
  useChangeSetPreview,
  useUpdateCheck,
} from "@/hooks/use-change-sets";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  ArrowLeft,
  GitPullRequest,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  Info,
  Play,
  MessageSquare,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

function ChangeSetDetail({
  id,
  projectId,
  onBack,
}: {
  id: string;
  projectId: string;
  onBack: () => void;
}) {
  const { data: changeSet, isLoading } = useChangeSet(id);
  const { data: preview } = useChangeSetPreview(id);
  const validate = useValidateChangeSet(id);
  const approve = useApproveChangeSet(id, projectId);
  const reject = useRejectChangeSet(id, projectId);
  const updateCheck = useUpdateCheck(id);

  const [reviewerNote, setReviewerNote] = useState("");
  const [activeCheckId, setActiveCheckId] = useState<string | null>(null);
  const [checkNote, setCheckNote] = useState("");

  if (isLoading)
    return (
      <div className="p-8 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
      </div>
    );
  if (!changeSet) return <div className="p-8">ChangeSet not found.</div>;

  const handleValidate = () => validate.mutate({ actor: "user-1" });
  const handleApprove = () =>
    approve.mutate({ reviewer: "user-1", note: reviewerNote });
  const handleReject = () =>
    reject.mutate({ reviewer: "user-1", note: reviewerNote });
  const handleSaveCheckNote = (checkId: string) => {
    updateCheck.mutate(
      { checkId, data: { reviewerNote: checkNote, actor: "user-1" } },
      {
        onSuccess: () => {
          setActiveCheckId(null);
          setCheckNote("");
        },
      },
    );
  };

  const getStatusBadge = (status: string) => {
    if (["COMMITTED", "APPROVED"].includes(status))
      return (
        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white">
          {status}
        </Badge>
      );
    if (["REJECTED", "VALIDATION_FAILED"].includes(status))
      return <Badge variant="destructive">{status}</Badge>;
    if (["NEEDS_REVIEW"].includes(status))
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 text-white">
          {status}
        </Badge>
      );
    return <Badge variant="secondary">{status}</Badge>;
  };

  const isPending = validate.isPending || approve.isPending || reject.isPending;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold tracking-tight">ChangeSet</h2>
            <Badge
              variant="outline"
              className="font-mono bg-background text-xs"
            >
              {changeSet.id.slice(0, 8)}
            </Badge>
            {getStatusBadge(changeSet.state)}
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            {changeSet.intentSummary || "No summary provided"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="py-4 flex flex-row items-center justify-between bg-muted/20 border-b border-border">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <GitPullRequest className="w-4 h-4 text-primary" />
                Operations
              </CardTitle>
              <Badge variant="secondary" className="font-mono">
                {changeSet.operations?.length || 0} ops
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {changeSet.operations?.map((op: any, i: number) => (
                  <div key={i} className="p-4 flex gap-4 overflow-hidden">
                    <Badge
                      variant="outline"
                      className="h-6 shrink-0 font-mono text-[10px] text-primary border-primary/30 bg-primary/5"
                    >
                      {op.type}
                    </Badge>
                    <div className="flex-1 min-w-0 font-mono text-[11px] bg-muted/30 p-2 rounded text-muted-foreground overflow-x-auto">
                      <pre>{JSON.stringify(op, null, 2)}</pre>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {preview && (
            <Card>
              <CardHeader className="py-4 bg-muted/20 border-b border-border">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Eye className="w-4 h-4 text-primary" />
                  Preview vs v{preview.baseVersionNumber}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider mb-2 text-destructive">
                    Before
                  </h4>
                  <div className="bg-destructive/5 border border-destructive/20 rounded p-2 text-[10px] font-mono overflow-auto max-h-[300px]">
                    <pre>{JSON.stringify(preview.before, null, 2)}</pre>
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider mb-2 text-emerald-500">
                    After
                  </h4>
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded p-2 text-[10px] font-mono overflow-auto max-h-[300px]">
                    <pre>{JSON.stringify(preview.after, null, 2)}</pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {changeSet.checks && changeSet.checks.length > 0 && (
            <Card>
              <CardHeader className="py-4 bg-muted/20 border-b border-border">
                <CardTitle className="text-base font-medium">
                  Validation Checks
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {changeSet.checks.map((chk: any) => (
                    <div
                      key={chk.id}
                      className="p-4 hover:bg-muted/10 transition-colors group"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex items-start gap-3">
                          {chk.status === "PASS" && (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                          )}
                          {chk.status === "WARNING" && (
                            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                          )}
                          {(chk.status === "BLOCKER" ||
                            chk.status === "CRITICAL") && (
                            <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                          )}

                          <div>
                            <p className="font-medium text-sm flex items-center gap-2">
                              {chk.category}
                              <Badge
                                variant="outline"
                                className="text-[9px] h-4 py-0 font-mono"
                              >
                                {chk.severity}
                              </Badge>
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {chk.evidence}
                            </p>
                            {chk.reviewerNote && (
                              <div className="mt-2 text-xs bg-accent/10 border border-accent/20 p-2 rounded text-accent-foreground flex items-start gap-2">
                                <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                <span>
                                  <span className="font-semibold">
                                    Reviewer:
                                  </span>{" "}
                                  {chk.reviewerNote}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => {
                            setActiveCheckId(chk.id);
                            setCheckNote(chk.reviewerNote || "");
                          }}
                        >
                          Add Note
                        </Button>
                      </div>

                      {activeCheckId === chk.id && (
                        <div className="mt-4 flex gap-2 animate-in fade-in zoom-in-95 duration-200">
                          <Input
                            value={checkNote}
                            onChange={(e) => setCheckNote(e.target.value)}
                            placeholder="Add a note or waiver reason..."
                            className="h-8 text-xs flex-1"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => handleSaveCheckNote(chk.id)}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs"
                            onClick={() => setActiveCheckId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-base font-medium">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {changeSet.state === "PROPOSED" && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Run the deterministic rules engine against this proposal.
                  </p>
                  <Button
                    className="w-full gap-2"
                    onClick={handleValidate}
                    disabled={isPending}
                  >
                    {validate.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    Run Validation
                  </Button>
                </div>
              )}

              {["NEEDS_REVIEW", "VALIDATION_FAILED"].includes(
                changeSet.state,
              ) && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">
                      Reviewer Note (Optional)
                    </label>
                    <Textarea
                      value={reviewerNote}
                      onChange={(e) => setReviewerNote(e.target.value)}
                      placeholder="Explain your decision..."
                      className="text-sm min-h-[80px]"
                    />
                  </div>

                  {approve.error && (
                    <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/20 flex gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{approve.error.message}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="destructive"
                      onClick={handleReject}
                      disabled={isPending}
                    >
                      {reject.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Reject"
                      )}
                    </Button>
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={handleApprove}
                      disabled={isPending}
                    >
                      {approve.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Approve"
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {["COMMITTED", "APPROVED"].includes(changeSet.state) && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-md flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-sm font-medium">
                    Successfully committed to Building Model
                  </span>
                </div>
              )}

              {changeSet.state === "REJECTED" && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-md flex items-center gap-3">
                  <XCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">
                    Proposal was rejected
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function WorkspaceChanges({ projectId }: { projectId: string }) {
  const { data: changeSets, isLoading } = useChangeSets(projectId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (selectedId) {
    return (
      <ChangeSetDetail
        id={selectedId}
        projectId={projectId}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">ChangeSets</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Proposals to modify the Building Model. Governed through validation
          and review.
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
        </div>
      ) : !changeSets || changeSets.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-border rounded-lg bg-card/50">
          <GitPullRequest className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
          <h3 className="text-lg font-medium">No ChangeSets</h3>
          <p className="text-sm text-muted-foreground">
            Propose changes via interpretation or API.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {changeSets.map((cs: any) => (
            <Card
              key={cs.id}
              className="cursor-pointer hover:border-primary/50 transition-colors group"
              onClick={() => setSelectedId(cs.id)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <GitPullRequest className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-medium text-foreground">
                        {cs.intentSummary || "No summary"}
                      </h3>
                      <Badge
                        variant="outline"
                        className="font-mono text-[10px] bg-background"
                      >
                        {cs.id.slice(0, 8)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono">
                      <span>Src: {cs.source}</span>
                      <span>By: {cs.createdBy}</span>
                      <span>Ops: {cs.operations?.length || 0}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge
                    variant={
                      ["COMMITTED", "APPROVED"].includes(cs.state)
                        ? "default"
                        : ["REJECTED", "VALIDATION_FAILED"].includes(cs.state)
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {cs.state}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ArrowLeft className="w-4 h-4 rotate-180" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
