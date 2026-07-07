"use client";

// Saisie d'un token Private App HubSpot (Paramètres → Intégrations →
// Applications privées). Alternative à OAuth quand l'app n'est pas approuvée.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PrivateAppTokenForm({
  busy,
  onSubmit,
}: {
  busy: string | null;
  onSubmit: (accessToken: string) => void;
}) {
  const [token, setToken] = useState("");

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (token.trim()) onSubmit(token.trim());
      }}
    >
      <Label htmlFor="private-app-token">Token d&apos;application privée</Label>
      <div className="flex gap-2">
        <Input
          id="private-app-token"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="pat-eu1-…"
          autoComplete="off"
        />
        <Button type="submit" disabled={busy !== null || token.trim() === ""}>
          Valider
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Le token n&apos;est jamais réaffiché ; il est stocké côté serveur dans la
        configuration de la connexion.
      </p>
    </form>
  );
}
