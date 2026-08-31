-- 1. EMPRESAS
CREATE TABLE public.companies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    name text NOT NULL,
    legal_name text,
    sector text NOT NULL,
    description text NOT NULL,
    headquarters text,
    founded_year integer,
    website text,
    listed_bvm boolean NOT NULL DEFAULT false,
    status text NOT NULL DEFAULT 'published',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.companies TO anon, authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY companies_public_read ON public.companies FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE TRIGGER companies_set_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. CANDIDATURAS DE EMPRESAS
CREATE TABLE public.company_applications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    company_name text NOT NULL,
    nuit text,
    sector text NOT NULL,
    contact_name text NOT NULL,
    contact_email text NOT NULL,
    contact_phone text,
    website text,
    funding_goal numeric(18,2),
    description text NOT NULL,
    status text NOT NULL DEFAULT 'submitted',
    review_notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.company_applications TO anon;
GRANT SELECT, INSERT ON public.company_applications TO authenticated;
GRANT ALL ON public.company_applications TO service_role;
ALTER TABLE public.company_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY apps_insert_public ON public.company_applications FOR INSERT TO anon, authenticated WITH CHECK (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY apps_select_own ON public.company_applications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY apps_admin_read ON public.company_applications FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER company_applications_set_updated_at BEFORE UPDATE ON public.company_applications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. PRODUTOS DE INVESTIMENTO
CREATE TABLE public.investment_products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    slug text NOT NULL UNIQUE,
    name text NOT NULL,
    description text NOT NULL,
    term_months integer NOT NULL,
    target_rate_annual numeric(6,4) NOT NULL,
    risk_level text NOT NULL DEFAULT 'medium',
    min_amount numeric(18,2) NOT NULL DEFAULT 500,
    capacity numeric(18,2) NOT NULL DEFAULT 1000000,
    raised numeric(18,2) NOT NULL DEFAULT 0,
    currency text NOT NULL DEFAULT 'MZN',
    status text NOT NULL DEFAULT 'open',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.investment_products TO anon, authenticated;
GRANT ALL ON public.investment_products TO service_role;
ALTER TABLE public.investment_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY products_public_read ON public.investment_products FOR SELECT TO anon, authenticated USING (status IN ('open','closed'));
CREATE TRIGGER investment_products_set_updated_at BEFORE UPDATE ON public.investment_products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. INVESTIMENTOS
CREATE TABLE public.investments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.investment_products(id),
    amount numeric(18,2) NOT NULL CHECK (amount > 0),
    target_rate_annual numeric(6,4) NOT NULL,
    status text NOT NULL DEFAULT 'active',
    reference text NOT NULL UNIQUE,
    matures_at timestamptz NOT NULL,
    cancelled_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.investments TO authenticated;
GRANT ALL ON public.investments TO service_role;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
CREATE POLICY investments_select_own ON public.investments FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY investments_admin_read ON public.investments FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER investments_set_updated_at BEFORE UPDATE ON public.investments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. CARTEIRA DE INVESTIMENTOS
CREATE OR REPLACE FUNCTION public.ensure_wallet(_user_id uuid, _kind text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
    _id uuid;
begin
    select id into _id from public.wallets where user_id = _user_id and kind = _kind;
    if _id is null then
        insert into public.wallets (user_id, kind) values (_user_id, _kind)
        on conflict (user_id, kind) do nothing;
        select id into _id from public.wallets where user_id = _user_id and kind = _kind;
    end if;
    return _id;
end;
$$;

-- 6. SUBSCREVER INVESTIMENTO
CREATE OR REPLACE FUNCTION public.place_investment(_user_id uuid, _product_id uuid, _amount numeric)
RETURNS public.investments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
    _product public.investment_products;
    _wallet_id uuid;
    _inv public.investments;
begin
    if _amount is null or _amount <= 0 then
        raise exception 'montante invalido';
    end if;

    select * into _product from public.investment_products where id = _product_id for update;
    if not found then
        raise exception 'produto inexistente';
    end if;
    if _product.status <> 'open' then
        raise exception 'produto fechado a novas subscricoes';
    end if;
    if _amount < _product.min_amount then
        raise exception 'montante abaixo do minimo do produto';
    end if;
    if _product.raised + _amount > _product.capacity then
        raise exception 'capacidade do produto esgotada';
    end if;

    _wallet_id := public.ensure_wallet(_user_id, 'investment');

    insert into public.investments (user_id, product_id, amount, target_rate_annual, reference, matures_at)
    values (
        _user_id, _product_id, _amount, _product.target_rate_annual,
        'inv:' || gen_random_uuid()::text,
        now() + (_product.term_months || ' months')::interval
    )
    returning * into _inv;

    perform public.wallet_apply(
        _wallet_id, 'investment_buy', -_amount, 'invbuy:' || _inv.id::text, null, null,
        jsonb_build_object('product_id', _product_id, 'investment_id', _inv.id)
    );

    update public.investment_products set raised = raised + _amount where id = _product_id;

    return _inv;
end;
$$;

-- 7. CANCELAR INVESTIMENTO (devolve o capital, sem rendimento)
CREATE OR REPLACE FUNCTION public.cancel_investment(_user_id uuid, _investment_id uuid)
RETURNS public.investments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
    _inv public.investments;
    _wallet_id uuid;
begin
    select * into _inv from public.investments where id = _investment_id for update;
    if not found then
        raise exception 'investimento inexistente';
    end if;
    if _inv.user_id <> _user_id then
        raise exception 'investimento nao pertence ao utilizador';
    end if;
    if _inv.status <> 'active' then
        return _inv;
    end if;

    update public.investments
       set status = 'cancelled', cancelled_at = now()
     where id = _investment_id
    returning * into _inv;

    _wallet_id := public.ensure_wallet(_user_id, 'investment');

    perform public.wallet_apply(
        _wallet_id, 'investment_refund', _inv.amount, 'invcancel:' || _inv.id::text, null, null,
        jsonb_build_object('product_id', _inv.product_id, 'investment_id', _inv.id)
    );

    update public.investment_products
       set raised = greatest(0, raised - _inv.amount)
     where id = _inv.product_id;

    return _inv;
end;
$$;

-- 8. EMPRESAS MOÇAMBICANAS REAIS
INSERT INTO public.companies (slug, name, legal_name, sector, description, headquarters, founded_year, website, listed_bvm) VALUES
('hcb','HCB','Hidroeléctrica de Cahora Bassa, S.A.','Energia','Operadora da barragem de Cahora Bassa, no rio Zambeze, a maior central hidroeléctrica da África Austral, com cerca de 2.075 MW de capacidade instalada.','Songo, Tete',1975,'https://www.hcb.co.mz',true),
('cdm','Cervejas de Moçambique','Cervejas de Moçambique, S.A.','Bebidas','Maior cervejeira do país, produtora das marcas 2M, Laurentina e Manica, integrada no grupo AB InBev e cotada na Bolsa de Valores de Moçambique.','Maputo',1995,'https://www.cdm.co.mz',true),
('enh','ENH','Empresa Nacional de Hidrocarbonetos, E.P.','Energia','Empresa pública que representa o Estado moçambicano nos projectos de exploração e produção de petróleo e gás natural, incluindo os projectos de GNL na Bacia do Rovuma.','Maputo',1981,'https://www.enh.co.mz',false),
('vodacom-mz','Vodacom Moçambique','Vodacom Moçambique, S.A.','Telecomunicações','Operadora de telecomunicações móveis com cobertura nacional, serviços de dados e a carteira móvel M-Pesa.','Maputo',2003,'https://www.vodacom.co.mz',false),
('tmcel','Tmcel','Moçambique Telecom, S.A.','Telecomunicações','Operadora nacional resultante da fusão da TDM com a mCel, com serviços fixos, móveis e a carteira mKesh.','Maputo',2018,'https://www.tmcel.mz',false),
('lam','LAM','Linhas Aéreas de Moçambique, S.A.','Aviação','Companhia aérea nacional, com origem na DETA (1936), operando rotas domésticas e regionais na África Austral.','Maputo',1980,'https://www.lam.co.mz',false),
('bci','BCI','Banco Comercial e de Investimentos, S.A.','Banca','Um dos maiores bancos comerciais de Moçambique pela rede de agências, com participação do grupo Caixa Geral de Depósitos e da BPI/Insitec.','Maputo',1996,'https://www.bci.co.mz',false),
('millennium-bim','Millennium bim','Banco Internacional de Moçambique, S.A.','Banca','Banco de referência no mercado moçambicano, participado pelo Millennium BCP, com forte presença em banca de retalho e digital.','Maputo',1995,'https://www.millenniumbim.co.mz',false),
('mozal','Mozal','Mozal, S.A.R.L.','Indústria','Fundição de alumínio em Beluluane, Matola — um dos maiores projectos industriais e exportadores do país.','Matola, Maputo',2000,'https://www.mozal.co.mz',false),
('petromoc','Petromoc','Petróleos de Moçambique, S.A.','Combustíveis','Empresa nacional de importação, armazenagem e distribuição de combustíveis e lubrificantes, com rede de postos em todo o país.','Maputo',1977,'https://www.petromoc.co.mz',false);

-- 9. PRODUTOS DE INVESTIMENTO (taxas alvo indicativas, sem garantia)
INSERT INTO public.investment_products (company_id, slug, name, description, term_months, target_rate_annual, risk_level, min_amount, capacity)
SELECT c.id, p.slug, p.name, p.description, p.term_months, p.rate, p.risk, p.min_amount, p.capacity
FROM (VALUES
 ('hcb','hcb-energia-24m','Nota Energia HCB 24M','Exposição indexada ao sector de energia hidroeléctrica, com prazo de 24 meses e taxa alvo indicativa.',24,0.1050,'low',1000,5000000),
 ('cdm','cdm-consumo-12m','Nota Consumo CDM 12M','Produto de curto prazo ligado ao sector de bebidas e bens de consumo em Moçambique.',12,0.0925,'low',500,3000000),
 ('enh','enh-gas-36m','Nota Gás ENH 36M','Prazo longo com exposição indicativa à cadeia de valor do gás natural na Bacia do Rovuma.',36,0.1400,'high',2500,8000000),
 ('vodacom-mz','vodacom-digital-18m','Nota Digital Vodacom 18M','Exposição ao crescimento de dados móveis e pagamentos digitais.',18,0.1125,'medium',1000,4000000),
 ('bci','bci-poupanca-12m','Poupança Estruturada BCI 12M','Produto conservador indexado ao sector bancário, com prazo de 12 meses.',12,0.0875,'low',500,6000000),
 ('millennium-bim','bim-rendimento-24m','Rendimento bim 24M','Produto de médio prazo ligado a banca de retalho e crédito às PME.',24,0.1000,'medium',1000,6000000),
 ('mozal','mozal-industria-24m','Nota Indústria Mozal 24M','Exposição indicativa ao sector industrial exportador de alumínio.',24,0.1200,'medium',1500,4000000),
 ('petromoc','petromoc-logistica-18m','Nota Logística Petromoc 18M','Ligado à distribuição de combustíveis e logística nacional.',18,0.1075,'medium',1000,3500000),
 ('lam','lam-mobilidade-12m','Nota Mobilidade LAM 12M','Produto de curto prazo com exposição ao transporte aéreo regional.',12,0.1300,'high',1000,1500000),
 ('tmcel','tmcel-conectividade-18m','Nota Conectividade Tmcel 18M','Exposição indicativa à expansão de conectividade fixa e móvel.',18,0.1150,'high',1000,2000000)
) AS p(company_slug, slug, name, description, term_months, rate, risk, min_amount, capacity)
JOIN public.companies c ON c.slug = p.company_slug;