import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { Repo } from "../../api/types";
import { PathPicker } from "../PathPicker";
import {
  adminActionLinkCls,
  adminEditShellCls,
  adminItemMetaCls,
  adminItemSubtleCls,
  adminItemTitleCls,
  adminListItemCls,
  emptyStateCls,
  inputCls,
  sectionHeadingCls,
  cancelBtnCls,
  primaryBtnCls,
} from "./adminStyles";
import { DeleteConfirmRow } from "../ui/DeleteConfirmRow";

interface EditState {
  name: string;
  path: string;
  baseBranch: string;
  buildCommand: string;
}

export function ReposSection() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [baseBranch, setBaseBranch] = useState("main");
  const [buildCommand, setBuildCommand] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({
    name: "",
    path: "",
    baseBranch: "",
    buildCommand: "",
  });
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
      const body: { name: string; path: string; baseBranch: string; buildCommand?: string } = {
        name: name.trim(),
        path: path.trim(),
        baseBranch: baseBranch.trim() || "main",
      };
      if (buildCommand.trim()) body.buildCommand = buildCommand.trim();
      const { data } = await api.api.repos.post(body);
      return data!;
    },
    onSuccess: () => {
      setName("");
      setPath("");
      setBaseBranch("main");
      setBuildCommand("");
      setCreateAttempted(false);
      queryClient.invalidateQueries({ queryKey: ["repos"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (id: string) => {
      const body: { name?: string; path?: string; baseBranch?: string; buildCommand?: string } = {
        name: editState.name.trim(),
        path: editState.path.trim(),
        baseBranch: editState.baseBranch.trim() || "main",
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
      buildCommand: repo.buildCommand ?? "",
    });
  };

  return (
    <div className="space-y-6">
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
              placeholder="Base branch (e.g. dev)"
              className={inputCls(false, "flex-1")}
            />
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

      <div>
        <h3 className={sectionHeadingCls}>Repos ({repos.length})</h3>
        {repos.length === 0 ? (
          <p className={emptyStateCls}>No repos configured yet.</p>
        ) : (
          <div className="space-y-1.5">
            {repos.map((repo) => {
              const isConfirming = deletingId === repo.id;
              const isEditing = editingId === repo.id;

              if (isEditing) {
                return (
                  <div key={repo.id} className={adminEditShellCls}>
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
                        value={editState.buildCommand}
                        onChange={(e) => setEditState((s) => ({ ...s, buildCommand: e.target.value }))}
                        placeholder="Build command (e.g. bun run build)"
                        className={inputCls(false, "flex-1")}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setEditAttempted(false);
                        }}
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
                <div key={repo.id} className={adminListItemCls}>
                  <div className="min-w-0 flex-1">
                    <p className={adminItemTitleCls}>{repo.name}</p>
                    <p className={`${adminItemMetaCls} truncate`}>{repo.path}</p>
                    <p className={adminItemSubtleCls}>
                      branch: {repo.baseBranch}
                      {repo.buildCommand ? ` | build ${repo.buildCommand}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {!isConfirming && (
                      <button
                        onClick={() => startEdit(repo)}
                        className={adminActionLinkCls}
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
