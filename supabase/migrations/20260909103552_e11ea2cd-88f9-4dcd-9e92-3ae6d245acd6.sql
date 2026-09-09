REVOKE ALL ON FUNCTION public.ai_job_acquire(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ai_job_release(text, boolean, text, boolean, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ai_job_acquire(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.ai_job_release(text, boolean, text, boolean, integer) TO service_role;