import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://urliiaadiajtakttwgul.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVybGlpYWFkaWFqdGFrdHR3Z3VsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxNTkyMjYsImV4cCI6MjA4MzczNTIyNn0.0BK_Kzc8cu2oF11sZvKHHha3e7nLyOj5seTbpjc77zY';

export const supabase = createClient(supabaseUrl, supabaseKey);
