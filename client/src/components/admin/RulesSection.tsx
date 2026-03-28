import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { Status, TransitionRule } from "../../api/types";
import { inputCls, selectCls, sectionHeadingCls, primaryBtnCls } from "./adminStyles";

export function RulesSection() {
  const queryClient = useQueryClient();
  const [agentPattern, setAgentPattern] = useState("");
  const [fromStatusId, setFromStatusId] = useState<string>("");
  const [toStatusId, setToStatusId] = useState<string>("");

  const { data: rules = [] } = useQuery<TransitionRule[]>({
    queryKey: ["transition-rules"],
    queryFn: async () => {
      const { data } = await api.api["transition-rules"].get();
      return data ?? [];
    },
    staleTime: 10_000,
  });

  const { data: statuses = [] } = useQuery<Status[]>({
    queryKey: ["statuses"],
    queryFn: async () => {
      const { data } = await api.api.statuses.get();
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const sortedStatuses = [...statuses].sort((a, b) => a.position - b.position);

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.api["transition-rules"].post({
        agentPattern: agentPattern.trim() || null,
        fromStatusId: fromStatusId || null,
        toStatusId,
      });
      return data!;
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
      await api.api["transition-rules"]({ id }).delete();
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
        <h3 className={sectionHeadingCls}>New Rule</h3>
        <div className="space-y-2">
          <input
            type="text"
            value={agentPattern}
            onChange={(e) => setAgentPattern(e.target.value)}
            placeholder="Agent pattern (e.g. implementer*, or blank = all agents)"
            className={inputCls()}
          />
          <div className="flex gap-2">
            <select
              value={fromStatusId}
              onChange={(e) => setFromStatusId(e.target.value)}
              className={selectCls.replace("w-full", "flex-1")}
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
              className={selectCls.replace("w-full", "flex-1")}
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
            className={primaryBtnCls}
          >
            Add Rule
          </button>
        </div>
      </div>

      {/* Rule list */}
      <div>
        <h3 className={sectionHeadingCls}>Active Rules ({rules.length})</h3>
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
