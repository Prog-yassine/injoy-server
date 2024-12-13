const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bnplivusijobfbodvuxy.supabase.co'; // Remplacez par votre URL Supabase
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJucGxpdnVzaWpvYmZib2R2dXh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDY5Njk3MzEsImV4cCI6MjAyMjU0NTczMX0.VX0ZmE0Cva4GwpkyfcHgkFUwzH_edH9ytEp2erfctLk'; // Remplacez par votre clé Supabase
const supabaseClient = createClient(supabaseUrl, supabaseKey); // Pas besoin d'exporter

module.exports = supabaseClient; // Exportez le client Supabase
