import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Store } from 'lucide-react';

const storeSchema = z.object({
  name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  code: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  manager: z.string().optional(),
  hours: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
});

export type StoreFormData = z.infer<typeof storeSchema>;

interface OnboardingStep2StoreProps {
  onNext: (data: StoreFormData) => void;
  onBack: () => void;
  companyName: string;
  initialData?: Partial<StoreFormData>;
}

export function OnboardingStep2Store({ onNext, onBack, companyName, initialData }: OnboardingStep2StoreProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<StoreFormData>({
    resolver: zodResolver(storeSchema),
    defaultValues: initialData,
  });

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Store className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Cadastre sua Loja</h2>
        <p className="text-muted-foreground">
          Adicione a primeira loja de <strong>{companyName}</strong>
        </p>
      </div>

      <form onSubmit={handleSubmit(onNext)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="name">
              Nome da Loja <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="Loja Centro"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">Código</Label>
            <Input
              id="code"
              {...register('code')}
              placeholder="L001"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              {...register('phone')}
              placeholder="(00) 0000-0000"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address">Endereço</Label>
            <Input
              id="address"
              {...register('address')}
              placeholder="Rua Exemplo, 123"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">Cidade</Label>
            <Input
              id="city"
              {...register('city')}
              placeholder="São Paulo"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="state">Estado</Label>
            <Input
              id="state"
              {...register('state')}
              placeholder="SP"
              maxLength={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="manager">Gerente</Label>
            <Input
              id="manager"
              {...register('manager')}
              placeholder="Nome do gerente"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hours">Horário de Funcionamento</Label>
            <Input
              id="hours"
              {...register('hours')}
              placeholder="Seg-Sex: 9h-18h"
            />
          </div>
        </div>

        <div className="flex justify-between pt-4">
          <Button type="button" variant="outline" onClick={onBack}>
            Voltar
          </Button>
          <Button type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando...' : 'Próximo'}
          </Button>
        </div>
      </form>
    </div>
  );
}
