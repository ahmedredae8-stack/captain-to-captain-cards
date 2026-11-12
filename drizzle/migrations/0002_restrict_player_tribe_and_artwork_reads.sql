-- Keep public game profiles available while hiding account identifiers on the base table.
DROP POLICY IF EXISTS players_select ON public.players;
CREATE POLICY players_select_own
  ON public.players
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE OR REPLACE VIEW public.player_public_profiles
  WITH (security_barrier = true)
AS
  SELECT id, name, theme_id, avatar_index, score, last_seen, created_at, avatar_url
  FROM public.players;
REVOKE ALL ON public.player_public_profiles FROM PUBLIC, anon;
GRANT SELECT ON public.player_public_profiles TO authenticated;

-- Let a signed-in player read the roster only for a tribe they belong to.
CREATE OR REPLACE FUNCTION public.can_view_tribe_members(_tribe_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.tribe_members tm
    JOIN public.players p ON p.id = tm.player_id
    WHERE tm.tribe_id = _tribe_id
      AND p.user_id = auth.uid()
  );
$function$;
REVOKE ALL ON FUNCTION public.can_view_tribe_members(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_tribe_members(uuid) TO authenticated;

DROP POLICY IF EXISTS tribe_members_select ON public.tribe_members;
CREATE POLICY tribe_members_select
  ON public.tribe_members
  FOR SELECT
  TO authenticated
  USING (public.can_view_tribe_members(tribe_id));

-- Shared artwork remains visible only when an administrator has published its path.
DROP POLICY IF EXISTS "signed in players view artwork files" ON storage.objects;
CREATE POLICY "signed in players view artwork files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'game-artwork'
    AND EXISTS (
      SELECT 1
      FROM public.artwork_poses ap
      WHERE ap.image_path = storage.objects.name
    )
  );