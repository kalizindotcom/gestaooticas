import { useState } from 'react';
import { localApi } from '@/lib/localApi';
import { toast } from 'sonner';
import { OnboardingProgress } from './OnboardingProgress';
import { OnboardingStep1Company, CompanyFormData } from './OnboardingStep1Company';
import { OnboardingStep2Store, StoreFormData } from './OnboardingStep2Store';
import { OnboardingStep3Complete } from './OnboardingStep3Complete';
import { toSnakeCase } from '@/lib/transformers';
import { COMPANY_PALETTE } from '@/lib/branding';

interface OnboardingWizardProps {
  onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [companyData, setCompanyData] = useState<CompanyFormData | null>(null);
  const [storeData, setStoreData] = useState<StoreFormData | null>(null);
  const [createdCompanyId, setCreatedCompanyId] = useState<string | null>(null);

  const handleCompanySubmit = async (data: CompanyFormData) => {
    try {
      const companyPayload = toSnakeCase({
        name: data.name,
        tradeName: data.tradeName,
        cnpj: data.cnpj || null,
        email: data.email || null,
        phone: data.phone || null,
        city: data.city || null,
        state: data.state || null,
        ...COMPANY_PALETTE,
        status: 'active',
      });

      const { data: company, error } = await localApi
        .from('companies')
        .insert(companyPayload)
        .select()
        .single();

      if (error) throw error;

      setCompanyData(data);
      setCreatedCompanyId(company.id);
      setCurrentStep(2);
      toast.success('Empresa cadastrada com sucesso!');
    } catch (error: any) {
      console.error('Error creating company:', error);
      toast.error('Erro ao cadastrar empresa: ' + error.message);
    }
  };

  const handleStoreSubmit = async (data: StoreFormData) => {
    if (!createdCompanyId) {
      toast.error('Erro: ID da empresa não encontrado');
      return;
    }

    try {
      const storePayload = toSnakeCase({
        companyId: createdCompanyId,
        name: data.name,
        code: data.code || null,
        address: data.address || null,
        phone: data.phone || null,
        manager: data.manager || null,
        hours: data.hours || null,
        city: data.city || null,
        state: data.state || null,
        status: 'active',
      });

      const { error } = await localApi
        .from('stores')
        .insert(storePayload);

      if (error) throw error;

      setStoreData(data);
      setCurrentStep(3);
      toast.success('Loja cadastrada com sucesso!');
    } catch (error: any) {
      console.error('Error creating store:', error);
      toast.error('Erro ao cadastrar loja: ' + error.message);
    }
  };

  const handleBack = () => {
    setCurrentStep(currentStep - 1);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Bem-vindo à GESTÃO ÓTICAS H2K!</h1>
          <p className="text-muted-foreground">
            Vamos configurar seu sistema em apenas 2 passos
          </p>
        </div>

        <OnboardingProgress currentStep={currentStep} totalSteps={3} />

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8">
          {currentStep === 1 && (
            <OnboardingStep1Company
              onNext={handleCompanySubmit}
              initialData={companyData || undefined}
            />
          )}

          {currentStep === 2 && companyData && (
            <OnboardingStep2Store
              onNext={handleStoreSubmit}
              onBack={handleBack}
              companyName={companyData.tradeName}
              initialData={storeData || undefined}
            />
          )}

          {currentStep === 3 && companyData && storeData && (
            <OnboardingStep3Complete
              companyName={companyData.tradeName}
              storeName={storeData.name}
              onComplete={onComplete}
            />
          )}
        </div>
      </div>
    </div>
  );
}
