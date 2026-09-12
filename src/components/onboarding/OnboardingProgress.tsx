interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
}

export function OnboardingProgress({ currentStep, totalSteps }: OnboardingProgressProps) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: totalSteps }).map((_, index) => (
        <div key={index} className="flex items-center">
          <div
            className={`h-2 w-2 rounded-full transition-all ${
              index + 1 === currentStep
                ? 'bg-primary w-8'
                : index + 1 < currentStep
                ? 'bg-primary'
                : 'bg-muted'
            }`}
          />
          {index < totalSteps - 1 && (
            <div
              className={`h-0.5 w-8 mx-1 ${
                index + 1 < currentStep ? 'bg-primary' : 'bg-muted'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
