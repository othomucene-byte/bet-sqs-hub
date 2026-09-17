alter table public.game_rounds drop constraint if exists game_rounds_game_check;
alter table public.game_rounds add constraint game_rounds_game_check
  check (game = any (array['aviator','fish','navigator','boost','wheel','chicken','lion']));