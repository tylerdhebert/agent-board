import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { Repo } from "../../api/types";
import { PathPicker } from "../PathPicker";
import { inputCls, sectionHeadingCls, cancelBtnCls, primaryBtnCls } from "./adminStyles";
import { DeleteConfirmRow } from "../ui/DeleteConfirmRow";

interface EditState {
  name: string;
  path: string;
  baseBranch: string;
  compareBase: string;
  buildCommand: string;
}

export function ReposSection() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [baseBranch, setBaseBranch] = useState("main");
  const [compareBase, setCompareBase] = useState("");
  const [buildCommand, setBuildCommand] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ name: "", path: "", baseBranch: "", compareBase: "", buildCommand: "" });
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
      const body: { name: string; path: string; baseBranch: string; compareBase?: string; buildCommand?: string } = {
        name: name.trim(),
        path: path.trim(),
        baseBranch: baseBranch.trim() || "main",
      };
      if (compareBase.trim()) body.compareBase = compareBase.trim();
      if (buildCommand.trim()) body.buildCommand = buildCommand.trim();
      const { data } = await api.api.repos.post(body);
      return data!;
    },
    onSuccess: () => {
      setName("");
      setPath("");
      setBaseBranch("main");
      setCompareBase("");
      setBuildCommand("");
      setCreateAttempted(false);
      queryClient.invalidateQueries({ queryKey: ["repos"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (id: string) => {
      const body: { name?: string; path?: string; baseBranch?: string; compareBase?: string; buildCommand?: string } = {
        name: editState.name.trim(),
        path: editState.path.trim(),
        baseBranch: editState.baseBranch.trim() || "main",
        compareBase: editState.compareBase.trim() || undefined,
        buildCommand: editState.buildCommand.trim() || undefined,
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
      buildCommand: repo.buildCommand ?? "",
    });
  };

  return (
    <div className="space-y-6">
      {/* Create form */}
      <div>
        <h3 className={sectionHeadingCls}>Add Repo</h3>
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
              className={inputCls(false, "flex-1")}
            />
            <input
              type="text"
              value={compareBase}
              onChange={(e) => setCompareBase(e.target.value)}
              placeholder="Compare base (e.g. main)"
              className={inputCls(false, "flex-1")}
            />
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={buildCommand}
              onChange={(e) => setBuildCommand(e.target.value)}
              placeholder="Build command (e.g. bun run build)"
              className={inputCls(false, "flex-1")}
            />
            <button
              type="submit"
              disabled={!name.trim() || !path.trim() || createMutation.isPending}
              className={`${primaryBtnCls} shrink-0`}
            >
              {createMutation.isPending ? "Adding..." : "Add Repo"}
            </button>
          </div>
        </form>
      </div>

      {/* Existing repos */}
      <div>
        <h3 className={sectionHeadingCls}>Repos ({repos.length})</h3>
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
                    <input
                      type="text"
                      value={editState.buildCommand}
                      onChange={(e) => setEditState((s) => ({ ...s, buildCommand: e.target.value }))}
                      placeholder="Build command (e.g. bun run build)"
                      className={inputCls(false)}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => { setEditingId(null); setEditAttempted(false); }}
                        className={cancelBtnCls}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSave(repo.id)}
                        disabled={updateMutation.isPending}
                        className={primaryBtnCls}
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
                      {repo.buildCommand && <span className="ml-2 text-[#475569]">build: {repo.buildCommand}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!isConfirming && (
                      <button
                        onClick={() => startEdit(repo)}
                        className="text-[11px] font-mono text-[#64748b] hover:text-[#94a3b8] transition-colors"
                      >
                        Edit
                      </button>
                    )}
                    <DeleteConfirmRow
                      confirming={isConfirming}
                      onStartConfirm={() => setDeletingId(repo.id)}
                      onCancel={() => setDeletingId(null)}
                      onConfirm={() => deleteRepo(repo.id)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
