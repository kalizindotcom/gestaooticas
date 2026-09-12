import { useState, useEffect } from 'react';
import { Globe, Bell, Palette, Database, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { API_BASE, localApi } from '@/lib/localApi';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { FinancialInfoTip } from '@/components/financial/FinancialInfoTip';

const settingSections = [
  {
    title: 'Aparência',
    icon: Palette,
    settings: [
      { label: 'Tema global', type: 'theme' },
      { label: 'Animações da interface', type: 'switch', value: true },
    ],
  },
  {
    title: 'Notificações',
    icon: Bell,
    settings: [
      { label: 'Notificações por e-mail', type: 'switch', value: true },
      { label: 'Lembrete de agendamento', type: 'switch', value: true },
      { label: 'Alerta de estoque baixo', type: 'switch', value: true },
    ],
  },
  {
    title: 'Regional',
    icon: Globe,
    settings: [
      { label: 'Idioma', type: 'select', options: ['Português (BR)', 'English', 'Español'] },
      { label: 'Fuso horário', type: 'select', options: ['Brasília (GMT-3)', 'Manaus (GMT-4)', 'Fernando de Noronha (GMT-2)'] },
      { label: 'Formato de moeda', type: 'select', options: ['R$ (BRL)', '$ (USD)', '€ (EUR)'] },
    ],
  },
];

export default function Settings() {
  const [localApiUrl, setLocalApiUrl] = useState(API_BASE);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'error' | 'testing' | 'idle'>('idle');
  const [lastCheck, setLastCheck] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);

  const testConnection = async () => {
    setConnectionStatus('testing');
    const start = performance.now();
    try {
      const { error } = await localApi.from('companies').select('id').limit(1);
      
      if (error) throw error;
      
      const end = performance.now();
      setLatency(Math.round(end - start));
      setConnectionStatus('connected');
      setLastCheck(new Date().toLocaleTimeString());
      toast.success('API local conectada ao SQLite.');
    } catch (error: any) {
      console.error('Connection error:', error);
      setConnectionStatus('error');
      setLatency(null);
      setLastCheck(new Date().toLocaleTimeString());
      toast.error('Erro na API local: ' + (error.message || 'inicie o servidor local'));
    }
  };

  useEffect(() => {
    testConnection();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader title="Configurações" description="Personalize o sistema conforme suas preferências" />

      <FinancialInfoTip className="px-3 py-2.5" title="Dica das configurações">Ajuste o tema, notificações e preferências regionais. Use o status de conexão para confirmar que a API local e o SQLite estão disponíveis.</FinancialInfoTip>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20">
        {settingSections.map(section => (
          <Card key={section.title} className="premium-shadow border-border/60">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-semibold font-heading flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg gradient-navy-subtle flex items-center justify-center">
                  <section.icon className="h-3.5 w-3.5 text-primary" />
                </div>
                {section.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {section.settings.map((setting, i) => (
                <div key={i} className="flex items-center justify-between py-3 px-2 rounded-lg hover:bg-accent/30 transition-colors">
                  <span className="text-[13px] font-medium">{setting.label}</span>
                  {setting.type === 'switch' && <Switch defaultChecked={setting.value as boolean} />}
                  {setting.type === 'theme' && <ThemeToggle />}

                  {setting.type === 'select' && (
                    <Select defaultValue={(setting as any).options[0]}>
                      <SelectTrigger className="h-8 w-52 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(setting as any).options.map((o: string) => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        <Card className="premium-shadow border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold font-heading flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg gradient-navy-subtle flex items-center justify-center">
                <Database className="h-3.5 w-3.5 text-primary" />
              </div>
              Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="geral" className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-9 mb-4">
                <TabsTrigger value="geral" className="text-xs">Geral</TabsTrigger>
                <TabsTrigger value="status" className="text-xs">Status de Conexão</TabsTrigger>
              </TabsList>
              
              <TabsContent value="geral" className="space-y-1 mt-0">
                <div className="flex items-center justify-between py-3 px-2 rounded-lg">
                  <span className="text-[13px] font-medium">Versão do sistema</span>
                  <Badge variant="secondary" className="text-[10px] rounded-full font-mono">v1.0.0</Badge>
                </div>
                <div className="flex items-center justify-between py-3 px-2 rounded-lg">
                  <span className="text-[13px] font-medium">Última atualização</span>
                  <span className="text-xs text-muted-foreground">13/04/2025</span>
                </div>
                <div className="pt-3">
                  <Button variant="outline" size="sm" className="w-full text-xs rounded-lg">Verificar atualizações</Button>
                </div>
              </TabsContent>
              
              <TabsContent value="status" className="space-y-4 mt-0 pt-2">
                <div className="p-3 rounded-lg border border-border/40 bg-accent/20">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status Atual</span>
                    {connectionStatus === 'connected' ? (
                      <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20 flex items-center gap-1.5 py-0.5 px-2">
                        <CheckCircle2 className="h-3 w-3" /> Conectado
                      </Badge>
                    ) : connectionStatus === 'error' ? (
                      <Badge variant="destructive" className="flex items-center gap-1.5 py-0.5 px-2">
                        <AlertCircle className="h-3 w-3" /> Falha na Conexão
                      </Badge>
                    ) : connectionStatus === 'testing' ? (
                      <Badge variant="outline" className="animate-pulse flex items-center gap-1.5 py-0.5 px-2">
                        <RefreshCw className="h-3 w-3 animate-spin" /> Testando...
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="flex items-center gap-1.5 py-0.5 px-2">Aguardando</Badge>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground ml-1">API local</label>
                      <div className="flex gap-2">
                        <Input 
                          value={localApiUrl} 
                          onChange={(e) => setLocalApiUrl(e.target.value)}
                          className="h-8 text-xs bg-background/50" 
                          placeholder="http://localhost:3001/api"
                        />
                      </div>
                    </div>
                    

                  </div>
                  
                  {lastCheck && (
                    <div className="flex flex-col gap-1.5 mt-3 text-center">
                      <p className="text-[10px] text-muted-foreground italic">
                        Última verificação: {lastCheck}
                      </p>
                      {latency !== null && (
                        <p className="text-[10px] font-medium text-emerald-500/80">
                          Latência: {latency}ms
                        </p>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 text-xs gap-1.5 rounded-lg"
                    onClick={() => testConnection()}
                    disabled={connectionStatus === 'testing'}
                  >
                    <RefreshCw className={`h-3 w-3 ${connectionStatus === 'testing' ? 'animate-spin' : ''}`} />
                    Testar Agora
                  </Button>
                  <Button 
                    size="sm" 
                    className="flex-1 text-xs gap-1.5 rounded-lg bg-primary"
                    onClick={() => {
                      toast.info(`Endpoint em uso: ${localApiUrl}`);
                      testConnection();
                    }}
                  >
                    Salvar e Reconectar
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
