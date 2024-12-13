const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = '';
const supabaseKey = '';
const supabaseClient = createClient(supabaseUrl, supabaseKey);

module.exports = supabaseClient;
