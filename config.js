// Supabase Configuration
const SUPABASE_URL = 'https://nkoqraqckwggidcnoiha.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rb3FyYXFja3dnZ2lkY25vaWhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTE4NzIsImV4cCI6MjEwNDM2Nzg3Mn0.tB_AdSo9J0ZvJKBfzfDgTVqf1oTkPS3EUFkkY048knk';

if (SUPABASE_URL === 'YOUR_SUPABASE_URL' || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
    console.warn('Supabase credentials missing. Update config.js with valid project URL and anon key.');
}

// Global Supabase Client
window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
