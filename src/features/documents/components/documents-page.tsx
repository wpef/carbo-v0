"use client";

// Documents (01-journeys §1.11 / 05-acceptance §12). L'arrivée « légitime » ici
// passe par la frontière validée (plan READY). En URL directe sans mappings, le
// plan n'est PAS promu — la page explique quoi faire au lieu de mentir.
//
// Deux documents : technique (texte enrichi) + contractuel (7 articles). Chaque
// génération versionne (OUTDATED → CURRENT). Vues de détail inline + impression
// navigateur (= export PDF, sans dépendance).

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { printDocument } from "../lib/print-document";

type Doc = {
  id: string;
  version: number;
  status: "CURRENT" | "OUTDATED";
  htmlContent: string;
  objectCount: number;
  fieldCount: number;
  ruleCount: number;
  unmappedCount: number;
  llmCallCount: number;
  referenceNumber?: string;
  filterCount?: number;
  generatedAt: string;
};

export function DocumentsPage() {
  const { planId } = useParams<{ planId: string }>();
  const router = useRouter();
  const [planStatus, setPlanStatus] = useState<string | null>(null);
  const [textDocs, setTextDocs] = useState<Doc[] | null>(null);
  const [contractualDocs, setContractualDocs] = useState<Doc[] | null>(null);
  const [busy, setBusy] = useState<"text" | "contractual" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Doc | null>(null);

  const load = useCallback(async () => {
    const [planRes, textRes, contractualRes] = await Promise.all([
      fetch(`/api/plans/${planId}`),
      fetch(`/api/plans/${planId}/documents`),
      fetch(`/api/plans/${planId}/documents/contractual`),
    ]);
    if (planRes.ok) setPlanStatus((await planRes.json()).plan.status);
    if (textRes.ok) setTextDocs((await textRes.json()).documents);
    if (contractualRes.ok) setContractualDocs((await contractualRes.json()).documents);
  }, [planId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function generate(kind: "text" | "contractual") {
    setBusy(kind);
    setError(null);
    const url =
      kind === "text"
        ? `/api/plans/${planId}/documents`
        : `/api/plans/${planId}/documents/contractual`;
    const res = await fetch(url, { method: "POST" });
    if (res.ok) {
      setPreview((await res.json()).document);
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "La génération a échoué. Réessayez.");
    }
    await load();
    router.refresh();
    setBusy(null);
  }

  if (textDocs === null || contractualDocs === null)
    return <p className="text-sm text-muted-foreground">Chargement…</p>;

  const ready = planStatus === "READY";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">Documents du plan</h1>

      {planStatus !== null && !ready && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Le plan n&apos;est pas encore prêt : il faut au moins une paire d&apos;objets avec des
          champs mappés.{" "}
          <Link href={`/plans/${planId}/field-mapping`} className="underline">
            Retourner au mapping des champs
          </Link>
        </p>
      )}
      {ready && (
        <p className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-900">
          ✓ Plan prêt : les mappings requis sont en place. Vous pouvez générer les documents.
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <DocumentBlock
        title="Document technique"
        description="Résumé enrichi du plan : correspondances, règles de migration, champs non-mappés et exclusions. Chaque génération crée une nouvelle version."
        actionLabel="Générer le document technique"
        busy={busy === "text"}
        disabled={busy !== null || !ready}
        docs={textDocs}
        preview={preview}
        onGenerate={() => generate("text")}
        onToggle={(d) => setPreview(preview?.id === d.id ? null : d)}
        onPrint={(d) => printDocument(docTitle(d, "Document technique"), d.htmlContent)}
      />

      <DocumentBlock
        title="Document contractuel"
        description="Structure en 7 articles avec numéro de référence unique et bloc de signature, pour validation client."
        actionLabel="Générer le document contractuel"
        busy={busy === "contractual"}
        disabled={busy !== null || !ready}
        docs={contractualDocs}
        preview={preview}
        onGenerate={() => generate("contractual")}
        onToggle={(d) => setPreview(preview?.id === d.id ? null : d)}
        onPrint={(d) =>
          printDocument(docTitle(d, "Document contractuel"), d.htmlContent)
        }
      />

      {preview && (
        <Card data-testid="document-preview">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              Aperçu — version {preview.version}
              {preview.referenceNumber ? ` · ${preview.referenceNumber}` : ""}
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => printDocument(docTitle(preview, "Document"), preview.htmlContent)}
            >
              Imprimer / PDF
            </Button>
          </CardHeader>
          <CardContent
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: preview.htmlContent }}
          />
        </Card>
      )}
    </div>
  );
}

function docTitle(d: Doc, base: string): string {
  return d.referenceNumber ? `${base} — ${d.referenceNumber}` : `${base} — v${d.version}`;
}

function DocumentBlock({
  title,
  description,
  actionLabel,
  busy,
  disabled,
  docs,
  preview,
  onGenerate,
  onToggle,
  onPrint,
}: {
  title: string;
  description: string;
  actionLabel: string;
  busy: boolean;
  disabled: boolean;
  docs: Doc[];
  preview: Doc | null;
  onGenerate: () => void;
  onToggle: (d: Doc) => void;
  onPrint: (d: Doc) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{description}</p>
        <Button onClick={onGenerate} disabled={disabled}>
          {busy ? "Génération…" : actionLabel}
        </Button>

        {docs.length === 0 ? (
          <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
            Aucune version générée pour l&apos;instant.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {docs.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                <span className="font-medium">Version {doc.version}</span>
                <Badge variant={doc.status === "CURRENT" ? "default" : "outline"}>
                  {doc.status === "CURRENT" ? "Actuelle" : "Obsolète"}
                </Badge>
                {doc.referenceNumber && (
                  <code className="text-xs text-muted-foreground">{doc.referenceNumber}</code>
                )}
                <span className="text-xs text-muted-foreground">
                  {doc.objectCount} objets · {doc.fieldCount} champs · {doc.ruleCount} règles ·{" "}
                  {doc.unmappedCount} non-mappés · {doc.llmCallCount} LLM ·{" "}
                  {new Date(doc.generatedAt).toLocaleString("fr-FR")}
                </span>
                <div className="ml-auto flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => onToggle(doc)}>
                    {preview?.id === doc.id ? "Fermer" : "Détail"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onPrint(doc)}>
                    Imprimer / PDF
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
