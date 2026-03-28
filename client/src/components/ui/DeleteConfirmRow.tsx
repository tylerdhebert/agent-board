/**
 * DeleteConfirmRow
 *
 * A small inline confirmation pattern used throughout the admin sections:
 *   [Cancel]  [Confirm]
 *
 * When not confirming, renders a single "Delete" (or custom label) trigger
 * button.  When confirming, renders a cancel link + danger confirm button.
 *
 * Usage:
 *   <DeleteConfirmRow
 *     onConfirm={() => deleteItem(id)}
 *     confirming={confirmingId === id}
 *     onStartConfirm={() => setConfirmingId(id)}
 *     onCancel={() => setConfirmingId(null)}
 *   />
 */

interface DeleteConfirmRowProps {
  /** Called when the user clicks the final Confirm button */
  onConfirm: () => void;
  /** Whether this row is currently showing the confirmation buttons */
  confirming: boolean;
  /** Called when the "Delete" trigger is clicked */
  onStartConfirm: () => void;
  /** Called when "Cancel" is clicked */
  onCancel: () => void;
  /** Optional extra content shown between Cancel and Confirm (e.g. "3 cards affected") */
  warningText?: string;
  /** Label for the trigger button, defaults to "Delete" */
  triggerLabel?: string;
  /** Label for the confirm button, defaults to "Confirm" */
  confirmLabel?: string;
  disabled?: boolean;
  isPending?: boolean;
  pendingLabel?: string;
}

export function DeleteConfirmRow({
  onConfirm,
  confirming,
  onStartConfirm,
  onCancel,
  warningText,
  triggerLabel = "Delete",
  confirmLabel = "Confirm",
  disabled = false,
  isPending = false,
  pendingLabel,
}: DeleteConfirmRowProps) {
  if (!confirming) {
    return (
      <button
        onClick={onStartConfirm}
        disabled={disabled}
        className="text-[11px] font-mono text-[#64748b] hover:text-[#f87171] transition-colors"
      >
        {triggerLabel}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {warningText && (
        <span className="text-[10px] font-mono text-[#f87171]">{warningText}</span>
      )}
      <button
        onClick={onCancel}
        className="text-[11px] font-mono text-[#64748b] hover:text-[#94a3b8] transition-colors"
      >
        Cancel
      </button>
      <button
        onClick={onConfirm}
        disabled={isPending}
        className="px-2 py-0.5 bg-[#3b1f1f] border border-[#7f1d1d] hover:bg-[#5c1f1f] disabled:opacity-50 text-[#f87171] font-mono text-[11px] rounded-sm transition-colors"
      >
        {isPending && pendingLabel ? pendingLabel : confirmLabel}
      </button>
    </div>
  );
}
