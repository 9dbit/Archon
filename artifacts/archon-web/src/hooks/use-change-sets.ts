import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useChangeSets(projectId: string) {
  return useQuery({
    queryKey: ["projects", projectId, "change-sets"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/change-sets`);
      if (!res.ok) throw new Error("Failed to fetch change sets");
      return res.json();
    },
    enabled: !!projectId,
  });
}

export function useChangeSet(changeSetId: string) {
  return useQuery({
    queryKey: ["change-sets", changeSetId],
    queryFn: async () => {
      const res = await fetch(`/api/change-sets/${changeSetId}`);
      if (!res.ok) throw new Error("Failed to fetch change set");
      return res.json();
    },
    enabled: !!changeSetId,
  });
}

export function useChangeSetPreview(changeSetId: string) {
  return useQuery({
    queryKey: ["change-sets", changeSetId, "preview"],
    queryFn: async () => {
      const res = await fetch(`/api/change-sets/${changeSetId}/preview`);
      if (!res.ok) throw new Error("Failed to fetch change set preview");
      return res.json();
    },
    enabled: !!changeSetId,
  });
}

export function useCreateChangeSet(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/projects/${projectId}/change-sets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create change set");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["projects", projectId, "change-sets"],
      });
    },
  });
}

export function useUpdateChangeSet(changeSetId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      operations: unknown[];
      intentSummary?: string;
      actor: string;
    }) => {
      const res = await fetch(`/api/change-sets/${changeSetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to update change set");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["change-sets", changeSetId] });
      queryClient.invalidateQueries({
        queryKey: ["change-sets", changeSetId, "preview"],
      });
      queryClient.invalidateQueries({
        queryKey: ["projects", projectId, "change-sets"],
      });
    },
  });
}

export function useValidateChangeSet(changeSetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { actor: string }) => {
      const res = await fetch(`/api/change-sets/${changeSetId}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to validate change set");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["change-sets", changeSetId] });
      queryClient.invalidateQueries({
        queryKey: ["change-sets", changeSetId, "preview"],
      });
    },
  });
}

export function useApproveChangeSet(changeSetId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { reviewer: string; note?: string }) => {
      const res = await fetch(`/api/change-sets/${changeSetId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to approve change set");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["change-sets", changeSetId] });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
    },
  });
}

export function useRejectChangeSet(changeSetId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { reviewer: string; note?: string }) => {
      const res = await fetch(`/api/change-sets/${changeSetId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to reject change set");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["change-sets", changeSetId] });
      queryClient.invalidateQueries({
        queryKey: ["projects", projectId, "change-sets"],
      });
    },
  });
}

export function useUpdateCheck(changeSetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      checkId,
      data,
    }: {
      checkId: string;
      data: { reviewerNote?: string; waiverReason?: string; actor: string };
    }) => {
      const res = await fetch(
        `/api/change-sets/${changeSetId}/checks/${checkId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      );
      if (!res.ok) throw new Error("Failed to update check");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["change-sets", changeSetId] });
    },
  });
}

export function useVersions(projectId: string) {
  return useQuery({
    queryKey: ["projects", projectId, "versions"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/versions`);
      if (!res.ok) throw new Error("Failed to fetch versions");
      return res.json();
    },
    enabled: !!projectId,
  });
}
