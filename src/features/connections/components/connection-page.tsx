"use client";

// Page de connexion générique (source OU destination) — 01-journeys §1.4/§1.7.
// Orchestration seulement : la logique vit dans use-connection, le rendu dans
// AdapterPicker / ConnectionCard.

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { useConnection, type Side } from "../hooks/use-connection";
import { AdapterPicker } from "./adapter-picker";
import { ConnectionCard } from "./connection-card";

const COPY: Record<
  Side,
  { title: string; intro: string; continueLabel: string; continuePath: string; objectNoun: string }
> = {
  source: {
    title: "Système source",
    intro:
      "Connectez le CRM d'où proviennent les données. Le schéma est récupéré automatiquement à la connexion.",
    continueLabel: "Continuer vers la sélection d'objets →",
    continuePath: "/source/objects",
    objectNoun: "objets",
  },
  destination: {
    title: "Système de destination",
    intro:
      "Connectez le CRM qui recevra les données. Tous les objets de destination sont conservés — la sélection ne concerne que la source.",
    continueLabel: "Continuer vers les champs →",
    continuePath: "/destination/fields",
    objectNoun: "objets de destination",
  },
};

function ConnectionPageContent({ side }: { side: Side }) {
  const { planId } = useParams<{ planId: string }>();
  const state = useConnection(planId, side);
  const copy = COPY[side];

  if (state.loading) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{copy.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{copy.intro}</p>
      </div>

      {state.error && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      {!state.connection ? (
        <AdapterPicker
          adapters={state.adapters}
          busy={state.busy}
          onConnectDirect={state.connectDirect}
          onConnectOAuth={state.connectOAuth}
          onConnectPrivateApp={state.connectPrivateApp}
        />
      ) : (
        <ConnectionCard
          name={state.connection.name}
          objectCount={state.objectCount}
          objectNoun={copy.objectNoun}
          busy={state.busy}
          continueHref={`/plans/${planId}${copy.continuePath}`}
          continueLabel={copy.continueLabel}
          onRefreshSchema={state.refreshSchema}
          onDisconnect={state.disconnect}
        />
      )}
    </div>
  );
}

export function ConnectionPage({ side }: { side: Side }) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Chargement…</p>}>
      <ConnectionPageContent side={side} />
    </Suspense>
  );
}
