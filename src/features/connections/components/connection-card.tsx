"use client";

// Carte d'une connexion active : identité, compteur d'objets, actions
// (actualiser le schéma, déconnecter) et CTA de sortie vers l'étape suivante.

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, RefreshCw, Unplug } from "lucide-react";

export function ConnectionCard({
  name,
  objectCount,
  objectNoun,
  busy,
  continueHref,
  continueLabel,
  onRefreshSchema,
  onDisconnect,
}: {
  name: string;
  objectCount: number | null;
  objectNoun: string;
  busy: string | null;
  continueHref: string;
  continueLabel: string;
  onRefreshSchema: () => void;
  onDisconnect: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckCircle2 className="size-4 text-green-600" />
          {name} — connecté
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">
          {objectCount !== null
            ? `${objectCount} ${objectNoun} découverts.`
            : (busy ?? "Schéma en attente de récupération.")}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={continueHref} className={buttonVariants()}>
            {continueLabel}
          </Link>
          <Button variant="outline" size="sm" onClick={onRefreshSchema} disabled={busy !== null}>
            <RefreshCw className="size-3.5" /> Actualiser le schéma
          </Button>
          <Button variant="ghost" size="sm" onClick={onDisconnect} disabled={busy !== null}>
            <Unplug className="size-3.5" /> Déconnecter
          </Button>
        </div>
        {busy && <p className="text-xs text-muted-foreground">{busy}</p>}
      </CardContent>
    </Card>
  );
}
