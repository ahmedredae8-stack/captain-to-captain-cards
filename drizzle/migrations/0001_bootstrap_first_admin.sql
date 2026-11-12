CREATE OR REPLACE FUNCTION public.grant_first_admin()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND NEW.username_norm = 'احمد الشبح'
     AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.user_id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.grant_first_admin() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER players_grant_first_admin AFTER INSERT ON public.players
FOR EACH ROW EXECUTE FUNCTION public.grant_first_admin();