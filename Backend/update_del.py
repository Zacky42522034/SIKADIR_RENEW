import psycopg2
conn = psycopg2.connect('postgresql://postgres:postgres@127.0.0.1:54332/postgres')
conn.autocommit = True
cur = conn.cursor()
cur.execute("""
CREATE OR REPLACE FUNCTION admin_delete_user(target_user_id UUID)
RETURNS void AS $$
BEGIN
  DELETE FROM attendance WHERE user_id = target_user_id;
  DELETE FROM leave_requests WHERE user_id = target_user_id;
  DELETE FROM profiles WHERE id = target_user_id;
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
""")
print('Updated admin_delete_user to cascade delete')
