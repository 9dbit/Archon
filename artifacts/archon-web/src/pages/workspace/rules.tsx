import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Scale,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Loader2,
  Pencil,
  Plus,
  Ban,
} from "lucide-react";
import { useCreateChangeSet } from "@/hooks/use-change-sets";

const RULE_SUBJECTS = [
  "corridorWidthMm",
  "doorWidthMm",
  "doorHeightMm",
  "floorToFloorMm",
  "windowSillMm",
  "windowHeadMm",
  "levels",
  "siteWidthMm",
  "siteDepthMm",
];
const RULE_OPERATORS = [">=", "<=", "==", ">", "<"];
const RULE_SEVERITIES = ["INFO", "WARNING", "BLOCKER", "CRITICAL"];

interface RuleFormState {
  code: string;
  category: string;
  description: string;
  subject: string;
  operator: string;
  expectedValue: string;
  unit: string;
  severity: string;
}

const emptyRule: RuleFormState = {
  code: "",
  category: "",
  description: "",
  subject: RULE_SUBJECTS[0]!,
  operator: ">=",
  expectedValue: "",
  unit: "mm",
  severity: "WARNING",
};

function RuleForm({
  projectId,
  initial,
  onDone,
  onCancel,
}: {
  projectId: string;
  initial: RuleFormState;
  onDone: () => void;
  onCancel: () => void;
}) {
  const create = useCreateChangeSet(projectId);
  const [form, setForm] = useState<RuleFormState>(initial);
  const [error, setError] = useState<string | null>(null);
  const isEdit = initial.code !== "";

  const set = (key: keyof RuleFormState) => (e: any) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const selectCls =
    "w-full h-9 rounded-md border border-input bg-background px-3 text-sm";

  const handleSubmit = () => {
    if (!form.code || !form.category || !form.description) {
      setError("Code, category, and description are required.");
      return;
    }
    const value = Number(form.expectedValue);
    if (!Number.isFinite(value)) {
      setError("Expected value must be a number.");
      return;
    }
    setError(null);
    create.mutate(
      {
        intentSummary: `${isEdit ? "Edit" : "Add"} rule ${form.code}`,
        source: "USER",
        createdBy: "user-1",
        affectedDomains: ["rules"],
        operations: [
          {
            type: "UPSERT_RULE",
            rule: {
              code: form.code,
              category: form.category,
              description: form.description,
              subject: form.subject,
              operator: form.operator,
              expectedValue: value,
              unit: form.unit,
              sourceType: "USER_INPUT",
              severity: form.severity,
              active: true,
            },
          },
        ],
      },
      { onSuccess: () => onDone(), onError: (e: any) => setError(e.message) },
    );
  };

  return (
    <Card>
      <CardHeader className="py-4 bg-muted/20 border-b border-border">
        <CardTitle className="text-base font-medium">
          {isEdit ? `Edit Rule ${initial.code}` : "Add Rule"}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase">
              Code
            </label>
            <Input
              value={form.code}
              onChange={set("code")}
              disabled={isEdit}
              data-testid="input-rule-code"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase">
              Category
            </label>
            <Input
              value={form.category}
              onChange={set("category")}
              data-testid="input-rule-category"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase">
              Subject
            </label>
            <select
              value={form.subject}
              onChange={set("subject")}
              className={selectCls}
              data-testid="select-rule-subject"
            >
              {RULE_SUBJECTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase">
              Severity
            </label>
            <select
              value={form.severity}
              onChange={set("severity")}
              className={selectCls}
              data-testid="select-rule-severity"
            >
              {RULE_SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase">
              Operator
            </label>
            <select
              value={form.operator}
              onChange={set("operator")}
              className={selectCls}
              data-testid="select-rule-operator"
            >
              {RULE_OPERATORS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase">
              Expected Value
            </label>
            <Input
              type="number"
              value={form.expectedValue}
              onChange={set("expectedValue")}
              data-testid="input-rule-value"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase">
              Unit
            </label>
            <Input
              value={form.unit}
              onChange={set("unit")}
              data-testid="input-rule-unit"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase">
            Description
          </label>
          <Input
            value={form.description}
            onChange={set("description")}
            data-testid="input-rule-description"
          />
        </div>
        {error && (
          <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/20">
            {error}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Submitting creates a governed ChangeSet — it must pass validation and
          review before the rule becomes active.
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
            data-testid="button-submit-rule"
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

export default function WorkspaceRules({ data }: { data: any }) {
  const rules = data.rules || [];
  const projectId = data.project?.id;
  const create = useCreateChangeSet(projectId);
  const [formInitial, setFormInitial] = useState<RuleFormState | null>(null);
  const [proposed, setProposed] = useState(false);
  const [deactivating, setDeactivating] = useState<string | null>(null);

  const handleDeactivate = (code: string) => {
    setDeactivating(code);
    create.mutate(
      {
        intentSummary: `Deactivate rule ${code}`,
        source: "USER",
        createdBy: "user-1",
        affectedDomains: ["rules"],
        operations: [{ type: "DEACTIVATE_RULE", ruleCode: code }],
      },
      {
        onSuccess: () => {
          setDeactivating(null);
          setProposed(true);
        },
        onError: () => setDeactivating(null),
      },
    );
  };

  const getSeverityIcon = (sev: string) => {
    switch (sev) {
      case "CRITICAL":
        return <XCircle className="w-4 h-4 text-destructive" />;
      case "BLOCKER":
        return <AlertTriangle className="w-4 h-4 text-destructive" />;
      case "WARNING":
        return <AlertTriangle className="w-4 h-4 text-accent" />;
      default:
        return <Info className="w-4 h-4 text-primary" />;
    }
  };
  void getSeverityIcon;

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case "CRITICAL":
        return (
          <Badge variant="destructive" className="text-[10px]">
            Critical
          </Badge>
        );
      case "BLOCKER":
        return (
          <Badge variant="destructive" className="text-[10px] bg-red-800">
            Blocker
          </Badge>
        );
      case "WARNING":
        return (
          <Badge
            variant="outline"
            className="text-[10px] border-accent text-accent"
          >
            Warning
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="text-[10px] border-primary text-primary"
          >
            Info
          </Badge>
        );
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Rules & Governance
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Active constraints enforced by the deterministic engine.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            className="gap-2"
            onClick={() => {
              setProposed(false);
              setFormInitial(emptyRule);
            }}
            data-testid="button-add-rule"
          >
            <Plus className="w-4 h-4" />
            Add Rule
          </Button>
          <div className="flex items-center gap-4 text-sm bg-card p-3 rounded-lg border border-border shadow-sm">
            <div className="flex flex-col items-center px-4">
              <span className="font-mono text-2xl font-semibold">
                {rules.length}
              </span>
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                Active Rules
              </span>
            </div>
          </div>
        </div>
      </div>

      {proposed && (
        <div
          className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-md flex items-center gap-3"
          data-testid="notice-rule-proposed"
        >
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-sm font-medium">
            ChangeSet proposed. Open the ChangeSets area to validate, review,
            and approve it.
          </span>
        </div>
      )}

      {formInitial && (
        <RuleForm
          projectId={projectId}
          initial={formInitial}
          onDone={() => {
            setFormInitial(null);
            setProposed(true);
          }}
          onCancel={() => setFormInitial(null)}
        />
      )}

      {rules.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-border rounded-lg bg-card/50">
          <Scale className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
          <h3 className="text-lg font-medium">No Active Rules</h3>
          <p className="text-sm text-muted-foreground">
            Interpret a brief, add a rule, or submit a ChangeSet to establish
            project rules.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {rules.map((rule: any) => (
            <Card key={rule.id} className={!rule.active ? "opacity-60" : ""}>
              <CardContent className="p-0 flex flex-col md:flex-row">
                <div className="p-4 md:w-1/3 border-b md:border-b-0 md:border-r border-border/50 bg-muted/10 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Badge
                        variant="secondary"
                        className="font-mono text-[10px]"
                      >
                        {rule.code}
                      </Badge>
                      {getSeverityBadge(rule.severity)}
                    </div>
                    <h3 className="font-semibold text-sm">{rule.category}</h3>
                  </div>
                  <div className="mt-4 pt-3 border-t border-border/50">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      Src: <span className="font-mono">{rule.sourceType}</span>
                    </span>
                  </div>
                </div>
                <div className="p-4 md:w-2/3 flex flex-col justify-center">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium mb-3">
                      {rule.description}
                    </p>
                    <div className="flex gap-1.5 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        onClick={() => {
                          setProposed(false);
                          setFormInitial({
                            code: rule.code,
                            category: rule.category,
                            description: rule.description,
                            subject: rule.subject,
                            operator: rule.operator,
                            expectedValue: String(rule.expectedValue),
                            unit: rule.unit,
                            severity: rule.severity,
                          });
                        }}
                        data-testid={`button-edit-rule-${rule.code}`}
                      >
                        <Pencil className="w-3 h-3" />
                        Edit
                      </Button>
                      {rule.active && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 text-xs text-destructive"
                          onClick={() => handleDeactivate(rule.code)}
                          disabled={deactivating === rule.code}
                          data-testid={`button-deactivate-rule-${rule.code}`}
                        >
                          {deactivating === rule.code ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Ban className="w-3 h-3" />
                          )}
                          Deactivate
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-md p-3 flex items-center gap-3 font-mono text-xs">
                    <span className="text-primary font-semibold">
                      {rule.subject}
                    </span>
                    <span className="text-muted-foreground">
                      {rule.operator}
                    </span>
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded font-bold">
                      {rule.expectedValue} {rule.unit}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
