-- Allow authenticated users to delete from uploads
CREATE POLICY IF NOT EXISTS "Auth can delete uploads"
ON public.uploads
FOR DELETE
USING (auth.role() = 'authenticated');