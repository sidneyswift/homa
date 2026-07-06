-- Migration #11: score history for the movement chips ("+4 mo since June 6").
-- Every rescore pushes the prior scores snapshot into history, so the report
-- can show honest, dated, positive movement after a deep dive or retest.
-- Display law still applies at render: drops never render as deficit.

alter table public.lead_reports add column history jsonb not null default '[]'::jsonb;
