import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Building2, Clock3, Loader2, MapPin, Phone, Save, Store as StoreIcon, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGlobalFilter } from "@/contexts/GlobalFilterContext";
import { toast } from "sonner";
import { localApi } from "@/lib/localApi";

const storeSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres"),
  company_id: z.string().min(1, "Selecione uma empresa"),
  code: z.string().trim().min(2, "Código deve ter pelo menos 2 caracteres"),
  address: z.string().trim().min(5, "Endereço deve ter pelo menos 5 caracteres"),
  city: z.string().trim().min(2, "Cidade deve ter pelo menos 2 caracteres"),
  state: z.string().trim().length(2, "Use a UF com 2 caracteres"),
  phone: z.string().trim().min(10, "Telefone inválido"),
  manager: z.string().trim().min(2, "Gerente deve ter pelo menos 2 caracteres"),
  hours: z.string().trim().min(5, "Horário deve ser informado"),
  status: z.enum(["active", "inactive"]),
});

type StoreFormValues = z.infer<typeof storeSchema>;

interface StoreFormProps {
  onSuccess: () => void;
  initialData?: any;
}

const emptyValues: StoreFormValues = {
  name: "",
  company_id: "",
  code: "",
  address: "",
  city: "",
  state: "",
  phone: "",
  manager: "",
  hours: "09:00 - 18:00",
  status: "active",
};

