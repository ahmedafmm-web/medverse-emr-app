import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ljtserbmtfmqzdsxszbb.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqdHNlcmJtdGZtcXpkc3hzemJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNjE0ODEsImV4cCI6MjEwMDkzNzQ4MX0.18_yD8XvUFZY71mqm-Rw3-fl102yFVdFcoOJEl-clGo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});
