
-- 1) user_keypairs: scoped INSERT / UPDATE / DELETE
CREATE POLICY "Users can insert own keypair"
  ON public.user_keypairs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own keypair"
  ON public.user_keypairs
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own keypair"
  ON public.user_keypairs
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- 2) user_roles: restrictive UPDATE / DELETE so only admins can ever mutate roles
CREATE POLICY "Only admins can update roles"
  ON public.user_roles
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete roles"
  ON public.user_roles
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3) Lock down SECURITY DEFINER helpers from the API roles
REVOKE ALL ON FUNCTION public.setup_new_user(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.setup_new_user(uuid, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO service_role;

-- has_role must remain callable by signed-in users because every RLS policy depends on it,
-- but anonymous visitors should never be able to probe roles.
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
