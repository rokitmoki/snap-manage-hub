DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'uploads' AND policyname = 'Auth can delete uploads'
  ) THEN
    CREATE POLICY "Auth can delete uploads"
    ON public.uploads
    FOR DELETE
    USING (auth.role() = 'authenticated');
  END IF;
END $$;