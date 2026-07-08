"use client";

// Bannière d'intégrité (02-domain-rules règle 8) : n'apparaît que si le plan
// porte des issues de corruption non résolues. Propose la réparation —
// suppression des mappings rompus, action utilisateur EXPLICITE (Principe IX).

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TriangleAlert } from "lucide-react";

type IntegrityIssue = {
  id: string;
  entityType: string;
  issueType: string;
  message: string;
};

export function IntegrityBanner({ planId }: { planId: string }) {
  const router = useRouter();
  const [issues, setIssues] = useState<IntegrityIssue[]>([]);
  const [repairing, setRepairing] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/plans/${planId}/integrity`);
    if (res.ok) {
      const data = await res.json();
      setIssues(data.issues);
    }
  }, [planId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (issues.length === 0) return null;

  const hasBrokenRef = issues.some((i) => i.issueType === "BROKEN_REFERENCE");

  async function repair() {
    setRepairing(true);
    await fetch(`/api/plans/${planId}/integrity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "repair" }),
    });
    await load();
    setRepairing(false);
    router.refresh(); // la pastille de statut du plan peut repasser à READY/DRAFT
  }

  return (
    <div className="space-y-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2.5">
      <p className="flex items-center gap-2 text-sm font-medium text-destructive">
        <TriangleAlert className="size-4" />
        Plan à réparer — {issues.length} problème(s) d&apos;intégrité
      </p>
      <ul className="ml-6 list-disc space-y-0.5 text-sm text-destructive">
        {issues.map((i) => (
          <li key={i.id}>{i.message}</li>
        ))}
      </ul>
      {hasBrokenRef && (
        <Button variant="destructive" size="sm" onClick={repair} disabled={repairing}>
          {repairing ? "Réparation…" : "Réparer (supprimer les mappings rompus)"}
        </Button>
      )}
    </div>
  );
}
