"use client";

// Choix du connecteur — un bouton par adaptateur disponible pour ce côté.
// Le mode de connexion (direct / oauth / oauth-or-token) vient du descripteur.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdapterDescriptor } from "@/features/connectors/contract";
import { PrivateAppTokenForm } from "./private-app-token-form";

export function AdapterPicker({
  adapters,
  busy,
  onConnectDirect,
  onConnectOAuth,
  onConnectPrivateApp,
}: {
  adapters: AdapterDescriptor[];
  busy: string | null;
  onConnectDirect: (adapterType: string) => void;
  onConnectOAuth: (adapterType: string) => void;
  onConnectPrivateApp: (accessToken: string) => void;
}) {
  const [tokenFormFor, setTokenFormFor] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Choisir un connecteur</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {adapters.map((adapter) => (
          <div key={adapter.type} className="rounded-md border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">{adapter.label}</p>
                <p className="text-xs text-muted-foreground">{adapter.description}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                {adapter.connectMode === "direct" && (
                  <Button onClick={() => onConnectDirect(adapter.type)} disabled={busy !== null}>
                    Connecter
                  </Button>
                )}
                {(adapter.connectMode === "oauth" || adapter.connectMode === "oauth-or-token") && (
                  <Button onClick={() => onConnectOAuth(adapter.type)} disabled={busy !== null}>
                    Se connecter via OAuth
                  </Button>
                )}
                {adapter.connectMode === "oauth-or-token" && (
                  <Button
                    variant="outline"
                    onClick={() => setTokenFormFor(tokenFormFor === adapter.type ? null : adapter.type)}
                    disabled={busy !== null}
                  >
                    Utiliser un token
                  </Button>
                )}
              </div>
            </div>
            {tokenFormFor === adapter.type && (
              <div className="mt-3 border-t pt-3">
                <PrivateAppTokenForm busy={busy} onSubmit={onConnectPrivateApp} />
              </div>
            )}
          </div>
        ))}
        {busy && <p className="text-sm text-muted-foreground">{busy}</p>}
      </CardContent>
    </Card>
  );
}
