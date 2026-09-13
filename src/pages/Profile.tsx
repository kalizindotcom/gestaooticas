import { User, Mail, Camera, Shield, Building2, Store, Save } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { FinancialInfoTip } from '@/components/financial/FinancialInfoTip';
import { localApi } from '@/lib/localApi';
import { toast } from 'sonner';

export default function Profile() {
  const { user } = useAuth();
  const [birthDate, setBirthDate] = useState('1990-01-01');
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const calculateAge = (date: string) => {
    if (!date) return null;
    try {
      const today = new Date();
      const birth = new Date(date);
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      return age;
    } catch (e) {
      return null;
    }
  };

  const age = calculateAge(birthDate);

  const handleSave = async () => {
    if (!user?.id || !name.trim()) return toast.error('Informe seu nome completo.');
    setSaving(true);
    const result = await localApi.auth.admin.updateUser(String(user.id), { name: name.trim(), email: user.email });
    setSaving(false);
    if (result.error) return toast.error(result.error.message || 'Não foi possível salvar seu perfil.');
    toast.success('Perfil atualizado com sucesso.');
  };

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up">
        <PageHeader title="Meu Perfil" description="Gerencie suas informações pessoais" />
      </div>

      <FinancialInfoTip className="px-3 py-2.5" title="Dica do perfil">Mantenha seus dados de contato atualizados. O cargo, as empresas e as lojas vinculadas determinam o contexto do seu acesso.</FinancialInfoTip>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Avatar Card */}
        <div className="animate-fade-in-up" style={{ animationDelay: "100ms" }}>
          <Card className="border-border/60 hover-lift overflow-hidden relative">
            <div className="absolute -top-20 -right-20 h-48 w-48 rounded-full bg-primary/15 blur-3xl" />
            <CardContent className="p-6 flex flex-col items-center text-center relative">
              <div className="relative mb-5 group">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary via-blue-500 to-purple-600 blur-2xl opacity-50 group-hover:opacity-80 transition-opacity" />
                <div className="relative h-24 w-24 rounded-3xl bg-gradient-to-br from-primary via-blue-500 to-purple-600 grid place-items-center text-white text-3xl font-heading font-black shadow-xl shadow-primary/30 ring-4 ring-card group-hover:scale-105 transition-transform">
                  {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
                  <div className="absolute inset-0 rounded-3xl bg-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                    <Camera className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>
              <h3 className="font-heading font-black text-lg tracking-tight">{user?.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{user?.email}</p>
              <Badge className="mt-3 bg-gradient-to-r from-amber-500/15 to-orange-500/15 text-amber-700 border-amber-300/40 text-xs gap-1 font-bold rounded-full uppercase backdrop-blur">
                <Shield className="h-3 w-3" />
                {user?.role || 'Usuário'}
              </Badge>

              <div className="w-full mt-6 pt-6 border-t border-border/40 space-y-3 text-left">
                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-xs">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-foreground">{user?.companies?.length || 0}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">empresas vinculadas</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-xs">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Store className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-foreground">{user?.stores?.length || 0}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">lojas vinculadas</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Info Form */}
        <div className="lg:col-span-2 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
          <Card className="border-border/60 hover-lift">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold font-heading flex items-center gap-2.5 tracking-tight">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary to-purple-600 grid place-items-center shadow-md shadow-primary/20">
                  <User className="h-3.5 w-3.5 text-white" strokeWidth={2.2} />
                </div>
                Dados Pessoais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 animate-fade-in-up" style={{ animationDelay: "250ms" }}>
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nome completo</Label>
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="h-11 bg-background/40 border-border/60 rounded-xl focus-visible:border-primary/40 focus-visible:ring-0"
                  />
                </div>
                <div className="space-y-2 animate-fade-in-up" style={{ animationDelay: "300ms" }}>
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cargo</Label>
                  <Input
                    defaultValue={user?.role}
                    disabled
                    className="h-11 bg-muted/30 border-border/60 rounded-xl capitalize"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 animate-fade-in-up" style={{ animationDelay: "350ms" }}>
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">E-mail</Label>
                  <Input
                    defaultValue={user?.email}
                    disabled
                    className="h-11 bg-muted/30 border-border/60 rounded-xl"
                  />
                </div>
                <div className="space-y-2 animate-fade-in-up" style={{ animationDelay: "400ms" }}>
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Telefone</Label>
                  <Input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="(11) 99999-0000"
                    className="h-11 bg-background/40 border-border/60 rounded-xl focus-visible:border-primary/40 focus-visible:ring-0"
                  />
                </div>
              </div>
              <div className="pt-2 border-t border-border/40 animate-fade-in-up" style={{ animationDelay: "450ms" }}>
                <Button
                  className="gap-2 rounded-xl border-0 text-white shadow-lg shadow-primary/30 btn-shimmer hover-lift"
                  onClick={() => void handleSave()}
                  disabled={saving}
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
