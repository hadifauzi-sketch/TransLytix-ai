// Copy into ELIMS src/services/aiPrediction.js; adjust import if needed.
import supabase from 'config/supabaseClient';

export async function predictTransformer(transformerId, options = {}) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error('Sign in to run predictions');
  const response = await fetch('/api/ai-predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
    body: JSON.stringify({ transformerId, ...options }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || JSON.stringify(result.detail) || 'Prediction failed');
  return result;
}
