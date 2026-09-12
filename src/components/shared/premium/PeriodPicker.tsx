import React, { useState } from 'react';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, startOfYesterday, endOfYesterday, subMonths, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { DateRange } from 'react-day-picker';

interface PeriodPickerProps {
  dateRange: DateRange | undefined;
  setDateRange: (range: DateRange | undefined) => void;
  className?: string;
}

export function PeriodPicker({ dateRange, setDateRange, className }: PeriodPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const shortcuts = [
    { label: 'Hoje', getValue: () => ({ from: new Date(), to: new Date() }) },
    { label: 'Ontem', getValue: () => ({ from: startOfYesterday(), to: endOfYesterday() }) },
    { label: '7 dias', getValue: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
    { label: '30 dias', getValue: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
    { label: 'Mês atual', getValue: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
    { label: 'Mês anterior', getValue: () => {
      const prevMonth = subMonths(new Date(), 1);
      return { from: startOfMonth(prevMonth), to: endOfMonth(prevMonth) };
    }},
  ];

  const handleShortcut = (shortcut: typeof shortcuts[0]) => {
    setDateRange(shortcut.getValue());
    setIsOpen(false);
  };

  const activeLabel = shortcuts.find(s => {
    const val = s.getValue();
    return dateRange?.from && dateRange?.to && 
           isSameDay(dateRange.from, val.from!) && 
           isSameDay(dateRange.to, val.to!);
  })?.label || (dateRange?.from ? (
    dateRange.to ? (
      <>
        {format(dateRange.from, "dd/MM/yyyy")} - {format(dateRange.to, "dd/MM/yyyy")}
      </>
    ) : (
      format(dateRange.from, "dd/MM/yyyy")
    )
  ) : "Selecionar período");

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-full justify-between text-left font-normal h-10 px-3 border-border/50 bg-background hover:bg-accent/30 transition-colors rounded-xl",
              !dateRange && "text-muted-foreground"
            )}
          >
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-primary/70" />
              <span className="text-[13px] truncate">{activeLabel}</span>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 rounded-2xl overflow-hidden shadow-2xl border-border/40" align="start">
          <div className="flex flex-col md:flex-row">
            <div className="p-3 border-r border-border/40 bg-muted/20 min-w-[160px] flex flex-col gap-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 mb-2 mt-1">Atalhos rápidos</p>
              {shortcuts.map((s) => (
                <Button
                  key={s.label}
                  variant="ghost"
                  className="justify-start text-xs h-8 px-2 font-medium hover:bg-primary/10 hover:text-primary rounded-lg transition-all"
                  onClick={() => handleShortcut(s)}
                >
                  {s.label}
                </Button>
              ))}
            </div>
            <div className="p-1">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
                locale={ptBR}
                className="rounded-xl border-0"
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}