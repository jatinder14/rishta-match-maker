-- Contact fields: visible to profile owner via direct table reads; never exposed in browse RPC for non-admin.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS contact_email text;

-- Paid access (set active + current_period_end via Stripe webhook or manual admin).
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'inactive',
  stripe_subscription_id text,
  stripe_customer_id text,
  current_period_end timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own subscription" ON public.user_subscriptions;
CREATE POLICY "Users read own subscription"
  ON public.user_subscriptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- Service role / dashboard updates subscriptions; no insert policy for anon key clients.

CREATE OR REPLACE FUNCTION public.is_paid_subscriber(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_subscriptions s
    WHERE s.user_id = _user_id
      AND s.status = 'active'
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
  );
$$;

-- One matrimonial profile per non-admin account; admins may create rows for any user_id.
DROP POLICY IF EXISTS "Authenticated users can create profiles" ON public.profiles;
CREATE POLICY "Create profile with limits"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid())
    OR (
      auth.uid() = user_id
      AND NOT EXISTS (
        SELECT 1 FROM public.profiles p2 WHERE p2.user_id = auth.uid()
      )
    )
  );

CREATE OR REPLACE FUNCTION public._profile_photos_json(_profile_id uuid, _limit_one boolean)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  photos jsonb;
BEGIN
  IF _limit_one THEN
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', pp.id,
          'storage_path', pp.storage_path,
          'display_order', COALESCE(pp.display_order, 0)
        )
      ),
      '[]'::jsonb
    )
    INTO photos
    FROM (
      SELECT id, storage_path, display_order
      FROM public.profile_photos
      WHERE profile_id = _profile_id
      ORDER BY COALESCE(display_order, 0), created_at
      LIMIT 1
    ) pp;
  ELSE
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', pp.id,
          'storage_path', pp.storage_path,
          'display_order', COALESCE(pp.display_order, 0)
        )
        ORDER BY COALESCE(pp.display_order, 0), pp.created_at
      ),
      '[]'::jsonb
    )
    INTO photos
    FROM public.profile_photos pp
    WHERE pp.profile_id = _profile_id;
  END IF;
  RETURN photos;
END;
$$;

CREATE OR REPLACE FUNCTION public.feed_profiles(p_search text DEFAULT NULL, p_gender text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_admin boolean;
  v_paid boolean;
  rec public.profiles%ROWTYPE;
  photos jsonb;
  item jsonb;
  arr jsonb[] := '{}'::jsonb[];
  s text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  v_admin := public.is_admin(v_uid);
  v_paid := public.is_paid_subscriber(v_uid);
  s := NULLIF(trim(COALESCE(p_search, '')), '');

  FOR rec IN
    SELECT p.*
    FROM public.profiles p
    WHERE (
      p_gender IS NULL
      OR trim(COALESCE(p_gender, '')) = ''
      OR lower(trim(p_gender)) = 'all'
      OR p.gender = p_gender
    )
    AND (
      s IS NULL
      OR p.name ILIKE '%' || s || '%'
      OR COALESCE(p.surname, '') ILIKE '%' || s || '%'
      OR COALESCE(p.residence_city, '') ILIKE '%' || s || '%'
      OR COALESCE(p.caste, '') ILIKE '%' || s || '%'
      OR COALESCE(p.occupation, '') ILIKE '%' || s || '%'
    )
    ORDER BY p.created_at DESC
  LOOP
    IF rec.user_id = v_uid THEN
      photos := public._profile_photos_json(rec.id, false);
      item := to_jsonb(rec) || jsonb_build_object(
        'profile_photos', photos,
        'visibility_tier', 'owner'
      );
    ELSIF v_admin THEN
      photos := public._profile_photos_json(rec.id, false);
      item := to_jsonb(rec) || jsonb_build_object(
        'profile_photos', photos,
        'visibility_tier', 'admin'
      );
    ELSIF v_paid THEN
      photos := public._profile_photos_json(rec.id, false);
      item := (to_jsonb(rec) - 'contact_phone' - 'contact_email')
        || jsonb_build_object(
          'profile_photos', photos,
          'visibility_tier', 'paid'
        );
    ELSE
      photos := public._profile_photos_json(rec.id, true);
      item := jsonb_build_object(
        'id', rec.id,
        'gender', rec.gender,
        'profile_photos', photos,
        'visibility_tier', 'free'
      );
    END IF;

    arr := array_append(arr, item);
  END LOOP;

  RETURN coalesce(
    (
      SELECT jsonb_agg(x ORDER BY ord)
      FROM unnest(arr) WITH ORDINALITY AS t(x, ord)
    ),
    '[]'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_profile_for_viewer(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_admin boolean;
  v_paid boolean;
  rec public.profiles%ROWTYPE;
  photos jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO rec FROM public.profiles WHERE id = p_profile_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_admin := public.is_admin(v_uid);
  v_paid := public.is_paid_subscriber(v_uid);

  IF rec.user_id = v_uid THEN
    photos := public._profile_photos_json(rec.id, false);
    RETURN to_jsonb(rec) || jsonb_build_object(
      'profile_photos', photos,
      'visibility_tier', 'owner'
    );
  END IF;

  IF v_admin THEN
    photos := public._profile_photos_json(rec.id, false);
    RETURN to_jsonb(rec) || jsonb_build_object(
      'profile_photos', photos,
      'visibility_tier', 'admin'
    );
  END IF;

  IF v_paid THEN
    photos := public._profile_photos_json(rec.id, false);
    RETURN (to_jsonb(rec) - 'contact_phone' - 'contact_email')
      || jsonb_build_object(
        'profile_photos', photos,
        'visibility_tier', 'paid'
      );
  END IF;

  photos := public._profile_photos_json(rec.id, true);
  RETURN jsonb_build_object(
    'id', rec.id,
    'gender', rec.gender,
    'profile_photos', photos,
    'visibility_tier', 'free'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_profiles()
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
        to_jsonb(p.*)
        || jsonb_build_object(
          'profile_photos', public._profile_photos_json(p.id, false),
          'account_email', u.email,
          'account_phone', u.phone
        )
        ORDER BY p.created_at DESC
      ),
      '[]'::jsonb
    )
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_paid_subscriber(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.feed_profiles(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_for_viewer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_profiles() TO authenticated;
