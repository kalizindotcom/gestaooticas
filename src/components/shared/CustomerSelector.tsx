import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
type Customer = {
  id: string
  name?: string
  nickname?: string
  legalName?: string
  customerType?: 'individual' | 'company'
  cpf?: string
  cnpj?: string
  phone?: string
  whatsapp?: string
  emails?: Array<{ value?: string }>
  phones?: Array<{ value?: string }>
}

interface CustomerSelectorProps {
  customers: Customer[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  className?: string
}

const displayName = (customer: Customer) =>
  customer.nickname?.trim() || customer.name || customer.legalName || "Cliente sem nome"

const documentLabel = (customer: Customer) =>
  customer.customerType === "company" ? "CNPJ" : "CPF"

const documentValue = (customer: Customer) =>
  customer.customerType === "company" ? customer.cnpj : customer.cpf

const primaryContact = (customer: Customer) =>
  customer.phone || customer.whatsapp || customer.emails?.[0]?.value || "Contato não informado"

const customerSearchValue = (customer: Customer) => [
  displayName(customer),
  customer.name,
  customer.nickname,
  customer.legalName,
  documentValue(customer),
  primaryContact(customer),
  ...(customer.phones || []).map((item) => item.value),
].filter(Boolean).join(" ")

const MAX_VISIBLE_RESULTS = 30

export function CustomerSelector({
  customers,
  value,
  onValueChange,
  placeholder = "Selecione o cliente",
  className
}: CustomerSelectorProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const selectedCustomer = customers.find((customer) => customer.id === value)
  const normalizedSearch = search.trim().toLowerCase()
  const visibleCustomers = React.useMemo(() => customers
    .filter((customer) => !normalizedSearch || customerSearchValue(customer).toLowerCase().includes(normalizedSearch))
    .slice(0, MAX_VISIBLE_RESULTS), [customers, normalizedSearch])

  return (
    <Popover open={open} onOpenChange={(nextOpen) => {
      setOpen(nextOpen)
      if (!nextOpen) setSearch("")
    }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal border-muted-foreground/20 min-h-10 h-auto py-2 px-3 text-left",
            !selectedCustomer && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">
            {selectedCustomer ? displayName(selectedCustomer) : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(var(--radix-popover-trigger-width),calc(100vw-1rem))] p-0" align="start">
        <Command className="w-full">
          <CommandInput value={search} onValueChange={setSearch} placeholder="Buscar por nome, apelido, CPF/CNPJ ou telefone..." className="h-9" />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
            <CommandGroup heading={visibleCustomers.length >= MAX_VISIBLE_RESULTS ? `Primeiros ${MAX_VISIBLE_RESULTS} resultados — refine a busca` : `${visibleCustomers.length} resultado(s)`}>
              {visibleCustomers.map((customer) => {
                const name = displayName(customer)
                const document = documentValue(customer)
                const contact = primaryContact(customer)
                const searchValue = customerSearchValue(customer)

                return (
                  <CommandItem
                    key={customer.id}
                    value={searchValue}
                    onSelect={() => {
                      onValueChange?.(customer.id)
                      setOpen(false)
                    }}
                    className="flex items-center gap-2 py-2"
                  >
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0",
                        value === customer.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex min-w-0 flex-col gap-0.5 overflow-hidden">
                      <span className="truncate font-medium">{name}</span>
                      <span className="truncate text-[10px] text-muted-foreground uppercase tracking-tight">
                        {documentLabel(customer)}: {document || "Não informado"} · {contact}
                      </span>
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
