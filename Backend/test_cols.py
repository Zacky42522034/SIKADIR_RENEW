import psycopg2
conn = psycopg2.connect('postgresql://postgres:postgres@127.0.0.1:54332/postgres')
cur = conn.cursor()
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='profiles'")
print([col[0] for col in cur.fetchall()])
