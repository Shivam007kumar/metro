import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

// TODO: Replace with your actual Supabase Project URL and Anon Key
// Hardcoded for debugging to skip dotenv issues
const SUPABASE_URL = 'https://rsgbyvixglcoxvujzoab.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzZ2J5dml4Z2xjb3h2dWp6b2FiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MDIyMjksImV4cCI6MjA4NjE3ODIyOX0.4tKo3DAeXJb17ki4FTpYy6IjwK2HD1wxTUBC-SlGHkM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});
