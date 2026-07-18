import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cqqmypjebjqcvhgdervm.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxcW15cGplYmpxY3ZoZ2RlcnZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1OTU2MDQsImV4cCI6MjA5MjE3MTYwNH0.kiVJwMx7ms_dwgTA9D_5pDAUybPzl5H7kTQjv643eLE'
const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
  const { data, error } = await supabase.from('doc_expenses').select('*').limit(1)
  console.log('Error:', error)
  console.log('Data:', data)
}
check()
