DROP POLICY IF EXISTS "signed in players view artwork files" ON storage.objects;
CREATE POLICY "signed in players view artwork files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'game-artwork'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid()::text)
      OR EXISTS (
        SELECT 1
        FROM public.artwork_poses ap
        WHERE ap.image_path = storage.objects.name
      )
    )
  );