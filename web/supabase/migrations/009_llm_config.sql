-- LLM provider configuration per user
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS llm_provider TEXT DEFAULT 'deepseek'
  CHECK (llm_provider IN ('deepseek', 'openai', 'claude', 'groq', 'ollama', 'custom'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS llm_api_key_encrypted TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS llm_model TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS llm_base_url TEXT;
