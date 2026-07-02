import { notFound } from "next/navigation";
import { PlanHeader } from "@/features/plans/components/plan-header";
import { StepSidebar } from "@/features/plans/components/step-sidebar";
import { getPlan } from "@/features/plans/services/plan-service";

// Layout persistant de toutes les pages du plan (01-journeys §1.0) :
// header (nom, statut, connecteurs) + stepper à gauche + main scrollable.
export default async function PlanLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ planId: string }>;
}) {
  const { planId } = await params;
  const plan = await getPlan(planId);
  if (!plan) notFound();

  return (
    <div className="flex h-screen flex-col">
      <PlanHeader plan={plan} />
      <div className="flex min-h-0 flex-1">
        <StepSidebar planId={plan.id} currentStep={plan.currentStep} />
        <main className="min-w-0 flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
