// FR-004: plan detail page shows plan metadata + current step CTA.
// Does NOT redirect (spec Session Learning #6). Workflow is in the layout sidebar only.

import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { normalizeStep, STEP_PATHS } from '@/features/plans/lib/steps'
import { DeletePlanDialog } from '@/features/plans/components/delete-plan-dialog'

const STEP_CTA: Record<string, { description: string; label: string }> = {
  SOURCE: {
    description: 'Connectez votre système source. Le schéma, les objets et les champs sont récupérés automatiquement.',
    label: 'Configurer la source',
  },
  DESTINATION: {
    description: 'Connectez le système de destination. Le schéma et les champs sont récupérés automatiquement.',
    label: 'Configurer la destination',
  },
  OBJECT_MAPPING: {
    description: 'Liez les objets source aux objets de destination.',
    label: 'Mapping des objets',
  },
  FIELD_MAPPING: {
    description: 'Mappez les champs, configurez les filtres et les règles de transformation pour chaque paire d\'objets.',
    label: 'Mapping des champs',
  },
  DOCUMENTS: {
    description: 'Générez les documents de validation client.',
    label: 'Générer les documents',
  },
}

export default async function PlanDetailPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params
  const plan = await prisma.migrationPlan.findUnique({
    where: { id: planId },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      currentStep: true,
      createdAt: true,
      updatedAt: true,
    },
  })
  if (!plan) notFound()

  const currentStep = normalizeStep(plan.currentStep)
  const stepPath = STEP_PATHS[currentStep]
  const cta = STEP_CTA[currentStep]

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">{plan.name}</h1>
          {plan.description && (
            <p className="text-muted-foreground">{plan.description}</p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Créé le {new Date(plan.createdAt).toLocaleDateString('fr-FR')}
          </p>
        </div>
        <DeletePlanDialog planId={plan.id} planName={plan.name} />
      </div>

      {cta && (
        <section>
          <h2 className="text-sm font-medium mb-3">Étape actuelle</h2>
          <p className="text-muted-foreground text-sm mb-4">{cta.description}</p>
          <Link
            href={`/plans/${planId}/${stepPath}`}
            className="inline-flex items-center rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors"
          >
            {cta.label} &rarr;
          </Link>
        </section>
      )}
    </div>
  )
}
