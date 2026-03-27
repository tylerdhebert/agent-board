import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { Repo } from "../../api/types";
import { PathPicker } from "../PathPicker";

function inputCls(invalid = false, width = "w-full") {
  return `${width} bg-[#0a0a0f] border rounded-sm px-3 py-2 font-mono text-xs text-[#e2e8f0] placeholder-[#334155] focus:outline-none transition-colors ${
    invalid ? "border-[#f87171] focus:border-[#f87171]" : "border-[#2a2a38] focus:border-[#6366f1]"
  }`;
}

interface EditState {
  name: string;
  path: string;
  baseBranch: string;
  compareBase: string;
}

export function ReposSection() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [baseBranch, setBaseBranch] = useState("main");
  const [compareBase, setCompareBase] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ name: "", path: "", baseBranch: "", compareBase: "" });
  const [createAttempted, setCreateAttempted] = useState(false);
  const [editAttempted, setEditAttempted] = useState(false);

  const { data: repos = [] } = useQuery<Repo[]>({
    queryKey: ["repos"],
    queryFn: async () => {
      const { data } = await api.api.repos.get();
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: { name: string; path: string; baseBranch: string; compareBase?: string } = {
        name: name.trim(),
        path: path.trim(),
        baseBranch: baseBranch.trim() || "main",
      };
      if (compareBase.trim()) body.compareBase = compareBase.trim();
      const { data } = await api.api.repos.post(body);
      return data!;
    },
    onSuccess: () => {
      setName("");
      setPath("");
      setBaseBranch("main");
      setCompareBase("");
      setCreateAttempted(false);
      queryClient.invalidateQueries({ queryKey: ["repos"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (id: string) => {
      const body: { name?: string; path?: string; baseBranch?: string; compareBase?: string } = {
        name: editState.name.trim(),
        path: editState.path.trim(),
        baseBranch: editState.baseBranch.trim() || "main",
        compareBase: editState.compareBase.trim() || undefined,
      };
      await api.api.repos({ id }).patch(body);
    },
    onSuccess: () => {
      setEditingId(null);
      setEditAttempted(false);
      queryClient.invalidateQueries({ queryKey: ["repos"] });
      queryClient.invalidateQueries({ queryKey: ["feature-commits"] });
    },
  });

  const deleteRepo = async (id: string) => {
    await api.api.repos({ id }).delete();
    queryClient.invalidateQueries({ queryKey: ["repos"] });
    setDeletingId(null);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateAttempted(true);
    if (!name.trim() || !path.trim()) return;
    createMutation.mutate();
  };

  const handleSave = (id: string) => {
    setEditAttempted(true);
    if (!editState.name.trim() || !editState.path.trim() || !editState.baseBranch.trim()) return;
    updateMutation.mutate(id);
  };

  const startEdit = (repo: Repo) => {
    setDeletingId(null);
    setEditAttempted(false);
    setEditingId(repo.id);
    setEditState({
      name: repo.name,
      path: repo.path,
      baseBranch: repo.baseBranch,
      compareBase: repo.compareBase ?? "",
    });
  };

  return (
    <div className="space-y-6">
      {/* Create form */}
      <div>
        <h3 className="text-[11px] font-mono text-[#475569] uppercase tracking-wider mb-3">
          Add Repo
        </h3>
        <form onSubmit={handleCreate} className="space-y-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Repo name (e.g. api-service)"
            className={inputCls(createAttempted && !name.trim())}
          />
          <PathPicker
            value={path}
            onChange={setPath}
            placeholder="Absolute path (e.g. /home/user/projects/api)"
            invalid={createAttempted && !path.trim()}
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={baseBranch}
              onChange={(e) => setBaseBranch(e.target.value)}
              placeholder="Base branch (e.g. feature/my-branch)"
              className="flex-1 bg-[#0a0a0f] border border-[#2a2a38] rounded-sm px-3 py-2 font-mono text-xs text-[#e2e8f0] placeholder-[#334155] focus:outline-none focus:border-[#6366f1] transition-colors"
            />
            <input
              type="text"
              value={compareBase}
              onChange={(e) => setCompareBase(e.target.value)}
              placeholder="Compare base (e.g. main)"
              className="flex-1 bg-[#0a0a0f] border border-[#2a2a38] rounded-sm px-3 py-2 font-mono text-xs text-[#e2e8f0] placeholder-[#334155] focus:outline-none focus:border-[#6366f1] transition-colors"
            />
            <button
              type="submit"
              disabled={!name.trim() || !path.trim() || createMutation.isPending}
              className="px-4 py-2 bg-[#6366f1] hover:bg-[#818cf8] disabled:bg-[#1e1e2a] disabled:text-[#475569] text-white font-mono text-xs rounded-sm transition-colors shrink-0"
            >
              {createMutation.isPending ? "Adding..." : "Add Repo"}
            </button>
          </div>
        </form>
      </div>

      {/* Existing repos */}
      <div>
        <h3 className="text-[11px] font-mono text-[#475569] uppercase tracking-wider mb-3">
          Repos ({repos.length})
        </h3>
        {repos.length === 0 ? (
          <p className="text-[11px] font-mono text-[#334155]">No repos configured yet.</p>
        ) : (
          <div className="space-y-1">
            {repos.map((repo) => {
              const isConfirming = deletingId === repo.id;
              const isEditing = editingId === repo.id;

              if (isEditing) {
                return (
                  <div
                    key={repo.id}
                    className="bg-[#0d0d14] border border-[#2a2a4a] rounded-sm px-3 py-3 space-y-2"
                  >
                    <input
                      type="text"
                      value={editState.name}
                      onChange={(e) => setEditState((s) => ({ ...s, name: e.target.value }))}
                      placeholder="Name"
                      className={inputCls(editAttempted && !editState.name.trim())}
                    />
                    <PathPicker
                      value={editState.path}
                      onChange={(v) => setEditState((s) => ({ ...s, path: v }))}
                      placeholder="Absolute path"
                      invalid={editAttempted && !editState.path.trim()}
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editState.baseBranch}
                        onChange={(e) => setEditState((s) => ({ ...s, baseBranch: e.target.value }))}
                        placeholder="Base branch"
                        className={inputCls(editAttempted && !editState.baseBranch.trim(), "flex-1")}
                      />
                      <input
                        type="text"
                        value={editState.compareBase}
                        onChange={(e) => setEditState((s) => ({ ...s, compareBase: e.target.value }))}
                        placeholder="Compare base (e.g. main)"
                        className={inputCls(false, "flex-1")}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => { setEditingId(null); setEditAttempted(false); }}
                        className="text-[11px] font-mono text-[#64748b] hover:text-[#94a3b8] transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSave(repo.id)}
                        disabled={updateMutation.isPending}
                        className="px-3 py-1 bg-[#6366f1] hover:bg-[#818cf8] disabled:bg-[#1e1e2a] disabled:text-[#475569] text-white font-mono text-xs rounded-sm transition-colors"
                      >
                        {updateMutation.isPending ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={repo.id}
                  className="bg-[#0d0d14] border border-[#1e1e2a] rounded-sm px-3 py-2 flex items-start gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-mono text-[#e2e8f0]">{repo.name}</p>
                    <p className="text-[11px] font-mono text-[#475569] mt-0.5 truncate">
                      {repo.path}
                    </p>
                    <p className="text-[10px] font-mono text-[#334155] mt-0.5">
                      branch: {repo.baseBranch}
                      {repo.compareBase && <span className="ml-2 text-[#475569]">← {repo.compareBase}</span>}
                    </p>
                  </div>
                  {!isConfirming ? (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => startEdit(repo)}
                        className="text-[11px] font-mono text-[#64748b] hover:text-[#94a3b8] transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeletingId(repo.id)}
                        className="text-[11px] font-mono text-[#64748b] hover:text-[#f87171] transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setDeletingId(null)}
                          className="text-[11px] font-mono text-[#64748b] hover:text-[#94a3b8] transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => deleteRepo(repo.id)}
                          className="px-2 py-0.5 bg-[#3b1f1f] border border-[#7f1d1d] hover:bg-[#5c1f1f] text-[#f87171] font-mono text-[11px] rounded-sm transition-colors"
                        >
                          Confirm
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
