-- Add email column to tokens table
ALTER TABLE public.tokens 
ADD COLUMN email text;