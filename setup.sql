-- Giving Campaignリスト：保存用の表と、アクセス制限の設定
-- Supabase の「SQL Editor」に全部貼り付けて「Run」を1回押してください。
-- 何度実行しても安全です（登録済みのデータは消えません）。項目を増やしたときも、これを実行し直します。

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  univ text not null default '',
  org text not null default '' check (char_length(org) <= 100),
  pref text not null default '',
  contact text not null default '' check (char_length(contact) <= 200),
  memo text not null default '' check (char_length(memo) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- 大学名は空でもよい（「その他（大学名なし）」のとき）
alter table public.entries alter column univ set default '';
alter table public.entries drop constraint if exists entries_univ_check;
alter table public.entries add constraint entries_univ_check check (char_length(univ) <= 100);

-- 都道府県は空でもよい
alter table public.entries alter column pref set default '';
alter table public.entries drop constraint if exists entries_pref_check;
alter table public.entries add constraint entries_pref_check check (char_length(pref) <= 20);

-- 追加した項目（contact 列は「連絡手段」として使います）
alter table public.entries add column if not exists vote_date    text not null default '' check (char_length(vote_date) <= 10);
alter table public.entries add column if not exists vote_time    text not null default '' check (char_length(vote_time) <= 8);
alter table public.entries add column if not exists comment      text not null default '' check (comment in ('', '◯', '✕'));
alter table public.entries add column if not exists reply        text not null default 'pending' check (reply in ('pending', 'done'));
alter table public.entries add column if not exists n_vote_date  text not null default '' check (char_length(n_vote_date) <= 10);
alter table public.entries add column if not exists n_vote_time  text not null default '' check (char_length(n_vote_time) <= 8);
alter table public.entries add column if not exists n_comment    text not null default '' check (n_comment in ('', '◯', '✕'));
alter table public.entries add column if not exists voted        boolean not null default false;

-- 行レベルセキュリティを有効にする（これが無いと誰でも読めてしまいます）
alter table public.entries enable row level security;

-- ログインしていない人（anon）の権限を外す
revoke all on public.entries from anon;
grant select, insert, update, delete on public.entries to authenticated;

-- ログインした人だけが、読む・登録・編集・削除できる
drop policy if exists "members can read" on public.entries;
drop policy if exists "members can insert" on public.entries;
drop policy if exists "members can update" on public.entries;
drop policy if exists "members can delete" on public.entries;

create policy "members can read"   on public.entries for select to authenticated using (true);
create policy "members can insert" on public.entries for insert to authenticated with check (true);
create policy "members can update" on public.entries for update to authenticated using (true) with check (true);
create policy "members can delete" on public.entries for delete to authenticated using (true);
