# -*- coding: utf-8 -*-
import pymysql
import time

def log(msg): print(msg, flush=True)
d = pymysql.connect(host='10.9.1.2', port=9030, user='root', password='doris123', database='qingqiuyue', charset='utf8mb4', connect_timeout=10, read_timeout=120)
cur = d.cursor()
log('Connected')

# Count
cur.execute("SELECT COUNT(*) FROM qingqiuyue.module_content WHERE deleted=0 AND content_type='NOVEL' AND cover_url LIKE '%%hdslb%%'")
remaining = cur.fetchone()[0]
log(f'Will fix: {remaining} NOVEL -> VIDEO')
if remaining == 0:
    log('Nothing to fix'); d.close(); exit(0)

BATCH = 1000
total = 0
t0 = time.time()
last_id = 0

while total < remaining:
    # SELECT batch
    cur.execute(
        "SELECT id FROM qingqiuyue.module_content "
        "WHERE deleted=0 AND content_type='NOVEL' AND cover_url LIKE '%%hdslb%%' AND id > %s "
        "ORDER BY id LIMIT %s",
        (last_id, BATCH)
    )
    rows = cur.fetchall()
    if not rows: break
    last_id = rows[-1][0]

    ids = [r[0] for r in rows]
    ph = ','.join(['%s'] * len(ids))

    # UPDATE using tuple IN - each id is a param
    cur.execute(f"UPDATE qingqiuyue.module_content SET content_type='VIDEO' WHERE id IN ({ph})", tuple(ids))
    d.commit()
    total += len(ids)
    if total % 5000 == 0:
        log(f'  Fixed {total}/{remaining} ({time.time()-t0:.0f}s)')

log(f'Done: {total} rows in {time.time()-t0:.0f}s')

# Verify
cur.execute("SELECT COUNT(*) FROM qingqiuyue.module_content WHERE deleted=0 AND content_type='NOVEL'")
log(f'Reamaining NOVEL: {cur.fetchone()[0]}')
cur.execute("SELECT COUNT(*) FROM qingqiuyue.module_content WHERE deleted=0 AND content_type='VIDEO'")
log(f'VIDEO: {cur.fetchone()[0]}')
d.close()
log('ALL DONE')
