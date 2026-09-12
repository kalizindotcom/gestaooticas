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
    <div className={cn("bg-white rounded-2xl border border-[#E8E4DF] shadow-sm p-3", className)}>
      <div className="flex flex-col md:flex-row items-center gap-2">
        <div className="flex-1 w-full relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder={searchPlaceholder}
            className="pl-9 h-10 border-[#E8E4DF] bg-[#FAFAF8] focus:bg-white rounded-xl text-sm"
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
            className="flex-1 md:flex-none h-10 border-[#E8E4DF] rounded-xl text-sm gap-2 text-slate-600 hover:bg-slate-50"
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
        <DialogContent className="sm:max-w-[480px] rounded-2xl p-0 border-[#E8E4DF] bg-white overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-[#F1EDE8]">
            <DialogTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-blue-600" />
              Filtros Avançados
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-5">
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5" /> Período
              </label>
              <PeriodPicker dateRange={dateRange} setDateRange={onDateRangeChange} />
            </div>
            {children && (
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#F1EDE8]">
                {children}
              </div>
            )}
          </div>
          <div className="px-6 pb-5 flex items-center justify-between gap-3 border-t border-[#F1EDE8] pt-4">
            <button
              onClick={() => { onClearFilters(); setIsOpen(false); }}
              className="text-sm text-slate-500 hover:text-slate-700 font-medium transition-colors"
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
