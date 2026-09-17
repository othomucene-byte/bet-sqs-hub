select cron.schedule(
  'webhook-dispatch-retry',
  '17 * * * *',
  $job$select jobs.call_app('/api/public/cron/webhook-dispatch');$job$
);