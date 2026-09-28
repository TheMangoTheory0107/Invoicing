interface SyncResultLike {
  attempted: boolean;
  ok: boolean;
  error?: string;
}

// Sheets/Drive sync never blocks saving an invoice, so a failure there is otherwise
// completely silent. This surfaces it immediately as an alert with the real error text, so
// it's actually visible instead of just "nothing happened."
export function warnOnSyncFailure(
  syncResult?: SyncResultLike | null,
  driveSyncResult?: SyncResultLike | null
) {
  const failures: string[] = [];
  if (syncResult?.attempted && !syncResult.ok) {
    failures.push(`Google Sheets sync failed: ${syncResult.error || "unknown error"}`);
  }
  if (driveSyncResult?.attempted && !driveSyncResult.ok) {
    failures.push(`Google Drive upload failed: ${driveSyncResult.error || "unknown error"}`);
  }
  if (failures.length > 0) {
    alert(
      `The invoice saved, but:\n\n${failures.join("\n\n")}\n\nCheck the service account JSON key and sharing permissions in Settings.`
    );
  }
}
