import { Moon, Sun } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  compact?: boolean;
}

export function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const { isDark, mounted, toggleTheme } = useTheme();
  const label = isDark ? 'Ativar tema claro' : 'Ativar tema escuro';

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-xl border border-border/60 bg-muted/35 px-2.5 py-1.5 transition-colors',
        'hover:bg-muted/65',
        compact && 'px-2',
      )}
      title={label}
    >
      <Sun className={cn('h-3.5 w-3.5 transition-colors', isDark ? 'text-muted-foreground/55' : 'text-amber-500')} aria-hidden="true" />
      <Switch
        checked={mounted ? isDark : false}
        onCheckedChange={toggleTheme}
        disabled={!mounted}
        aria-label={label}
        className="h-5 w-9 data-[state=checked]:bg-primary"
      />
      <Moon className={cn('h-3.5 w-3.5 transition-colors', isDark ? 'text-sky-400' : 'text-muted-foreground/55')} aria-hidden="true" />
      {!compact && <span className="sr-only">{isDark ? 'Tema escuro ativo' : 'Tema claro ativo'}</span>}
    </div>
  );
}
