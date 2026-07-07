"use client";

// Documents (01-journeys §1.11). L'arrivée « légitime » ici passe par la
// frontière validée (plan READY). En URL directe sans mappings, le plan
// n'est PAS promu (v5 : fin du « READY par navigation ») — la page explique
// quoi faire au lieu de mentir.

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Doc = {
  id: string;
  version: number;
  status: "CURRENT" | "OUTDATED";
  htmlContent: string;
  objectCount: number;
  fieldCount: number;
  generatedAt: string;
};

export function DocumentsPage() {
  const { planId } = useParams<{ planId: string }>();
  const router = useRouter();
  const [planStatus, setPlanStatus] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Doc[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Doc | null>(null);

  const load = useCallback(async () => {
    const [planRes, documentsRes] = await Promise.all([
      fetch(`/api/plans/${planId}`),
      fetch(`/api/plans/${planId}/documents`),
    ]);
    if (planRes.ok) {
      const { plan } = await planRes.json();
      setPlanStatus(plan.status);
    }
    if (documentsRes.ok) {
      const data = await documentsRes.json();
      setDocuments(data.documents);
    }
  }, [planId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function generate() {
    setGenerating(true);
    setGenerateError(null);
    const res = await fetch(`/api/plans/${planId}/documents`, { method: "POST" });
    if (res.ok) {
      const { document } = await res.json();
      setPreview(document);
    } else {
      const body = await res.json().catch(() => ({}));
      setGenerateError(body.error ?? "La génération a échoué. Réessayez.");
    }
    await load();
    router.refresh();
    setGenerating(false);
  }

  if (documents === null) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">Documents du plan</h1>

      {planStatus !== null && planStatus !== "READY" && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Le plan n&apos;est pas encore prêt : il faut au moins une paire d&apos;objets avec des
          champs mappés.{" "}
          <Link href={`/plans/${planId}/field-mapping`} className="underline">
            Retourner au mapping des champs
          </Link>
        </p>
      )}
      {planStatus === "READY" && (
        <p className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-900">
          ✓ Plan prêt : les mappings requis sont en place. Vous pouvez générer les documents,
          ou{" "}
          <Link href="/" className="underline">
            retourner à la liste des plans
          </Link>
          .
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Description du plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Génère un résumé du plan à partir des mappings actuels. Chaque génération crée une
            nouvelle version ; la précédente est conservée.
          </p>
          <Button onClick={generate} disabled={generating || planStatus !== "READY"}>
            {generating ? "Génération…" : "Générer la description"}
          </Button>
          {generateError && <p className="text-sm text-destructive">{generateError}</p>}
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">
          Versions ({documents.length})
        </h2>
        {documents.length === 0 ? (
          <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
            Aucun document généré pour l&apos;instant.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="font-medium">Version {doc.version}</span>
                <Badge variant={doc.status === "CURRENT" ? "default" : "outline"}>
                  {doc.status === "CURRENT" ? "Actuelle" : "Obsolète"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {doc.objectCount} objets · {doc.fieldCount} champs ·{" "}
                  {new Date(doc.generatedAt).toLocaleString("fr-FR")}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() => setPreview(preview?.id === doc.id ? null : doc)}
                >
                  {preview?.id === doc.id ? "Fermer" : "Aperçu"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {preview && (
        <Card data-testid="document-preview">
          <CardContent
            className="prose prose-sm max-w-none pt-4"
            dangerouslySetInnerHTML={{ __html: preview.htmlContent }}
          />
        </Card>
      )}
    </div>
  );
}
