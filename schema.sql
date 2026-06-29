-- ============================================================
-- 求職者CRM データベーススキーマ（Supabase / PostgreSQL）
-- ============================================================
-- 使い方：Supabaseダッシュボード → SQL Editor → このファイルの内容を
-- そのまま貼り付けて「Run」を押してください。
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 求職者（候補者）テーブル
-- ------------------------------------------------------------
create table if not exists candidates (
  id uuid primary key default gen_random_uuid(),
  service text not null check (service in ('agent', 'challenge')),

  name text not null default '',
  yomi text default '',
  furigana text default '',
  email text default '',
  phone text default '',
  registered_date date,
  application_time text default '',
  source text default '',
  desired_job_type text default '',
  current_company text default '',
  status text default 'new',
  assigned_to text default '',
  tags jsonb default '[]'::jsonb,
  memo text default '',
  last_contact_date date,
  next_action_date date,
  first_interview_date date,
  closed_date date,

  gender text default '',
  age text default '',
  education text default '',
  disability_type text default '',
  residence text default '',
  work_experience_count text default '',
  employment_status text default '',
  current_salary text default '',
  desired_salary text default '',
  min_desired_salary text default '',
  desired_work_location jsonb default '[]'::jsonb,
  desired_join_timing text default '',
  job_change_axis text default '',
  has_self_application text default '',
  uses_other_agency text default '',
  proposed_job_type text default '',

  cohort_month text default '',

  interviews jsonb default '[]'::jsonb,
  applications jsonb default '[]'::jsonb,
  follow_up_log jsonb default '[]'::jsonb,
  follow_up_checklist jsonb default '[false,false,false,false,false,false,false,false,false,false]'::jsonb,
  activities jsonb default '[]'::jsonb,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_candidates_service on candidates(service);
create index if not exists idx_candidates_cohort on candidates(service, cohort_month);
create index if not exists idx_candidates_assigned on candidates(service, assigned_to);
create index if not exists idx_candidates_status on candidates(service, status);

-- ------------------------------------------------------------
-- 担当者（コンサルタント）マスタ
-- ------------------------------------------------------------
create table if not exists consultants (
  id uuid primary key default gen_random_uuid(),
  service text not null check (service in ('agent', 'challenge')),
  name text not null,
  created_at timestamptz default now(),
  unique (service, name)
);

-- ------------------------------------------------------------
-- 担当者別KPI目標（月次）
-- ------------------------------------------------------------
create table if not exists kpi_targets (
  service text not null check (service in ('agent', 'challenge')),
  assignee text not null,
  month text not null, -- 'YYYY-MM'
  meeting_scheduled int default 0,
  first_meeting_done int default 0,
  follow_meeting_done int default 0,
  meeting_done_total int default 0,
  document_passed int default 0,
  offers int default 0,
  offer_accepted int default 0,
  revenue_target numeric default 0,
  revenue_actual_legacy numeric default 0, -- 旧バージョンの手入力売上実績（後方互換用）
  updated_at timestamptz default now(),
  primary key (service, assignee, month)
);

-- ------------------------------------------------------------
-- 日次KPIカレンダー（担当者別。売上・面談予定数・初回面談実施数など全指標を共通テーブルで管理）
-- ------------------------------------------------------------
create table if not exists daily_kpi_values (
  service text not null check (service in ('agent', 'challenge')),
  metric_key text not null, -- 'revenue' / 'meetingScheduled' / 'firstMeetingDone' など
  assignee text not null,
  rev_date date not null,
  amount numeric not null default 0,
  updated_at timestamptz default now(),
  primary key (service, metric_key, assignee, rev_date)
);

-- 【既存データの移行】既に daily_revenue テーブルにデータがある場合は、
-- 以下のSQLを一度だけ実行してから daily_revenue テーブルは削除して構いません。
-- insert into daily_kpi_values (service, metric_key, assignee, rev_date, amount)
--   select service, 'revenue', assignee, rev_date, amount from daily_revenue
--   on conflict do nothing;
-- drop table if exists daily_revenue;

-- ------------------------------------------------------------
-- 会社全体の売上目標・実績（CA／RA／合算、月次）
-- ------------------------------------------------------------
create table if not exists company_revenue (
  service text not null check (service in ('agent', 'challenge')),
  month text not null,
  ca_target numeric default 0,
  ra_target numeric default 0,
  total_target numeric default 0,
  ca_actual numeric default 0,
  ra_actual numeric default 0,
  total_actual numeric default 0,
  updated_at timestamptz default now(),
  primary key (service, month)
);

-- ------------------------------------------------------------
-- 営業日設定：手動登録の休暇・年末年始休暇など（土日・国民の祝日は自動計算）
-- ------------------------------------------------------------
create table if not exists custom_holidays (
  id text primary key,
  service text not null check (service in ('agent', 'challenge')),
  start_date date not null,
  end_date date not null,
  label text default '',
  created_at timestamptz default now()
);
create index if not exists idx_custom_holidays_service on custom_holidays(service);

-- ------------------------------------------------------------
-- 企業問い合わせ（人材紹介依頼・商談管理）
-- ------------------------------------------------------------
create table if not exists inquiries (
  id text primary key,
  service text not null check (service in ('agent', 'challenge')),
  inquiry_date date,
  company_name text default '',
  contact_person_name text default '',
  inquiry_type text default '',
  inquiry_content text default '',
  status text default 'inquiry',
  assigned_to text default '',
  activities jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_inquiries_service on inquiries(service);

-- ============================================================
-- Row Level Security
-- ============================================================
-- 注意：このアプリにはログイン機能がないため、URLを知っている人は
-- 全データを閲覧・編集できる設定になっています（社内利用を想定）。
-- 将来的にログイン機能を追加する場合は、これらのポリシーを
-- auth.uid() を使った制限に置き換えてください。
-- ============================================================

alter table candidates enable row level security;
alter table consultants enable row level security;
alter table kpi_targets enable row level security;
alter table daily_kpi_values enable row level security;
alter table company_revenue enable row level security;
alter table custom_holidays enable row level security;
alter table inquiries enable row level security;

create policy "allow all - candidates" on candidates for all using (true) with check (true);
create policy "allow all - consultants" on consultants for all using (true) with check (true);
create policy "allow all - kpi_targets" on kpi_targets for all using (true) with check (true);
create policy "allow all - daily_kpi_values" on daily_kpi_values for all using (true) with check (true);
create policy "allow all - company_revenue" on company_revenue for all using (true) with check (true);
create policy "allow all - custom_holidays" on custom_holidays for all using (true) with check (true);
create policy "allow all - inquiries" on inquiries for all using (true) with check (true);

-- ============================================================
-- updated_at を自動更新するトリガー
-- ============================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_candidates_updated_at before update on candidates
  for each row execute function set_updated_at();
create trigger trg_kpi_targets_updated_at before update on kpi_targets
  for each row execute function set_updated_at();
create trigger trg_daily_kpi_values_updated_at before update on daily_kpi_values
  for each row execute function set_updated_at();
create trigger trg_company_revenue_updated_at before update on company_revenue
  for each row execute function set_updated_at();
create trigger trg_inquiries_updated_at before update on inquiries
  for each row execute function set_updated_at();
