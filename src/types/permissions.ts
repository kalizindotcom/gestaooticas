export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'delete_permanently' | 'delete_installment' | 'delete_credit_book' | 'manage_fixed_costs' | 'settle' | 'reverse' | 'reconcile' | 'close_cash' | 'reopen_closing' | 'manage_budgets' | 'manage_transfers' | 'approve' | 'view_margin' | 'export' | 'print' | 'generate_insights' | 'manage_roles' | 'view_cost' | 'manage_cost' | 'view_prices' | 'manage_prices' | 'manage_categories' | 'manage_photos' | 'view_stock' | 'manage_stock' | 'view_stock_history' | 'view_sales_history' | 'view_os_history' | 'import' | 'view_audit' | 'view_statement' | 'view_receivable' | 'view_payable' | 'view_fixed_costs' | 'view_cashier' | 'view_performance' | 'view_reconciliation' | 'view_operations' | 'create_entry' | 'edit_entry' | 'delete_entry' | 'settle_entry' | 'reverse_entry' | 'cancel_entry' | 'export_statement' | 'print_statement' | 'open_cash' | 'cash_movement' | 'view_cash_history' | 'manage_card_settlements' | 'manage_bank_accounts' | 'import_bank_statement' | 'match_reconciliation' | 'complete_reconciliation' | 'generate_recurring' | 'create_installments' | 'manage_installments' | 'emit' | 'cancel' | 'correct' | 'inutilize' | 'resend' | 'view_xml' | 'download_xml' | 'configure' | 'manage_credentials' | 'view_tax_details' | 'view_protocol' | 'create_manual' | 'manage_series';

export type ModulePermissions = {
  view?: boolean;
  create?: boolean;
  edit?: boolean;
  delete?: boolean;
  delete_permanently?: boolean;
  delete_installment?: boolean;
  delete_credit_book?: boolean;
  manage_fixed_costs?: boolean;
  settle?: boolean;
  reverse?: boolean;
  reconcile?: boolean;
  close_cash?: boolean;
  reopen_closing?: boolean;
  manage_budgets?: boolean;
  manage_transfers?: boolean;
  approve?: boolean;
  view_margin?: boolean;
  export?: boolean;
  print?: boolean;
  generate_insights?: boolean;
  manage_roles?: boolean;
  view_cost?: boolean;
  manage_cost?: boolean;
  view_prices?: boolean;
  manage_prices?: boolean;
  manage_categories?: boolean;
  manage_photos?: boolean;
  view_stock?: boolean;
  manage_stock?: boolean;
  view_stock_history?: boolean;
  view_sales_history?: boolean;
  view_os_history?: boolean;
  manage_product_tax?: boolean;
  import?: boolean;
  view_audit?: boolean;
  view_statement?: boolean;
  view_receivable?: boolean;
  view_payable?: boolean;
  view_fixed_costs?: boolean;
  view_cashier?: boolean;
  view_performance?: boolean;
  view_reconciliation?: boolean;
  view_operations?: boolean;
  create_entry?: boolean;
  edit_entry?: boolean;
  delete_entry?: boolean;
  settle_entry?: boolean;
  reverse_entry?: boolean;
  cancel_entry?: boolean;
  export_statement?: boolean;
  print_statement?: boolean;
  open_cash?: boolean;
  cash_movement?: boolean;
  view_cash_history?: boolean;
  manage_card_settlements?: boolean;
  manage_bank_accounts?: boolean;
  import_bank_statement?: boolean;
  match_reconciliation?: boolean;
  complete_reconciliation?: boolean;
  generate_recurring?: boolean;
  create_installments?: boolean;
  manage_installments?: boolean;
  emit?: boolean;
  cancel?: boolean;
  correct?: boolean;
  inutilize?: boolean;
  resend?: boolean;
  view_xml?: boolean;
  download_xml?: boolean;
  configure?: boolean;
  manage_credentials?: boolean;
  view_tax_details?: boolean;
  view_protocol?: boolean;
  create_manual?: boolean;
  manage_series?: boolean;
};

export type GlobalPermissions = {
  dashboard: ModulePermissions;
  appointments: ModulePermissions;
  customers: ModulePermissions;
  products: ModulePermissions;
  sales: ModulePermissions;
  service_orders: ModulePermissions;
  financial: ModulePermissions;
  reports: ModulePermissions;
  users: ModulePermissions;
  settings: ModulePermissions;
  companies: ModulePermissions;
  stores: ModulePermissions;
  admin_center: ModulePermissions;
  fiscal: ModulePermissions;
};

export type UserRole = 'admin' | 'manager' | 'operator' | 'viewer';

