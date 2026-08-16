import { useAdapters, useSimulateAdapter } from "@/hooks/use-canvas";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Network,
  Activity,
  AlertTriangle,
  CheckCircle2,
  RotateCw,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { useState } from "react";

export default function WorkspaceIntegrations({
  projectId,
}: {
  projectId: string;
}) {
  const { data: adapters, isLoading } = useAdapters();
  const simulate = useSimulateAdapter("");

  const [simulationResult, setSimulationResult] = useState<{
    adapterId: string;
    data: any;
    mode: string;
  } | null>(null);

  const handleSimulate = async (
    adapterId: string,
    mode: "sync" | "failure",
  ) => {
    try {
      setSimulationResult(null);
      // Hack: we instantiate the hook with '' but then call it... wait, the hook uses the adapterId from state? No, we created useSimulateAdapter(adapterId) which means the URL has it. Let's fix this inline.
      const res = await fetch(`/api/adapters/${adapterId}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, mode }),
      });
      let data = await res.json().catch(() => ({ error: "Parse failed" }));
      if (!res.ok && res.status !== 502) {
        data = { error: "Unknown error" };
      }
      setSimulationResult({ adapterId, data, mode });
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
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Integrations</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Connect to external systems (BIM, ERP, Analytics) and simulate adapter
          behavior.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {adapters?.map((adapter: any) => (
          <Card key={adapter.id} className="flex flex-col">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Network className="w-5 h-5 text-primary" />
                    {adapter.name}
                  </CardTitle>
                  <CardDescription className="font-mono text-xs mt-1">
                    v{adapter.version}
                  </CardDescription>
                </div>
                <Badge
                  variant="outline"
                  className={
                    adapter.health?.status === "HEALTHY"
                      ? "border-emerald-500 text-emerald-600"
                      : "border-destructive text-destructive"
                  }
                >
                  {adapter.health?.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Capabilities
                </h4>
                <div className="flex flex-wrap gap-2">
                  {adapter.capabilities.map((cap: string) => (
                    <Badge
                      key={cap}
                      variant="secondary"
                      className="text-[10px] font-mono"
                    >
                      {cap}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="bg-muted/20 p-3 rounded-md border border-border/50 text-xs font-mono">
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Latency:</span>
                  <span
                    className={
                      adapter.health?.latencyMs > 500
                        ? "text-destructive"
                        : "text-emerald-500"
                    }
                  >
                    {adapter.health?.latencyMs}ms
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Failure Mode:</span>
                  <span>{adapter.failureMode}</span>
                </div>
              </div>

              {simulationResult?.adapterId === adapter.id && (
                <div
                  className={`mt-4 p-3 rounded-md text-xs font-mono border ${
                    simulationResult?.mode === "sync"
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700"
                      : "bg-destructive/10 border-destructive/20 text-destructive"
                  }`}
                >
                  <h4 className="font-bold mb-1">
                    {simulationResult?.mode === "sync"
                      ? "Sync Successful"
                      : "Failure Simulated (502)"}
                  </h4>
                  <pre className="overflow-x-auto">
                    {JSON.stringify(simulationResult?.data, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
            <CardFooter className="pt-4 border-t border-border flex justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 text-xs"
                onClick={() => handleSimulate(adapter.id, "failure")}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-destructive" />{" "}
                Simulate Failure
              </Button>
              <Button
                size="sm"
                className="w-full gap-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => handleSimulate(adapter.id, "sync")}
              >
                <RotateCw className="w-3.5 h-3.5" /> Simulate Sync
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