function SectionHeader({ number, icon: Icon, title, description }: { number: string; icon: typeof StoreIcon; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 border-b border-border/60 pb-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-[11px] font-black text-primary ring-1 ring-primary/15">
        <Icon className="h-4 w-4" strokeWidth={2.2} />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">{number}</span>
          <h3 className="text-sm font-heading font-bold tracking-tight">{title}</h3>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

const inputClass = "h-11 rounded-xl border-border/70 bg-background/80 px-3.5 shadow-sm transition-colors focus:border-primary/60 focus:ring-2 focus:ring-primary/10";
const labelClass = "text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground";

export function StoreForm({ onSuccess, initialData }: StoreFormProps) {
  const { companies, refreshData } = useGlobalFilter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEdit = Boolean(initialData?.id);

  const form = useForm<StoreFormValues>({
    resolver: zodResolver(storeSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    form.reset(initialData ? {
      name: initialData.name || "",
      company_id: initialData.company_id || "",
      code: initialData.code || "",
      address: initialData.address || "",
      city: initialData.city || "",
      state: initialData.state || "",
      phone: initialData.phone || "",
      manager: initialData.manager || "",
      hours: initialData.hours || "09:00 - 18:00",
      status: initialData.status === "inactive" ? "inactive" : "active",
    } : emptyValues);
  }, [initialData, form]);

  const onSubmit = async (values: StoreFormValues) => {
    setIsSubmitting(true);
    try {
      const payload = { ...values, state: values.state.toUpperCase() };
      const result = initialData?.id
        ? await localApi.from("stores").update(payload).eq("id", initialData.id)
        : await localApi.from("stores").insert([payload]);
      if (result.error) throw result.error;
      toast.success(isEdit ? "Loja atualizada com sucesso!" : "Loja criada com sucesso!");
      await refreshData();
      onSuccess();
    } catch (error: any) {
      console.error("Erro ao salvar loja:", error);
      toast.error(error?.message || "Erro ao salvar loja");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onDelete = async () => {
    if (!initialData?.id || !window.confirm("Tem certeza que deseja excluir esta loja? Esta ação não pode ser desfeita.")) return;
    setIsSubmitting(true);
    try {
      const { error } = await localApi.from("stores").delete().eq("id", initialData.id);
      if (error) throw error;
      toast.success("Loja excluída com sucesso!");
      await refreshData();
      onSuccess();
    } catch (error: any) {
      console.error("Erro ao excluir loja:", error);
      toast.error(error?.message || "Erro ao excluir loja");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex h-[min(710px,calc(100vh-170px))] min-h-0 max-h-none flex-col">
        <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-5">
          <section className="space-y-4">
            <SectionHeader number="01" icon={Building2} title="Identificação" description="Defina como a unidade será reconhecida no sistema." />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="name" render={({ field }) => <FormItem className="sm:col-span-2"><FormLabel className={labelClass}>Nome da loja *</FormLabel><FormControl><Input className={inputClass} placeholder="Ex.: Visão Premium · Centro" {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="company_id" render={({ field }) => <FormItem><FormLabel className={labelClass}>Empresa *</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger className={inputClass}><SelectValue placeholder="Selecione a empresa" /></SelectTrigger></FormControl><SelectContent className="rounded-xl">{companies.map((company) => <SelectItem key={company.id} value={company.id}>{company.trade_name || company.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
              <FormField control={form.control} name="code" render={({ field }) => <FormItem><FormLabel className={labelClass}>Código interno *</FormLabel><FormControl><Input className={`${inputClass} font-mono uppercase`} placeholder="Ex.: VP-001" {...field} onChange={(event) => field.onChange(event.target.value.toUpperCase())} /></FormControl><FormMessage /></FormItem>} />
            </div>
          </section>

          <section className="space-y-4">
            <SectionHeader number="02" icon={MapPin} title="Localização e contato" description="Mantenha o endereço e o telefone da unidade atualizados." />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="address" render={({ field }) => <FormItem className="sm:col-span-2"><FormLabel className={labelClass}>Endereço completo *</FormLabel><FormControl><Input className={inputClass} placeholder="Rua, número e bairro" {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="city" render={({ field }) => <FormItem><FormLabel className={labelClass}>Cidade *</FormLabel><FormControl><Input className={inputClass} placeholder="Cidade" {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="state" render={({ field }) => <FormItem><FormLabel className={labelClass}>UF *</FormLabel><FormControl><Input className={`${inputClass} uppercase`} maxLength={2} placeholder="SP" {...field} onChange={(event) => field.onChange(event.target.value.toUpperCase())} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="phone" render={({ field }) => <FormItem><FormLabel className={labelClass}><Phone className="mr-1 inline h-3 w-3" />Telefone *</FormLabel><FormControl><Input className={inputClass} placeholder="(00) 0000-0000" {...field} /></FormControl><FormMessage /></FormItem>} />
            </div>
          </section>

          <section className="space-y-4">
            <SectionHeader number="03" icon={UserRound} title="Responsável e operação" description="Informe quem acompanha a unidade e seu horário de atendimento." />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="manager" render={({ field }) => <FormItem><FormLabel className={labelClass}>Gerente responsável *</FormLabel><FormControl><Input className={inputClass} placeholder="Nome do gerente" {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="hours" render={({ field }) => <FormItem><FormLabel className={labelClass}><Clock3 className="mr-1 inline h-3 w-3" />Horário de atendimento *</FormLabel><FormControl><Input className={inputClass} placeholder="09:00 - 18:00" {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="status" render={({ field }) => <FormItem className="sm:col-span-2"><FormLabel className={labelClass}>Status da unidade</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger className={inputClass}><SelectValue /></SelectTrigger></FormControl><SelectContent className="rounded-xl"><SelectItem value="active">Ativa</SelectItem><SelectItem value="inactive">Inativa</SelectItem></SelectContent></Select><FormMessage /></FormItem>} />
            </div>
          </section>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border/60 bg-muted/20 px-6 py-4">
          <div>{isEdit ? <Button type="button" variant="ghost" className="h-10 gap-2 rounded-xl px-3 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onDelete} disabled={isSubmitting}><Trash2 className="h-4 w-4" />Excluir loja</Button> : <p className="hidden text-[11px] text-muted-foreground sm:block">* Campos obrigatórios</p>}</div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" className="h-10 rounded-xl border-border/70 bg-background/70 px-4" onClick={onSuccess} disabled={isSubmitting}>Cancelar</Button>
            <Button type="submit" className="h-10 gap-2 rounded-xl border-0 bg-gradient-to-r from-primary to-blue-600 px-5 text-white shadow-lg shadow-primary/20 hover:shadow-primary/35" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isEdit ? "Salvar alterações" : "Cadastrar loja"}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