export const DEFAULT_ADMIN_PERMISSIONS: GlobalPermissions = {
  dashboard: { view: true, generate_insights: true },
  appointments: { view: true, create: true, edit: true, delete: true },
  customers: { view: true, create: true, edit: true, delete: true, export: true, print: true },
  products: { view: true, create: true, edit: true, delete: true, delete_permanently: true, export: true, import: true, view_cost: true, manage_cost: true, view_prices: true, manage_prices: true, manage_categories: true, manage_photos: true, view_stock: true, manage_stock: true, view_stock_history: true, view_sales_history: true, view_os_history: true, manage_product_tax: true, view_audit: true },
  sales: { view: true, create: true, edit: true, delete: true },
  service_orders: { view: true, create: true, edit: true, delete: true, print: true },
  financial: { view: true, create: true, edit: true, delete: true, delete_installment: true, delete_credit_book: true, manage_fixed_costs: true, settle: true, reverse: true, reconcile: true, close_cash: true, reopen_closing: true, manage_budgets: true, manage_transfers: true, approve: true, view_margin: true, export: true, view_statement: true, view_receivable: true, view_payable: true, view_fixed_costs: true, view_cashier: true, view_performance: true, view_reconciliation: true, view_operations: true, create_entry: true, edit_entry: true, delete_entry: true, settle_entry: true, reverse_entry: true, cancel_entry: true, export_statement: true, print_statement: true, open_cash: true, cash_movement: true, view_cash_history: true, manage_card_settlements: true, manage_bank_accounts: true, import_bank_statement: true, match_reconciliation: true, complete_reconciliation: true, generate_recurring: true, create_installments: true, manage_installments: true, view_audit: true, manage_categories: true },
  reports: { view: true, export: true },
  users: { view: true, create: true, edit: true, delete: true, manage_roles: true },
  settings: { view: true, edit: true },
  companies: { view: true, create: true, edit: true, delete: true },
  stores: { view: true, create: true, edit: true, delete: true },
  admin_center: { view: true, edit: true },
  fiscal: { view: true, create: true, edit: true, delete: true, emit: true, cancel: true, correct: true, inutilize: true, resend: true, view_xml: true, download_xml: true, print: true, configure: true, manage_credentials: true, view_tax_details: true, view_protocol: true, create_manual: true, manage_series: true, export: true, import: true, view_audit: true },
};

export const DEFAULT_MANAGER_PERMISSIONS: GlobalPermissions = {
  dashboard: { view: true, generate_insights: true },
  appointments: { view: true, create: true, edit: true, delete: true },
  customers: { view: true, create: true, edit: true, delete: true, export: true, print: true },
  products: { view: true, create: true, edit: true, delete: true, delete_permanently: true, export: true, import: true, view_cost: true, manage_cost: true, view_prices: true, manage_prices: true, manage_categories: true, manage_photos: true, view_stock: true, manage_stock: true, view_stock_history: true, view_sales_history: true, view_os_history: true, manage_product_tax: true, view_audit: true },
  sales: { view: true, create: true, edit: true, delete: true },
  service_orders: { view: true, create: true, edit: true, delete: true, print: true },
  financial: { view: true, create: true, edit: true, delete: false, delete_installment: false, delete_credit_book: false, manage_fixed_costs: true, settle: true, reverse: false, reconcile: true, close_cash: true, reopen_closing: true, manage_budgets: true, manage_transfers: true, approve: true, view_margin: true, export: true, view_statement: true, view_receivable: true, view_payable: true, view_fixed_costs: true, view_cashier: true, view_performance: true, view_reconciliation: true, view_operations: true, create_entry: true, edit_entry: true, delete_entry: false, settle_entry: true, reverse_entry: false, cancel_entry: false, export_statement: true, print_statement: true, open_cash: true, cash_movement: true, view_cash_history: true, manage_card_settlements: true, manage_bank_accounts: true, import_bank_statement: true, match_reconciliation: true, complete_reconciliation: true, generate_recurring: true, create_installments: true, manage_installments: true, view_audit: true, manage_categories: true },
  reports: { view: true, export: true },
  users: { view: true, create: false, edit: false, delete: false },
  settings: { view: true, edit: false },
  companies: { view: true, create: false, edit: false, delete: false },
  stores: { view: true, create: false, edit: false, delete: false },
  admin_center: { view: false },
  fiscal: { view: true, create: true, edit: true, emit: true, cancel: false, correct: false, inutilize: false, resend: true, view_xml: true, download_xml: true, print: true, configure: false, manage_credentials: false, view_tax_details: true, view_protocol: true, create_manual: false, manage_series: false, export: true, import: false, view_audit: true },
};

export const DEFAULT_OPERATOR_PERMISSIONS: GlobalPermissions = {
  dashboard: { view: true, generate_insights: false },
  appointments: { view: true, create: true, edit: true, delete: false },
  customers: { view: true, create: true, edit: true, delete: false, export: true, print: true },
  products: { view: true, create: false, edit: false, delete: false, delete_permanently: false, view_prices: true, view_stock: true, view_os_history: true },
  sales: { view: true, create: true, edit: false, delete: false },
  service_orders: { view: true, create: true, edit: true, delete: false, print: true },
  financial: { view: false },
  reports: { view: false },
  users: { view: false },
  settings: { view: false },
  companies: { view: false },
  stores: { view: false },
  admin_center: { view: false },
  fiscal: { view: true, create: true, edit: false, emit: true, cancel: false, correct: false, inutilize: false, resend: false, view_xml: false, download_xml: false, print: true, configure: false, manage_credentials: false, view_tax_details: false, view_protocol: true, create_manual: false, manage_series: false, export: false, import: false, view_audit: false },
};

export const DEFAULT_VIEWER_PERMISSIONS: GlobalPermissions = {
  dashboard: { view: true, generate_insights: false },
  appointments: { view: true, create: false, edit: false, delete: false },
  customers: { view: true, create: false, edit: false, delete: false, export: false, print: true },
  products: { view: true, create: false, edit: false, delete: false, delete_permanently: false, view_prices: true },
  sales: { view: true, create: false, edit: false, delete: false },
  service_orders: { view: true, create: false, edit: false, delete: false, print: true },
  financial: { view: false },
  reports: { view: true, export: false },
  users: { view: false },
  settings: { view: false },
  companies: { view: false },
  stores: { view: false },
  admin_center: { view: false },
  fiscal: { view: true, create: false, edit: false, emit: false, cancel: false, correct: false, inutilize: false, resend: false, view_xml: false, download_xml: false, print: true, configure: false, manage_credentials: false, view_tax_details: false, view_protocol: false, create_manual: false, manage_series: false, export: false, import: false, view_audit: false },
};
