create table if not exists public.products (
  slug text primary key,
  name text not null,
  price integer not null check (price >= 0),
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;
grant select on public.products to anon, authenticated;

drop policy if exists "Anyone can read active products" on public.products;
create policy "Anyone can read active products"
  on public.products
  for select
  to anon, authenticated
  using (is_active = true);

insert into public.products (slug, name, price) values
  ('gta-v-ps4', 'Grand Theft Auto V', 89900),
  ('fc-24-ps4', 'EA SPORTS FC 24', 79900),
  ('god-of-war-ps4', 'God of War', 99900),
  ('spider-man-ps4', 'Marvel''s Spider-Man', 109900),
  ('demons-souls-ps5', 'Demon''s Souls', 169900),
  ('ratchet-clank-rift-apart-ps5', 'Ratchet & Clank: Rift Apart', 149900),
  ('returnal-ps5', 'Returnal', 139900),
  ('astros-playroom-ps5', 'Astro''s Playroom', 119900)
on conflict (slug) do update set
  name = excluded.name,
  price = excluded.price,
  updated_at = now();

create table if not exists public.cart_items (
  user_id uuid not null references auth.users (id) on delete cascade,
  product_slug text not null references public.products (slug) on delete cascade,
  quantity integer not null default 1 check (quantity between 1 and 99),
  created_at timestamptz not null default now(),
  primary key (user_id, product_slug)
);

alter table public.cart_items enable row level security;

drop policy if exists "Users can read their own cart" on public.cart_items;
create policy "Users can read their own cart"
  on public.cart_items
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can add active products to their own cart" on public.cart_items;
create policy "Users can add active products to their own cart"
  on public.cart_items
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.products
      where products.slug = cart_items.product_slug
        and products.is_active = true
    )
  );

drop policy if exists "Users can update their own cart" on public.cart_items;
create policy "Users can update their own cart"
  on public.cart_items
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.products
      where products.slug = cart_items.product_slug
        and products.is_active = true
    )
  );

drop policy if exists "Users can delete from their own cart" on public.cart_items;
create policy "Users can delete from their own cart"
  on public.cart_items
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

grant select on public.products to anon, authenticated;
grant select, insert, update, delete on public.cart_items to authenticated;

create or replace function public.add_to_cart(p_product_slug text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in is required to add products to a cart';
  end if;

  if not exists (
    select 1 from public.products
    where slug = p_product_slug and is_active = true
  ) then
    raise exception 'This product is not available';
  end if;

  insert into public.cart_items as existing_cart (user_id, product_slug, quantity)
  values (auth.uid(), p_product_slug, 1)
  on conflict (user_id, product_slug)
  do update set quantity = existing_cart.quantity + 1;
end;
$$;

revoke all on function public.add_to_cart(text) from public, anon;
grant execute on function public.add_to_cart(text) to authenticated;
