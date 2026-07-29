import psycopg2
conn = psycopg2.connect('postgresql://postgres:postgres@127.0.0.1:54332/postgres')
cur = conn.cursor()
cur.execute("""
SELECT p.proname, p.prosrc
FROM pg_proc p
JOIN pg_trigger t ON t.tgfoid = p.oid
WHERE p.proname LIKE '%handle_new_user%' OR p.proname LIKE '%auth%';
""")
print(cur.fetchall())
