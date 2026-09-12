import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, ImageIcon, Paperclip, Trash2, Upload, PlusCircle } from 'lucide-react';
import { toast } from 'sonner';
import { localApi } from '@/lib/localApi';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { PermissionGate } from '@/components/shared/PermissionGate';

const BUCKET = 'customer-attachments';

export function AttachmentsTab({ customer }: { customer: any }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const basePath = `${customer?.company_id || customer?.companyId || 'company'}/${customer?.id}`;

  const { data: files = [], isLoading } = useQuery({
    queryKey: ['customer-attachments', customer?.id, basePath],
    enabled: !!customer?.id,
    queryFn: async () => {
      const { data, error } = await localApi.storage.from(BUCKET).list(basePath, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
      if (error) throw error;
      return data || [];
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['customer-attachments', customer?.id] });

  const handleUpload = async (file?: File) => {
    if (!file || !customer?.id) return;
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    const allowedExtension = /\.(pdf|jpe?g|png|webp)$/i.test(file.name);
    if (file.size > 25 * 1024 * 1024) {
      toast.error('O arquivo excede o limite de 25 MB.');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    if (!allowedTypes.includes(file.type) && !allowedExtension) {
      toast.error('Formato não permitido. Envie PDF, JPG, PNG ou WEBP.');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setIsUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${basePath}/${Date.now()}-${safeName}`;
      const { error } = await localApi.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      toast.success('Arquivo enviado com sucesso.');
      refresh();
    } catch (error: any) {
      toast.error('Erro ao enviar anexo: ' + (error.message || 'verifique o bucket do Storage.'));
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDownload = async (name: string) => {
    const path = `${basePath}/${name}`;
    const { data, error } = await localApi.storage.from(BUCKET).createSignedUrl(path, 60);
    if (error) {
      toast.error('Erro ao gerar link: ' + error.message);
      return;
    }
    window.open(data.signedUrl, '_blank');
  };

  const handleDelete = async (name: string) => {
    const { error } = await localApi.storage.from(BUCKET).remove([`${basePath}/${name}`]);
    if (error) {
      toast.error('Erro ao excluir anexo: ' + error.message);
      return;
    }
    toast.success('Anexo excluído.');
    setFileToDelete(null);
    refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="font-bold text-foreground">Central de anexos</h3>
          <p className="text-xs text-muted-foreground">Arquivos armazenados no servidor local. Limite de 25 MB por arquivo.</p>
        </div>
        <PermissionGate module="customers" action="edit">
          <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => inputRef.current?.click()} disabled={isUploading}><Upload className="h-4 w-4" /> {isUploading ? 'Enviando...' : 'Enviar arquivo'}</Button>
        </PermissionGate>
        <input ref={inputRef} type="file" className="hidden" onChange={e => handleUpload(e.target.files?.[0])} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {files.map((file: any) => {
          const isImage = String(file.metadata?.mimetype || file.name).toLowerCase().match(/image|png|jpg|jpeg|webp/);
          return (
            <div key={file.name} className="bg-card border rounded-xl p-4 shadow-sm hover:border-primary/50 transition-all group relative">
              <div className="flex justify-between items-start mb-3"><div className="p-2 bg-muted/40 rounded-lg">{isImage ? <ImageIcon className="h-6 w-6 text-emerald-500" /> : <FileText className="h-6 w-6 text-blue-500" />}</div></div>
              <h4 className="font-bold text-sm truncate mb-1" title={file.name}>{file.name}</h4>
              <div className="flex justify-between items-center mt-3"><span className="text-[10px] font-bold text-muted-foreground uppercase">{formatSize(file.metadata?.size)}</span><Badge variant="secondary" className="text-[9px] px-1.5 h-4 font-normal">{formatDate(file.created_at)}</Badge></div>
              <div className="flex gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0"><Button variant="outline" size="sm" className="flex-1 h-8 text-[11px] gap-1" onClick={() => handleDownload(file.name)}><Download className="h-3 w-3" /> Baixar</Button><PermissionGate module="customers" action="edit"><Button variant="outline" size="sm" className="h-8 w-8 p-0 border-destructive/20 text-destructive hover:bg-destructive/10" onClick={() => setFileToDelete(file.name)}><Trash2 className="h-3 w-3" /></Button></PermissionGate></div>
            </div>
          );
        })}
        <PermissionGate module="customers" action="edit"><button type="button" onClick={() => inputRef.current?.click()} className="min-h-[150px] cursor-pointer rounded-xl border-2 border-dashed border-border/70 p-6 text-muted-foreground transition-all hover:border-primary/50 hover:bg-muted/60"><PlusCircle className="mb-2 h-8 w-8 opacity-50" /><p className="text-xs font-bold uppercase tracking-wider">Novo anexo</p></button></PermissionGate>
      </div>
      {isLoading && <div className="col-span-full grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map(row => <div key={`attachment-skeleton-${row}`} className="h-36 animate-pulse rounded-xl bg-muted" />)}</div>}
      {!isLoading && files.length === 0 && <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/20 text-sm text-muted-foreground"><Paperclip className="mr-2 h-4 w-4" /> Nenhum anexo enviado.</div>}
      <AlertDialog open={!!fileToDelete} onOpenChange={(open) => !open && setFileToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir anexo?</AlertDialogTitle><AlertDialogDescription>O arquivo “{fileToDelete}” será removido definitivamente do cadastro deste cliente.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Manter arquivo</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => fileToDelete && handleDelete(fileToDelete)}>Excluir anexo</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function formatSize(size?: number) {
  if (!size) return '-';
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('pt-BR');
}
