import React, { useState } from "react";
import { Search, SlidersHorizontal, X, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PeriodPicker } from "./PeriodPicker";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface FilterBarProps {
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (val: string) => void;
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  onClearFilters: () => void;
  onApplyFilters: () => void;
  children?: React.ReactNode;
  className?: string;
}

export function FilterBar({
  searchPlaceholder = "Buscar...",
  searchValue,
  onSearchChange,
  dateRange,
  onDateRangeChange,
  onClearFilters,
  onApplyFilters,
  children,
  className,
}: FilterBarProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn("rounded-2xl border border-border/70 bg-card p-3 shadow-sm", className)}>
      <div className="flex flex-col md:flex-row items-center gap-2">
        <div className="flex-1 w-full relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder={searchPlaceholder}
            className="h-10 rounded-xl border-border/70 bg-background/60 pl-9 text-sm focus:bg-background"
            value={searchValue}
            onChange={e => onSearchChange(e.target.value)}
          />
          {searchValue && (
            <button onClick={() => onSearchChange("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button
            variant="outline"
            className="h-10 flex-1 gap-2 rounded-xl border-border/70 text-sm text-foreground hover:bg-muted md:flex-none"
            onClick={() => setIsOpen(true)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filtros
            {(dateRange?.from || searchValue) && (
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            )}
          </Button>
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="!flex max-h-[min(92dvh,720px)] w-[calc(100vw-1.25rem)] max-w-lg flex-col gap-0 overflow-hidden rounded-3xl border-border/70 bg-card p-0 sm:w-full">
          <DialogHeader className="border-b border-border/70 px-4 pb-4 pt-5 sm:px-6">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <SlidersHorizontal className="h-4 w-4 text-blue-600" />
              Filtros Avançados
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 sm:p-6">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" /> Período
              </label>
              <PeriodPicker dateRange={dateRange} setDateRange={onDateRangeChange} />
            </div>
            {children && (
              <div className="grid gap-4 border-t border-border/70 pt-4 sm:grid-cols-2">
                {children}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border/70 px-4 pb-4 pt-4 sm:px-6">
            <button
              onClick={() => { onClearFilters(); setIsOpen(false); }}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Limpar filtros
            </button>
            <Button
              onClick={() => { onApplyFilters(); setIsOpen(false); }}
              className="h-9 px-5 rounded-xl text-sm font-bold"
            >
              Aplicar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
