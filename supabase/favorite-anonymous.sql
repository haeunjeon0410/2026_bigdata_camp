-- Supabase에서 Anonymous Sign-Ins를 먼저 켠 뒤 실행하세요.
-- Authentication > Providers > Anonymous Sign-Ins: Enable

alter table public.favorite enable row level security;

-- upsert(user_id, recipe_id)가 동작하도록 사용자별 중복을 막습니다.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'favorite_user_recipe_unique'
  ) then
    alter table public.favorite
      add constraint favorite_user_recipe_unique unique (user_id, recipe_id);
  end if;
end $$;

drop policy if exists "favorite_select_own" on public.favorite;
drop policy if exists "favorite_insert_own" on public.favorite;
drop policy if exists "favorite_delete_own" on public.favorite;

create policy "favorite_select_own"
  on public.favorite for select
  to authenticated
  using (auth.uid() = user_id);

create policy "favorite_insert_own"
  on public.favorite for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "favorite_delete_own"
  on public.favorite for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, delete on table public.favorite to authenticated;
