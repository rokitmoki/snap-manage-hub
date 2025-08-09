-- Schema for token-based picture upload app
-- Create sequence for sequential process numbers
CREATE SEQUENCE IF NOT EXISTS public.process_seq START WITH 1000 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

-- Departments
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tokens
CREATE TABLE IF NOT EXISTS public.tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  label TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pivot: token_departments
CREATE TABLE IF NOT EXISTS public.token_departments (
  token_id UUID NOT NULL REFERENCES public.tokens(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  PRIMARY KEY (token_id, department_id)
);

-- Categories
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Processes (Vorgänge)
CREATE TABLE IF NOT EXISTS public.processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_number BIGINT NOT NULL DEFAULT nextval('public.process_seq'),
  token_id UUID NOT NULL REFERENCES public.tokens(id) ON DELETE RESTRICT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(process_number)
);

-- Uploads
CREATE TABLE IF NOT EXISTS public.uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  mime_type TEXT,
  size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;

-- Policies
-- Categories: public read, authenticated full access
DROP POLICY IF EXISTS "Public can view categories" ON public.categories;
CREATE POLICY "Public can view categories" ON public.categories
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth manage categories" ON public.categories;
CREATE POLICY "Auth manage categories" ON public.categories
FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Departments: authenticated manage
DROP POLICY IF EXISTS "Auth manage departments" ON public.departments;
CREATE POLICY "Auth manage departments" ON public.departments
FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Tokens: authenticated manage
DROP POLICY IF EXISTS "Auth manage tokens" ON public.tokens;
CREATE POLICY "Auth manage tokens" ON public.tokens
FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Token_Departments: authenticated manage
DROP POLICY IF EXISTS "Auth manage token_departments" ON public.token_departments;
CREATE POLICY "Auth manage token_departments" ON public.token_departments
FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Processes: authenticated can read; inserts via function only
DROP POLICY IF EXISTS "Auth can view processes" ON public.processes;
CREATE POLICY "Auth can view processes" ON public.processes
FOR SELECT USING (auth.role() = 'authenticated');

-- Uploads: authenticated can read; inserts via function only
DROP POLICY IF EXISTS "Auth can view uploads" ON public.uploads;
CREATE POLICY "Auth can view uploads" ON public.uploads
FOR SELECT USING (auth.role() = 'authenticated');

-- Functions
-- Start process with token validation
CREATE OR REPLACE FUNCTION public.start_process(token_value TEXT, category UUID, note TEXT)
RETURNS public.processes AS $$
DECLARE
  t public.tokens;
  p public.processes;
BEGIN
  SELECT * INTO t FROM public.tokens WHERE token = token_value AND active = true;
  IF t.id IS NULL THEN
    RAISE EXCEPTION 'Invalid or inactive token';
  END IF;

  INSERT INTO public.processes(token_id, category_id, note)
  VALUES (t.id, category, note)
  RETURNING * INTO p;

  RETURN p;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add upload metadata to a process
CREATE OR REPLACE FUNCTION public.add_upload(process UUID, file_path TEXT, mime TEXT, size BIGINT)
RETURNS public.uploads AS $$
DECLARE
  p public.processes;
  u public.uploads;
BEGIN
  SELECT * INTO p FROM public.processes WHERE id = process;
  IF p.id IS NULL THEN
    RAISE EXCEPTION 'Process not found';
  END IF;

  INSERT INTO public.uploads(process_id, file_path, mime_type, size)
  VALUES (process, file_path, mime, size)
  RETURNING * INTO u;

  RETURN u;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Storage bucket for files
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public read uploads bucket'
  ) THEN
    CREATE POLICY "Public read uploads bucket" ON storage.objects
    FOR SELECT USING (bucket_id = 'uploads');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Anyone can insert into uploads'
  ) THEN
    CREATE POLICY "Anyone can insert into uploads" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'uploads');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Auth can modify uploads'
  ) THEN
    CREATE POLICY "Auth can modify uploads" ON storage.objects
    FOR ALL USING (bucket_id = 'uploads' AND auth.role() = 'authenticated') WITH CHECK (bucket_id = 'uploads' AND auth.role() = 'authenticated');
  END IF;
END $$;