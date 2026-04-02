
CREATE OR REPLACE FUNCTION public.authenticate(p_email text, p_password text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user record;
  v_token text;
  v_roles text[];
BEGIN
  SELECT id, email, full_name, password_hash
  INTO v_user
  FROM public.profiles
  WHERE email = p_email;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid login credentials';
  END IF;

  IF v_user.password_hash IS NULL OR v_user.password_hash != crypt(p_password, v_user.password_hash) THEN
    RAISE EXCEPTION 'Invalid login credentials';
  END IF;

  SELECT array_agg(role::text) INTO v_roles
  FROM public.user_roles
  WHERE user_id = v_user.id;

  -- Generate JWT and REMOVE newlines that pgjwt/base64 may insert
  SELECT replace(
    sign(
      json_build_object(
        'role', 'authenticated',
        'sub', v_user.id,
        'email', v_user.email,
        'full_name', v_user.full_name,
        'roles', COALESCE(v_roles, ARRAY[]::text[]),
        'iat', extract(epoch from now())::integer,
        'exp', extract(epoch from now() + interval '24 hours')::integer
      ),
      current_setting('app.jwt_secret')
    ),
    E'\n', ''
  ) INTO v_token;

  RETURN json_build_object(
    'token', v_token,
    'user_id', v_user.id,
    'email', v_user.email,
    'full_name', v_user.full_name,
    'roles', COALESCE(v_roles, ARRAY[]::text[])
  );
END;
$function$;
