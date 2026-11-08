-- Friday pre-order site — run once in the Supabase SQL editor.
-- All access goes through the server with the service-role key. RLS is enabled
-- with NO policies, so the anon/public key can read or write nothing.

create extension if not exists pgcrypto;

create table if not exists app_settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists products (
  id text primary key check (id in ('schnitzel', 'challah')),
  name text not null,
  description text not null default '',
  price_agorot int not null check (price_agorot >= 0),
  image text not null default '',
  image_alt text not null default '',
  available boolean not null default true,
  weekly_limit int check (weekly_limit is null or weekly_limit >= 0),
  requires_drink boolean not null default false,
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists friday_overrides (
  date date primary key,
  closed boolean not null default true,
  note text not null default ''
);

create sequence if not exists order_number_seq start 1001;

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint not null unique default nextval('order_number_seq'),
  public_token text not null unique,
  idempotency_key text not null unique,
  friday_date date not null,
  status text not null check (status in
    ('pending_payment','paid','preparing','ready','completed','cancel_requested','cancelled','payment_failed')),
  payment_status text not null check (payment_status in ('pending','paid','failed','refunded','partially_refunded')),
  customer_name text not null,
  phone text not null,
  fulfillment text not null check (fulfillment in ('pickup','delivery')),
  address text,
  apartment text,
  floor text,
  delivery_notes text,
  items jsonb not null,
  subtotal_agorot int not null,
  delivery_fee_agorot int not null default 0,
  total_agorot int not null check (total_agorot > 0),
  terms_accepted_at timestamptz not null,
  policy_snapshot text not null,
  payment_provider text not null,
  payment_ref text,
  payment_url text,
  paid_at timestamptz,
  cancel_requested_at timestamptz,
  cancel_reason text,
  refund_started_at timestamptz,
  refund_agorot int,
  refund_ref text,
  refunded_at timestamptz,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_friday_idx on orders (friday_date, status);
create unique index if not exists orders_payment_ref_idx on orders (payment_provider, payment_ref) where payment_ref is not null;

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists orders_touch on orders;
create trigger orders_touch before update on orders for each row execute function touch_updated_at();

alter table app_settings enable row level security;
alter table products enable row level security;
alter table friday_overrides enable row level security;
alter table orders enable row level security;

-- Atomic create: idempotency check + per-product weekly capacity + insert,
-- serialized per Friday with an advisory lock so two buyers can't oversell.
create or replace function create_pending_order(p_order jsonb, p_limits jsonb, p_hold_minutes int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_existing orders;
  v_new orders;
  v_lim record;
  v_used int;
  v_want int;
  v_friday date := (p_order->>'friday_date')::date;
begin
  perform pg_advisory_xact_lock(hashtext('friday:' || v_friday::text));

  select * into v_existing from orders where idempotency_key = p_order->>'idempotency_key';
  if found then
    return jsonb_build_object('kind', 'existing', 'order', to_jsonb(v_existing));
  end if;

  for v_lim in select key, value::int as lim from jsonb_each_text(coalesce(p_limits, '{}'::jsonb)) loop
    select coalesce(sum((i->>'quantity')::int), 0) into v_want
      from jsonb_array_elements(p_order->'items') i where i->>'productId' = v_lim.key;
    continue when v_want = 0;
    select coalesce(sum((i->>'quantity')::int), 0) into v_used
      from orders o, jsonb_array_elements(o.items) i
     where o.friday_date = v_friday
       and i->>'productId' = v_lim.key
       and (o.status in ('paid','preparing','ready','completed','cancel_requested')
            or (o.status = 'pending_payment' and o.created_at > now() - make_interval(mins => p_hold_minutes)));
    if v_used + v_want > v_lim.lim then
      return jsonb_build_object('kind', 'sold_out', 'productId', v_lim.key, 'remaining', greatest(v_lim.lim - v_used, 0));
    end if;
  end loop;

  insert into orders (
    public_token, idempotency_key, friday_date, status, payment_status, customer_name, phone,
    fulfillment, address, apartment, floor, delivery_notes, items, subtotal_agorot,
    delivery_fee_agorot, total_agorot, terms_accepted_at, policy_snapshot, payment_provider
  ) values (
    p_order->>'public_token', p_order->>'idempotency_key', v_friday, 'pending_payment', 'pending',
    p_order->>'customer_name', p_order->>'phone', p_order->>'fulfillment', p_order->>'address',
    p_order->>'apartment', p_order->>'floor', p_order->>'delivery_notes', p_order->'items',
    (p_order->>'subtotal_agorot')::int, (p_order->>'delivery_fee_agorot')::int, (p_order->>'total_agorot')::int,
    (p_order->>'terms_accepted_at')::timestamptz, p_order->>'policy_snapshot', p_order->>'payment_provider'
  ) returning * into v_new;

  return jsonb_build_object('kind', 'created', 'order', to_jsonb(v_new));
end $$;

revoke all on function create_pending_order(jsonb, jsonb, int) from public, anon, authenticated;
