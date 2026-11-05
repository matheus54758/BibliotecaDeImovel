-- Tabela de Construtoras (Builders)
CREATE TABLE IF NOT EXISTS public.builders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Empreendimentos (Developments)
CREATE TABLE IF NOT EXISTS public.developments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    builder_id UUID REFERENCES public.builders(id),
    title TEXT NOT NULL,
    description TEXT,
    city TEXT NOT NULL,
    neighborhood TEXT,
    price_starting_at NUMERIC,
    min_bedrooms INT,
    max_bedrooms INT,
    status TEXT DEFAULT 'available',
    hero_image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.builders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.developments ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso público para leitura (O bot vai precisar ler)
CREATE POLICY "Allow public read access to builders"
    ON public.builders FOR SELECT
    USING (true);

CREATE POLICY "Allow public read access to developments"
    ON public.developments FOR SELECT
    USING (true);

-- Função de Busca Inteligente (RPC) para o Bot do WhatsApp
-- O bot envia parâmetros (ex: 2 quartos e 500000 de preço máximo)
-- e o Supabase devolve a lista dos empreendimentos compatíveis.
CREATE OR REPLACE FUNCTION match_developments_for_bot(
    p_bedrooms INT DEFAULT NULL,
    p_max_price NUMERIC DEFAULT NULL,
    p_city TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    city TEXT,
    price_starting_at NUMERIC,
    min_bedrooms INT,
    hero_image_url TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id, 
        d.title, 
        d.city, 
        d.price_starting_at, 
        d.min_bedrooms, 
        d.hero_image_url
    FROM 
        public.developments d
    WHERE 
        d.status = 'available'
        AND (p_bedrooms IS NULL OR d.max_bedrooms >= p_bedrooms)
        AND (p_max_price IS NULL OR d.price_starting_at <= p_max_price)
        AND (p_city IS NULL OR d.city ILIKE '%' || p_city || '%')
    ORDER BY d.price_starting_at ASC
    LIMIT 3; 
END;
$$ LANGUAGE plpgsql;
