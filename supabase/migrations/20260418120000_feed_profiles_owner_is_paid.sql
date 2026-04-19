-- Admins: each feed item includes whether the listing owner has an active subscription (for Paid vs Free sections in UI).
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
      IF v_admin THEN
        item := to_jsonb(rec) || jsonb_build_object(
          'profile_photos', photos,
          'visibility_tier', 'owner',
          'owner_is_paid', public.is_paid_subscriber(rec.user_id)
        );
      ELSE
        item := to_jsonb(rec) || jsonb_build_object(
          'profile_photos', photos,
          'visibility_tier', 'owner'
        );
      END IF;
    ELSIF v_admin THEN
      photos := public._profile_photos_json(rec.id, false);
      item := to_jsonb(rec) || jsonb_build_object(
        'profile_photos', photos,
        'visibility_tier', 'admin',
        'owner_is_paid', public.is_paid_subscriber(rec.user_id)
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
