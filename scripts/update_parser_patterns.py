# -*- coding: utf-8 -*-
import pymysql
import json

conn = pymysql.connect(host='10.9.1.2', port=9030, user='root', password='doris123', database='qingqiuyue', charset='utf8mb4')
cur = conn.cursor()

# 更新各平台 URL 匹配正则（支持带 www. 和不带的情况）
updates = [
    (1, '(mgtv\\.com|www\\.mgtv\\.com)/b/(\\d+)/(\\d+)'),
    (2, '(bilibili\\.com|www\\.bilibili\\.com)/video/(BV[\\w]+|av\\d+)'),
    (3, '(v\\.qq\\.com|www\\.v\\.qq\\.com).*?vid=([^&]+)'),
    (4, '(music\\.163\\.com|www\\.music\\.163\\.com)/song\\?id=(\\d+)'),
    (5, '(huya\\.com|www\\.huya\\.com)/(\\w+)'),
]

for id, pattern in updates:
    cur.execute('UPDATE qingqiuyue.module_stream_parser SET url_pattern=%s WHERE id=%s AND deleted=0', (pattern, id))

conn.commit()
print('Updated patterns')

# 验证
cur.execute('SELECT id, platform, url_pattern FROM qingqiuyue.module_stream_parser WHERE deleted=0 ORDER BY id')
for r in cur.fetchall():
    print(f'ID={r[0]} platform={r[1]} pattern={r[2][:50]}...')

conn.close()
