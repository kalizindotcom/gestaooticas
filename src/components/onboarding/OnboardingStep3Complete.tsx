import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';

interface OnboardingStep3CompleteProps {
  companyName: string;
  storeName: string;
  onComplete: () => void;
}

export function OnboardingStep3Complete({ companyName, storeName, onComplete }: OnboardingStep3CompleteProps) {
  return (
    <div className="w-full max-w-2xl mx-auto text-center">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/20 mb-6">
        <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400" />
      </div>

      <h2 className="text-3xl font-bold mb-4">Tudo pronto! 🎉</h2>

      <p className="text-lg text-muted-foreground mb-8">
        Sua configuração inicial foi concluída com sucesso.
      </p>

      <div className="bg-muted/50 rounded-lg p-6 mb-8 text-left">
        <h3 className="font-semibold mb-4">Resumo da Configuração:</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Empresa:</span>
            <span className="font-medium">{companyName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Loja:</span>
            <span className="font-medium">{storeName}</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Agora você pode começar a usar o sistema completo!
        </p>
        <Button size="lg" onClick={onComplete} className="w-full md:w-auto">
          Começar a usar
        </Button>
      </div>
    </div>
  );
}
