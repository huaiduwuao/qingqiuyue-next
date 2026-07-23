# -*- coding: utf-8 -*-
# Backfill author/stats - multi-UPDATE batch per SQL round-trip
import pymysql
import time

def log(msg):
    print(msg, flush=True)

doris = pymysql.connect(
    host='10.9.1.2', port=9030, user='root',
    password='doris123', database='qingqiuyue',
    charset='utf8mb4', connect_timeout=10, read_timeout=120
)
cur = doris.cursor()
log('Connected')

FAKE = [
    ('手工达人小明',   55300689677),
    ('城市记录者',     33512372271),
    ('美食探索家阿杰', 80760957139),
    ('旅行博主叶子',   10000000000),
    ('追番人小白',     10000000001),
    ('影评人老王',     10000000002),
    ('音乐制作人阿轩', 10000000003),
    ('电竞解说员小K',  10000000004),
    ('科技评测官',     10000000005),
    ('健身教练大鹏',   10000000006),
    ('古风琴师云烟',   10000000007),
    ('萌宠博主奶茶',   10000000008),
    ('读书笔记达人',   10000000009),
    ('美妆博主小雅',   10000000010),
    ('户外探险家阿远', 10000000011),
    ('动漫搬运工',     10000000012),
    ('生活vlog记录者',10000000013),
    ('游戏攻略组',     10000000014),
    ('历史研究者',     10000000015),
    ('潮流穿搭师',     10000000016),
]
N = len(FAKE)

log('Fetching IDs...')
cur.execute("SELECT id FROM qingqiuyue.module_content WHERE deleted=0 AND author='' LIMIT 200000")
ids = [r[0] for r in cur.fetchall()]
log(f'Got {len(ids)} IDs')

# Pre-compute
records = []
for cid in ids:
    h = sum(ord(c) for c in str(cid))
    idx = abs(int(str(cid)[-6:])) % N
    uname, uid = FAKE[idx]
    records.append((
        uname, uid,
        (h*137)%88000+1200,
        (h*47)%12000+88,
        (h*13)%2800+12,
        (h*7)%800+5,
        cid
    ))
log(f'Pre-computed {len(records)} records')

# Batch: UPDATES_PER_SQL statements per SQL call
UPDATES_PER_SQL = 50
BATCH = UPDATES_PER_SQL
total = 0
t0 = time.time()
last_log = t0

for i in range(0, len(records), BATCH):
    batch = records[i:i+BATCH]
    parts = []
    params = []
    for r in batch:
        parts.append(
            "UPDATE qingqiuyue.module_content SET author=%s, user_id=%s, "
            "read_num=%s, agree_num=%s, comment_num=%s, share_num=%s WHERE id=%s"
        )
        params.extend(r)
    sql = ';'.join(parts)

    t1 = time.time()
    cur.execute(sql, params)
    doris.commit()
    total += len(batch)
    now = time.time()
    if now - last_log >= 10:
        rate = total / (now - t0)
        eta = (len(records) - total) / rate if rate > 0 else 0
        log(f'  {total}/{len(records)} ({rate:.0f}/s, ETA {eta/60:.0f}min)')
        last_log = now

log(f'Done: {total} rows in {time.time()-t0:.0f}s')

# Verify
cur.execute(
    "SELECT id, author, agree_num, read_num FROM qingqiuyue.module_content "
    "WHERE deleted=0 AND author!='' ORDER BY agree_num DESC LIMIT 5"
)
for r in cur.fetchall():
    log(f'  Verify: author={r[1]}, likes={r[2]}, views={r[3]}')
cur.execute("SELECT COUNT(*) FROM qingqiuyue.module_content WHERE deleted=0 AND author=''")
log(f'Remaining without author: {cur.fetchone()[0]}')

doris.close()
log('ALL DONE')
