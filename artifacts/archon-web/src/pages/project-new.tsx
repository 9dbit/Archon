import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateProject, useInterpretBrief } from "@/hooks/use-projects";
import { useCreateChangeSet } from "@/hooks/use-change-sets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import {
  Loader2,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function ProjectNew() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [projectId, setProjectId] = useState<string | null>(null);

  // Step 1 data
  const [name, setName] = useState("");
  const [buildingType, setBuildingType] = useState("Commercial");
  const [locationText, setLocationText] = useState("");
  const [briefText, setBriefText] = useState("");

  // Step 2 data (from interpret)
  const [interpretation, setInterpretation] = useState<any>(null);

  const createProject = useCreateProject();
  const interpretBrief = useInterpretBrief(projectId || "");
  const createChangeSet = useCreateChangeSet(projectId || "");

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const proj = await createProject.mutateAsync({
        name,
        buildingType,
        locationText,
        actor: "user-1",
      });
      setProjectId(proj.id);

      if (briefText.trim()) {
        const result = await interpretBrief.mutateAsync({
          text: briefText,
          projectId: proj.id,
        });
        setInterpretation(result);
        setStep(2);
      } else {
        setLocation(`/projects/${proj.id}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmitChangeSet = async () => {
    if (!projectId || !interpretation) return;
    try {
      await createChangeSet.mutateAsync({
        intentSummary: "Initial project brief interpretation",
        source: "AI_PROPOSAL",
        actor: "user-1",
        operations: [
          {
            type: "UPSERT_BRIEF",
            brief: interpretation.brief,
          },
        ],
      });
      setLocation(`/projects/${projectId}`);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full p-8 animate-in fade-in duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">
          Initialize Project
        </h1>
        <p className="text-muted-foreground mt-2">
          Set up a new governed workspace and optionally interpret an initial
          design brief.
        </p>
      </div>

      {step === 1 && (
        <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur-sm">
          <form onSubmit={handleCreateProject}>
            <CardContent className="pt-6 space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    Project Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Apex Tower"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="buildingType">
                    Building Type <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="buildingType"
                    value={buildingType}
                    onChange={(e) => setBuildingType(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="locationText">Location</Label>
                <Input
                  id="locationText"
                  value={locationText}
                  onChange={(e) => setLocationText(e.target.value)}
                  placeholder="e.g. 123 Architecture Blvd, Metropolis"
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="briefText">
                    Initial Design Brief (Optional)
                  </Label>
                  <Badge
                    variant="outline"
                    className="text-xs text-primary border-primary/20 bg-primary/5"
                  >
                    <Sparkles className="w-3 h-3 mr-1" /> AI Assisted
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  Paste client requirements, dimensions, or constraints. Our
                  deterministic engine will interpret this into structured rules
                  and parameters.
                </p>
                <Textarea
                  id="briefText"
                  value={briefText}
                  onChange={(e) => setBriefText(e.target.value)}
                  placeholder="e.g. The client wants a 10-story commercial building on a 50m x 40m site. Floor to floor heights should be 3600mm. Minimum corridor width 1500mm."
                  className="min-h-[160px] resize-none font-mono text-sm leading-relaxed"
                />
              </div>
            </CardContent>
            <CardFooter className="bg-muted/20 border-t border-border/50 py-4 flex justify-between items-center">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setLocation("/")}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createProject.isPending || interpretBrief.isPending}
              >
                {createProject.isPending || interpretBrief.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />{" "}
                    Processing...
                  </>
                ) : briefText.trim() ? (
                  <>
                    Interpret Brief <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                ) : (
                  <>
                    Create Project <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {step === 2 && interpretation && (
        <div className="space-y-6 animate-in slide-in-from-right-8 duration-500">
          <div className="flex items-center gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg text-primary">
            <CheckCircle2 className="w-5 h-5" />
            <div>
              <p className="font-medium text-sm">
                Brief successfully interpreted
              </p>
              <p className="text-xs opacity-80">
                Confidence score: {(interpretation.confidence * 100).toFixed(0)}
                %
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-border/50 shadow-sm bg-card/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  Structured Parameters
                </CardTitle>
                <CardDescription>Extracted quantitative values</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 font-mono text-sm">
                  {Object.entries(interpretation.brief).map(([key, value]) => {
                    if (value === undefined || value === null) return null;
                    if (typeof value === "object")
                      return (
                        <div
                          key={key}
                          className="p-2 bg-muted/30 rounded border border-border/50"
                        >
                          <span className="text-muted-foreground">{key}: </span>
                          <pre className="mt-1 text-xs">
                            {JSON.stringify(value, null, 2)}
                          </pre>
                        </div>
                      );
                    return (
                      <div
                        key={key}
                        className="flex justify-between p-2 bg-muted/30 rounded border border-border/50"
                      >
                        <span className="text-muted-foreground">{key}</span>
                        <span className="font-medium text-foreground">
                          {String(value)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-border/50 shadow-sm bg-card/50">
                <CardHeader>
                  <CardTitle className="text-lg">Assumptions Made</CardTitle>
                  <CardDescription>
                    Values inferred not explicitly stated
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {interpretation.assumptions?.length > 0 ? (
                    <ul className="space-y-2">
                      {interpretation.assumptions.map(
                        (ass: string, i: number) => (
                          <li
                            key={i}
                            className="text-sm flex items-start gap-2 p-2 bg-muted/30 rounded border border-border/50"
                          >
                            <AlertTriangle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                            <span>{ass}</span>
                          </li>
                        ),
                      )}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No assumptions made.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/50 shadow-sm bg-card/50">
                <CardHeader>
                  <CardTitle className="text-lg">Draft Validation</CardTitle>
                  <CardDescription>
                    Pre-checks against standard rules
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {interpretation.draftChecks?.length > 0 ? (
                    <ul className="space-y-2">
                      {interpretation.draftChecks.map((chk: any, i: number) => (
                        <li
                          key={i}
                          className="text-sm p-2 bg-muted/30 rounded border border-border/50 flex flex-col gap-1"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{chk.category}</span>
                            <Badge
                              variant={
                                chk.status === "PASS"
                                  ? "default"
                                  : "destructive"
                              }
                              className="text-[10px] h-5"
                            >
                              {chk.status}
                            </Badge>
                          </div>
                          <span className="text-muted-foreground text-xs">
                            {chk.evidence}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No draft checks returned.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setLocation(`/projects/${projectId}`)}
            >
              Skip & Go to Workspace
            </Button>
            <Button
              onClick={handleSubmitChangeSet}
              disabled={createChangeSet.isPending}
              className="gap-2"
            >
              {createChangeSet.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Submit as Proposed ChangeSet
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
