import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_BASE } from "../../api/client";
import type { Status, TransitionRule } from "../../api/types";

export function RulesSection() {
  const queryClient = useQueryClient();
  const [agentPattern, setAgentPattern] = useState("");
  const [fromStatusId, setFromStatusId] = useState<string>("");
  const [toStatusId, setToStatusId] = useState<string>("");

  const { data: rules = [] } = useQuery<TransitionRule[]>({
    queryKey: ["transition-rules"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/transition-rules`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 10_000,
  });

  const { data: statuses = [] } = useQuery<Status[]>({
    queryKey: ["statuses"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/statuses`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 30_000,
  });

  const sortedStatuses = [...statuses].sort((a, b) => a.position - b.position);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/transition-rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentPattern: agentPattern.trim() || null,
          fromStatusId: fromStatusId || null,
          toStatusId,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      setAgentPattern("");
      setFromStatusId("");
      setToStatusId("");
      queryClient.invalidateQueries({ queryKey: ["transition-rules"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`${API_BASE}/transition-rules/${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["transition-rules"] }),
  });

  const statusName = (id: string | null) =>
    id ? (statuses.find((s) => s.id === id)?.name ?? id) : "any status";

  return (
    <div className="space-y-6">
      {/* Info blurb */}
      <p className="text-[11px] font-mono text-[#475569] leading-relaxed">
        Rules control which agents can move cards to which statuses. If no rules exist, all moves are allowed. If rules exist, an agent can only move a card to a status if a matching rule permits it. Moves without an agentId (admin moves) are always allowed.
      </p>

      {/* Create form */}
      <div>
        <h3 className="text-[11px] font-mono text-[#475569] uppercase tracking-wider mb-3">
          New Rule
        </h3>
        <div className="space-y-2">
          <input
            type="text"
            value={agentPattern}
            onChange={(e) => setAgentPattern(e.target.value)}
            placeholder="Agent pattern (e.g. implementer*, or blank = all agents)"
            className="w-full bg-[#0a0a0f] border border-[#2a2a38] rounded-sm px-3 py-2 font-mono text-xs text-[#e2e8f0] placeholder-[#334155] focus:outline-none focus:border-[#6366f1] transition-colors"
          />
          <div className="flex gap-2">
            <select
              value={fromStatusId}
              onChange={(e) => setFromStatusId(e.target.value)}
              className="flex-1 bg-[#0a0a0f] border border-[#2a2a38] rounded-sm px-3 py-2 font-mono text-xs text-[#e2e8f0] focus:outline-none focus:border-[#6366f1] transition-colors"
            >
              <option value="">From: any status</option>
              {sortedStatuses.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <span className="text-[#475569] font-mono text-sm self-center">→</span>
            <select
              value={toStatusId}
              onChange={(e) => setToStatusId(e.target.value)}
              className="flex-1 bg-[#0a0a0f] border border-[#2a2a38] rounded-sm px-3 py-2 font-mono text-xs text-[#e2e8f0] focus:outline-none focus:border-[#6366f1] transition-colors"
            >
              <option value="">To: select status</option>
              {sortedStatuses.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!toStatusId || createMutation.isPending}
            className="px-3 py-2 bg-[#6366f1] hover:bg-[#818cf8] disabled:bg-[#1e1e2a] disabled:text-[#475569] text-white font-mono text-xs rounded-sm transition-colors"
          >
            Add Rule
          </button>
        </div>
      </div>

      {/* Rule list */}
      <div>
        <h3 className="text-[11px] font-mono text-[#475569] uppercase tracking-wider mb-3">
          Active Rules ({rules.length})
        </h3>
        {rules.length === 0 ? (
          <p className="text-[11px] font-mono text-[#334155]">No rules — all agent moves are allowed.</p>
        ) : (
          <div className="space-y-1">
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center gap-3 bg-[#0d0d14] border border-[#1e1e2a] rounded-sm px-3 py-2">
                <span className="text-[11px] font-mono text-[#818cf8] shrink-0">
                  {rule.agentPattern ?? "any agent"}
                </span>
                <span className="text-[10px] font-mono text-[#475569] shrink-0">can move</span>
                <span className="text-[11px] font-mono text-[#64748b] shrink-0">
                  {statusName(rule.fromStatusId)}
                </span>
                <span className="text-[10px] font-mono text-[#475569] shrink-0">→</span>
                <span className="text-[11px] font-mono text-[#22c55e] shrink-0">
                  {statusName(rule.toStatusId)}
                </span>
                <span className="flex-1" />
                <button
                  onClick={() => deleteMutation.mutate(rule.id)}
                  className="text-[11px] font-mono text-[#64748b] hover:text-[#f87171] transition-colors"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
