"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function PlanForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Erreur lors de la création du plan");
      setSubmitting(false);
      return;
    }
    const { plan } = await res.json();
    router.push(`/plans/${plan.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="plan-name">Nom du plan</Label>
        <Input
          id="plan-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex. : Migration CRM Acme"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="plan-description">Description (optionnel)</Label>
        <Textarea
          id="plan-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Contexte, périmètre, échéances…"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={submitting || name.trim() === ""}>
        {submitting ? "Création…" : "Créer le plan"}
      </Button>
    </form>
  );
}
