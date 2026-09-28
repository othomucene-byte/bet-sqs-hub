DROP POLICY IF EXISTS "ai_agent_config_public_read" ON public.ai_agent_config;
CREATE POLICY "ai_agent_config_admin_read" ON public.ai_agent_config FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "ai_run_log_public_read" ON public.ai_run_log;
CREATE POLICY "ai_run_log_admin_read" ON public.ai_run_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "anyone reads affiliate config" ON public.affiliate_config;
CREATE POLICY "signed in read affiliate config" ON public.affiliate_config FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);