CREATE POLICY kyc_objects_insert_own ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kyc' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY kyc_objects_select_own ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'kyc' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY kyc_objects_admin_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'kyc' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY kyc_objects_update_own ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'kyc' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'kyc' AND (storage.foldername(name))[1] = auth.uid()::text);