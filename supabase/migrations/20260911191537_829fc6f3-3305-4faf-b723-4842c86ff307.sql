create schema if not exists jobs;
revoke all on schema jobs from public, anon, authenticated;

create table if not exists jobs.config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
revoke all on jobs.config from public, anon, authenticated;
grant usage on schema jobs to sandbox_exec;
grant select, insert, update on jobs.config to sandbox_exec;

create or replace function jobs.call_app(_path text)
returns bigint
language plpgsql
security definer
set search_path = jobs, extensions, public
as $fn$
declare
  _token text;
  _req bigint;
begin
  select value into _token from jobs.config where key = 'cron_secret';
  if _token is null then
    raise notice 'cron secret ausente: tarefa nao executada';
    return null;
  end if;
  select net.http_post(
    url := 'https://project--f1a3e97d-cc85-4b38-8ab3-f45a6cd5b061.lovable.app' || _path,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || _token),
    body := '{}'::jsonb
  ) into _req;
  return _req;
end;
$fn$;
revoke all on function jobs.call_app(text) from public, anon, authenticated;

select cron.schedule(
  'exchange-ai-hourly',
  '7 * * * *',
  $job$select jobs.call_app('/api/public/cron/exchange-ai');$job$
);