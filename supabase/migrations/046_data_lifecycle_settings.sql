-- IMAGE PARTNERS - administrator-managed data lifecycle policy

alter table public.platform_commerce_settings
  add column if not exists personal_data_retention_days integer not null default 1095,
  add column if not exists transaction_history_retention_days integer not null default 1825,
  add column if not exists inactive_account_retention_days integer not null default 365,
  add column if not exists audit_log_retention_days integer not null default 730,
  add column if not exists deletion_request_retention_days integer not null default 730;

alter table public.platform_commerce_settings
  drop constraint if exists platform_commerce_settings_personal_data_retention_check,
  drop constraint if exists platform_commerce_settings_transaction_history_retention_check,
  drop constraint if exists platform_commerce_settings_inactive_account_retention_check,
  drop constraint if exists platform_commerce_settings_audit_log_retention_check,
  drop constraint if exists platform_commerce_settings_deletion_request_retention_check;

alter table public.platform_commerce_settings
  add constraint platform_commerce_settings_personal_data_retention_check
    check (personal_data_retention_days between 30 and 3650),
  add constraint platform_commerce_settings_transaction_history_retention_check
    check (transaction_history_retention_days between 30 and 3650),
  add constraint platform_commerce_settings_inactive_account_retention_check
    check (inactive_account_retention_days between 30 and 3650),
  add constraint platform_commerce_settings_audit_log_retention_check
    check (audit_log_retention_days between 30 and 3650),
  add constraint platform_commerce_settings_deletion_request_retention_check
    check (deletion_request_retention_days between 30 and 3650);

comment on column public.platform_commerce_settings.personal_data_retention_days is
  'Maximum retention after account withdrawal before personal data anonymization review';
comment on column public.platform_commerce_settings.transaction_history_retention_days is
  'Maximum retention for an individual customer transaction history';
comment on column public.platform_commerce_settings.inactive_account_retention_days is
  'Review threshold for inactive account data';
comment on column public.platform_commerce_settings.audit_log_retention_days is
  'Maximum retention for administrator audit logs';
comment on column public.platform_commerce_settings.deletion_request_retention_days is
  'Maximum retention for completed image deletion request records';
