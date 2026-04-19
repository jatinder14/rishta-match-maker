-- Admin: delete profile rows (run after client removes storage objects when possible).
CREATE OR REPLACE FUNCTION public.admin_delete_profile(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin(v_uid) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  DELETE FROM public.profile_photos WHERE profile_id = p_profile_id;
  DELETE FROM public.profiles WHERE id = p_profile_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_profile(uuid) TO authenticated;

-- All auth users + optional profile id (for accounts without a listing).
CREATE OR REPLACE FUNCTION public.admin_list_accounts()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin(v_uid) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'user_id', u.id,
          'email', u.email,
          'phone', u.phone,
          'created_at', u.created_at,
          'profile_id', p.id
        )
        ORDER BY u.created_at DESC NULLS LAST
      ),
      '[]'::jsonb
    )
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.user_id = u.id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_accounts() TO authenticated;

-- Direct table access for admin tools (Profile form, photo CRUD).
DROP POLICY IF EXISTS "Admins select all profiles" ON public.profiles;
CREATE POLICY "Admins select all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins update any profile" ON public.profiles;
CREATE POLICY "Admins update any profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins delete any profile" ON public.profiles;
CREATE POLICY "Admins delete any profile"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins insert profile photos" ON public.profile_photos;
CREATE POLICY "Admins insert profile photos"
  ON public.profile_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = profile_photos.profile_id
        AND public.is_admin(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins update profile photos" ON public.profile_photos;
CREATE POLICY "Admins update profile photos"
  ON public.profile_photos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = profile_photos.profile_id
        AND public.is_admin(auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = profile_photos.profile_id
        AND public.is_admin(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins delete profile photos" ON public.profile_photos;
CREATE POLICY "Admins delete profile photos"
  ON public.profile_photos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = profile_photos.profile_id
        AND public.is_admin(auth.uid())
    )
  );
