import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useCanvasArtifacts(projectId: string) {
  return useQuery({
    queryKey: ["projects", projectId, "canvas-artifacts"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/canvas-artifacts`);
      if (!res.ok) throw new Error("Failed to fetch canvas artifacts");
      return res.json();
    },
    enabled: !!projectId,
  });
}

export function usePromoteArtifact(artifactId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      operations: any[];
      intentSummary?: string;
      actor: string;
    }) => {
      const res = await fetch(`/api/canvas-artifacts/${artifactId}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to promote artifact");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["projects", projectId, "canvas-artifacts"],
      });
      queryClient.invalidateQueries({
        queryKey: ["projects", projectId, "change-sets"],
      });
    },
  });
}

export function useAdapters() {
  return useQuery({
    queryKey: ["adapters"],
    queryFn: async () => {
      const res = await fetch(`/api/adapters`);
      if (!res.ok) throw new Error("Failed to fetch adapters");
      return res.json();
    },
  });
}

export function useSimulateAdapter(adapterId: string) {
  return useMutation({
    mutationFn: async (data: {
      projectId: string;
      mode: "sync" | "failure";
    }) => {
      const res = await fetch(`/api/adapters/${adapterId}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      // 502 can happen on failure mode
      if (!res.ok && res.status !== 502)
        throw new Error("Failed to simulate adapter");
      if (res.status === 502) {
        return { error: "Adapter failure simulated", status: 502 };
      }
      return res.json();
    },
  });
}
