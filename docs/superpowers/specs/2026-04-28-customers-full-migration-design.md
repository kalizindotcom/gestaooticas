---
name: Customers Page Full Migration
description: Complete migration of Customers page from mock data to Supabase with all features functional
type: feature
---

# Customers Page Full Migration to Supabase

## Overview

Migrate all customer-related functionality from mock data to real Supabase data, ensuring every button, modal, tab, and feature works correctly with the database.

## Scope

### In Scope
- Customer CRUD operations (already working, verify completeness)
- Overview tab with real financial calculations
- Sales tab with real sales data and creation flow
- Service Orders tab with real O.S. data and creation flow
- Appointments tab with real appointment data and creation flow
- Revenue tab with financial aggregations
- Credit tab with credit limit and installments
- History tab with unified timeline
- Attachments tab with Supabase Storage integration
- Export to CSV functionality
- Print functionality
- All filters and search features
- KPI cards with real calculations

### Out of Scope
- Changes to database schema
- Authentication/authorization changes
- UI/UX redesign (maintain current design)

## Data Architecture

### Database Tables Used
- `customers` - main customer data
- `sales` + `sale_items` - sales transactions
- `service_orders` + `service_order_timeline` - service orders
- `appointments` - customer appointments
- `financial_entries` - financial transactions
- `products` + `product_stock` - product catalog and inventory
- `employees` - staff members
- `stores` - store locations

### New Hooks Required

```typescript
// Customer-specific data hooks
useCustomerSales(customerId: string)
useCustomerServiceOrders(customerId: string)
useCustomerAppointments(customerId: string)
useCustomerFinancials(customerId: string)
useCustomerStats(customerId: string)
```

## Implementation Plan by Tab

### 1. Overview Tab

**Data Sources:**
- Customer basic info (already working)
- Sales aggregation: total purchases, total spent
- Service orders: count of open O.S.
- Financial entries: credit available, balance due, overdue amount

**Calculations:**
```typescript
totalPurchases = COUNT(sales WHERE customer_id = X)
totalSpent = SUM(sales.total WHERE customer_id = X)
openServiceOrders = COUNT(service_orders WHERE customer_id = X AND status IN ['pending', 'in_progress'])
creditAvailable = customer.credit_limit - currentDebt
balanceDue = SUM(financial_entries WHERE customer_id = X AND type = 'receivable' AND status = 'pending')
overdueAmount = SUM(financial_entries WHERE customer_id = X AND type = 'receivable' AND status = 'pending' AND due_date < NOW())
```

**Components to Update:**
- KPI cards (3 cards at top)
- Financial summary card (dark card at bottom right)

### 2. Sales Tab

**Features:**
- List all customer sales from `sales` table
- View sale details modal
- Create new sale modal with product selection

**New Sale Flow:**
1. Select seller (from employees/profiles)
2. Select store (from global filter context)
3. Add products (from products table with stock validation)
4. Select payment method
5. Add notes
6. On submit:
   - Insert into `sales` table
   - Insert items into `sale_items` table
   - Update `product_stock` quantities
   - Create `financial_entries` record if needed
   - Invalidate queries to refresh UI

**Validations:**
- Product stock availability
- Required fields (seller, store, at least one product)
- Company and store context must be selected

### 3. Service Orders Tab

**Features:**
- List all customer service orders
- View/edit O.S. details
- Create new O.S. with prescription data
- Print O.S.

**New O.S. Flow:**
1. Select service type (montagem, reparo, ajuste, etc.)
2. Enter prescription data (OD/OE fields)
3. Select technician
4. Set estimated deadline
5. Set priority
6. Enter value and payment method
7. Add internal notes
8. On submit:
   - Insert into `service_orders` table
   - Create initial timeline entry in `service_order_timeline`
   - Create `financial_entries` record
   - Invalidate queries

**Prescription Fields:**
- OD (right eye): sph, cyl, axis, add
- OE (left eye): sph, cyl, axis, add
- Pupillary distance
- Vertical height
- Frame size
- Bridge size
- Optical center height

### 4. Appointments Tab

**Features:**
- List customer appointments
- Create new appointment
- Edit/cancel existing appointments

