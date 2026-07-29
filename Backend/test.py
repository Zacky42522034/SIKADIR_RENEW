import psycopg2
conn = psycopg2.connect('postgresql://postgres:postgres@127.0.0.1:54332/postgres')
cur = conn.cursor()
cur.execute('SELECT created_at, type FROM attendance')
print('ATT:', cur.fetchall())
cur.execute('SELECT start_date, end_date FROM leave_requests')
print('LEAVES:', cur.fetchall())
