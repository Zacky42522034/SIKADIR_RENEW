import psycopg2
conn = psycopg2.connect('postgresql://postgres:postgres@127.0.0.1:54332/postgres')
conn.autocommit = True
cur = conn.cursor()
cur.execute('ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;')
cur.execute('''
CREATE OR REPLACE FUNCTION delete_user(target_user_id UUID)
RETURNS void AS \$\$
BEGIN
  DELETE FROM auth.users WHERE id = target_user_id;
END;
\$\$ LANGUAGE plpgsql SECURITY DEFINER;
''')
print('Migration complete!')
