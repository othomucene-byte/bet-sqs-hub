-- 1. Extensão não destrutiva do check de tipos do ledger (superconjunto)
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_type_check CHECK (type = ANY (ARRAY[
  'deposit','withdrawal','bet','win','refund','adjustment',
  'investment_buy','investment_refund','investment_redemption',
  'profit','loss','fee','reversal',
  'transfer_in','transfer_out','withdrawal_hold','withdrawal_release'
]));

-- 2. Colunas novas (todas opcionais / com default)
ALTER TABLE public.investments
  ADD COLUMN IF NOT EXISTS order_id uuid,
  ADD COLUMN IF NOT EXISTS principal numeric(18,2),
  ADD COLUMN IF NOT EXISTS accrued_return numeric(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS redeemed_at timestamptz;

ALTER TABLE public.investment_products
  ADD COLUMN IF NOT EXISTS max_amount numeric(18,2),
  ADD COLUMN IF NOT EXISTS rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS variable_return boolean NOT NULL DEFAULT true;

-- 3. KYC
CREATE TABLE IF NOT EXISTS public.kyc_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  document_type text NOT NULL DEFAULT 'bi' CHECK (document_type IN ('bi','passaporte','dire','carta_conducao')),
  document_number text NOT NULL,
  date_of_birth date,
  address text,
  province text,
  nationality text NOT NULL DEFAULT 'Moçambique',
  risk_profile text NOT NULL DEFAULT 'moderado' CHECK (risk_profile IN ('conservador','moderado','arrojado')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('not_started','pending','approved','rejected')),
  review_notes text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.kyc_profiles TO authenticated;
GRANT ALL ON public.kyc_profiles TO service_role;
ALTER TABLE public.kyc_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY kyc_select_own ON public.kyc_profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY kyc_admin_read ON public.kyc_profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY kyc_insert_own ON public.kyc_profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY kyc_update_own ON public.kyc_profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status <> 'approved') WITH CHECK (user_id = auth.uid());
CREATE TRIGGER kyc_profiles_set_updated_at BEFORE UPDATE ON public.kyc_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.kyc_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kyc_profile_id uuid REFERENCES public.kyc_profiles(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('id_front','id_back','selfie','proof_address','other')),
  storage_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.kyc_documents TO authenticated;
GRANT ALL ON public.kyc_documents TO service_role;
ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY kycdoc_select_own ON public.kyc_documents FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY kycdoc_admin_read ON public.kyc_documents FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY kycdoc_insert_own ON public.kyc_documents FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE TRIGGER kyc_documents_set_updated_at BEFORE UPDATE ON public.kyc_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Ordens
CREATE TABLE IF NOT EXISTS public.investment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.investment_products(id),
  investment_id uuid REFERENCES public.investments(id),
  side text NOT NULL CHECK (side IN ('buy','redeem')),
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  executed_amount numeric(18,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'MZN',
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','EXECUTED','PARTIALLY_EXECUTED','CANCELLED','FAILED','REDEEMED')),
  idempotency_key text NOT NULL UNIQUE,
  reference text NOT NULL UNIQUE,
  failure_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS investment_orders_user_idx ON public.investment_orders (user_id, created_at DESC);
GRANT SELECT ON public.investment_orders TO authenticated;
GRANT ALL ON public.investment_orders TO service_role;
ALTER TABLE public.investment_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY orders_select_own ON public.investment_orders FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY orders_admin_read ON public.investment_orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER investment_orders_set_updated_at BEFORE UPDATE ON public.investment_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.investment_order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.investment_orders(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS investment_order_events_order_idx ON public.investment_order_events (order_id, created_at);
GRANT SELECT ON public.investment_order_events TO authenticated;
GRANT ALL ON public.investment_order_events TO service_role;
ALTER TABLE public.investment_order_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY order_events_select_own ON public.investment_order_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.investment_orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
CREATE POLICY order_events_admin_read ON public.investment_order_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER investment_order_events_immutable BEFORE UPDATE OR DELETE ON public.investment_order_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_ledger_mutation();

-- 5. Posições
CREATE TABLE IF NOT EXISTS public.investment_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.investment_products(id),
  invested_amount numeric(18,2) NOT NULL DEFAULT 0,
  current_value numeric(18,2) NOT NULL DEFAULT 0,
  realized_result numeric(18,2) NOT NULL DEFAULT 0,
  unrealized_result numeric(18,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'MZN',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);
GRANT SELECT ON public.investment_positions TO authenticated;
GRANT ALL ON public.investment_positions TO service_role;
ALTER TABLE public.investment_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY positions_select_own ON public.investment_positions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY positions_admin_read ON public.investment_positions FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER investment_positions_set_updated_at BEFORE UPDATE ON public.investment_positions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Rendimentos declarados
CREATE TABLE IF NOT EXISTS public.investment_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  investment_id uuid NOT NULL REFERENCES public.investments(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.investment_products(id),
  kind text NOT NULL CHECK (kind IN ('PROFIT','LOSS')),
  amount numeric(18,2) NOT NULL CHECK (amount >= 0),
  period_start date,
  period_end date,
  reference text NOT NULL UNIQUE,
  settled boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS investment_returns_user_idx ON public.investment_returns (user_id, created_at DESC);
GRANT SELECT ON public.investment_returns TO authenticated;
GRANT ALL ON public.investment_returns TO service_role;
ALTER TABLE public.investment_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY returns_select_own ON public.investment_returns FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY returns_admin_read ON public.investment_returns FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- 7. Resgates
CREATE TABLE IF NOT EXISTS public.investment_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  investment_id uuid NOT NULL REFERENCES public.investments(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.investment_orders(id),
  principal numeric(18,2) NOT NULL DEFAULT 0,
  return_amount numeric(18,2) NOT NULL DEFAULT 0,
  total_amount numeric(18,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','COMPLETED','FAILED','CANCELLED')),
  reference text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.investment_redemptions TO authenticated;
GRANT ALL ON public.investment_redemptions TO service_role;
ALTER TABLE public.investment_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY redemptions_select_own ON public.investment_redemptions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY redemptions_admin_read ON public.investment_redemptions FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER investment_redemptions_set_updated_at BEFORE UPDATE ON public.investment_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 8. Documentação de produtos (pública)
CREATE TABLE IF NOT EXISTS public.investment_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.investment_products(id) ON DELETE CASCADE,
  title text NOT NULL,
  doc_type text NOT NULL DEFAULT 'factsheet' CHECK (doc_type IN ('factsheet','terms','risk','report')),
  url text,
  content text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.investment_documents TO anon, authenticated;
GRANT ALL ON public.investment_documents TO service_role;
ALTER TABLE public.investment_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY invdocs_public_read ON public.investment_documents FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER investment_documents_set_updated_at BEFORE UPDATE ON public.investment_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 9. Notificações
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'general' CHECK (category IN ('general','investment','payment','kyc','betting','risk')),
  title text NOT NULL,
  body text,
  read_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications (user_id, created_at DESC);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_select_own ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY notifications_update_own ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());