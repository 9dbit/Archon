import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Scale,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
} from "lucide-react";

export default function WorkspaceRules({ data }: { data: any }) {
  const rules = data.rules || [];

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

      {rules.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-border rounded-lg bg-card/50">
          <Scale className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
          <h3 className="text-lg font-medium">No Active Rules</h3>
          <p className="text-sm text-muted-foreground">
            Interpret a brief or submit a ChangeSet to establish project rules.
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
                  <p className="text-sm font-medium mb-3">{rule.description}</p>

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