**New Appointment Flow:**
1. Select date and time
2. Select service type (consulta, exame, ajuste, retirada)
3. Select professional
4. Select store
5. Add notes
6. On submit:
   - Insert into `appointments` table
   - Invalidate queries

### 5. Revenue Tab

**Features:**
- Display revenue over time chart
- Aggregate financial data by period

**Data Source:**
- Query `financial_entries` filtered by customer
- Group by month/period
- Calculate totals

### 6. Credit Tab

**Features:**
- Display credit limit and available credit
- List installments/parcels in progress
- Payment history

**Data Source:**
- Customer credit_limit field
- Financial entries with type 'receivable'
- Calculate remaining balance

### 7. History Tab

**Features:**
- Unified timeline of all customer activities
- Combine sales, service orders, appointments, payments

**Data Source:**
- Query all related tables
- Sort by date descending
- Display with icons and descriptions

### 8. Attachments Tab

**Features:**
- Upload documents (RG, CPF, prescriptions)
- List uploaded files
- Download/delete files

**Implementation:**
- Use Supabase Storage
- Bucket: `customer-attachments`
- Path structure: `{company_id}/{customer_id}/{filename}`
- Store metadata in new table `customer_attachments`

## Export and Print Features

### Export CSV
- Generate CSV from filtered customer list
- Include: name, CPF, phone, email, status, tags, total spent, last visit
- Use browser download API

### Print
- Customer list: use window.print() with print-specific CSS
- Individual customer report: generate formatted report with all tabs data

## Error Handling

- All mutations wrapped in try-catch
- Toast notifications for success/error
- Loading states on all async operations
- Optimistic updates where appropriate
- Query invalidation after mutations

## Validation Rules

### Customer Creation/Edit
- Name is required
- Company and store context required
- Email format validation
- CPF format validation (if provided)
- Phone format validation

### Sales Creation
- At least one product required
- Stock availability check
- Seller and store required
- Valid payment method

### Service Order Creation
- Service type required
- Customer required
- At least one prescription field or service description
- Estimated deadline must be future date

### Appointment Creation
- Date/time required and must be future
- Service type required
- Professional required
- Store required

## Performance Considerations

- Use React Query caching for all data fetching
- Implement pagination for large lists (sales, O.S., appointments)
- Lazy load tabs (only fetch data when tab is opened)
- Debounce search inputs
- Use indexes on foreign keys in database

## Testing Checklist

- [ ] Create new customer
- [ ] Edit customer information
- [ ] Delete customer
- [ ] View customer details modal
- [ ] Overview tab shows real data
- [ ] Create new sale from customer modal
- [ ] View sale details
- [ ] Create new service order
- [ ] Edit service order
- [ ] Print service order
- [ ] Create new appointment
- [ ] Edit appointment
- [ ] Cancel appointment
- [ ] View revenue chart
- [ ] View credit information
- [ ] View history timeline
- [ ] Upload attachment
- [ ] Download attachment
- [ ] Delete attachment
- [ ] Export customers to CSV
- [ ] Print customer list
- [ ] Search customers
- [ ] Filter by status
- [ ] Filter by tags
- [ ] Switch between table/card view
- [ ] All KPIs show correct numbers

## Migration Order

1. **Phase 1: Data Hooks** - Create all custom hooks for customer-specific queries
2. **Phase 2: Overview Tab** - Implement real calculations and display
3. **Phase 3: Sales Tab** - Full CRUD with product selection
4. **Phase 4: Service Orders Tab** - Full CRUD with prescription fields
5. **Phase 5: Appointments Tab** - Full CRUD
6. **Phase 6: Revenue/Credit/History Tabs** - Aggregations and displays
7. **Phase 7: Attachments Tab** - Supabase Storage integration
8. **Phase 8: Export/Print** - CSV export and print functionality
9. **Phase 9: Testing & Polish** - Verify all features, fix bugs, optimize

## Success Criteria

- Zero mock data imports in customer-related components
- All buttons and modals functional
- All tabs display real data
- CRUD operations work correctly
- No console errors
- Loading states work properly
- Error handling in place
- Toast notifications for all actions
- Data refreshes after mutations
- Performance is acceptable (< 2s for most operations)
