import psycopg2
conn = psycopg2.connect('postgresql://postgres:postgres@127.0.0.1:54332/postgres')
conn.autocommit = True
cur = conn.cursor()

# 1. Drop full_name column
cur.execute('ALTER TABLE profiles DROP COLUMN IF EXISTS full_name;')

# 2. Update RPC function to use username instead of full_name
cur.execute("""
CREATE OR REPLACE FUNCTION admin_update_user(
  target_user_id UUID,
  new_email TEXT,
  new_password TEXT,
  new_name TEXT,
  new_is_active BOOLEAN
)
RETURNS void AS $$
BEGIN
  IF new_email IS NOT NULL AND new_email != '' THEN
    UPDATE auth.users SET email = new_email WHERE id = target_user_id;
    UPDATE profiles SET email = new_email WHERE id = target_user_id;
  END IF;
  
  IF new_password IS NOT NULL AND new_password != '' THEN
    UPDATE auth.users SET encrypted_password = crypt(new_password, gen_salt('bf')) WHERE id = target_user_id;
  END IF;
  
  UPDATE profiles 
  SET 
    username = new_name,
    is_active = new_is_active
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
""")

print('Drop full_name success!')
