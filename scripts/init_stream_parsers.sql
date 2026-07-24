# -*- coding: utf-8 -*-
import pymysql
import json

conn = pymysql.connect(host='10.9.1.2', port=9030, user='root', password='doris123', database='qingqiuyue', charset='utf8mb4')
cur = conn.cursor()

parsers = [
    {
        'id': 1,
        'name': '芒果TV',
        'platform': 'mgtv',
        'url_pattern': r'mgtv\.com/b/(\d+)/(\d+)',
        'api_endpoint': 'https://pcweb.api.mgtv.com/video/streamList',
        'method': 'GET',
        'headers': {"Origin": "https://www.mgtv.com", "Referer": "https://www.mgtv.com/", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
        'params_template': {"playType": "1", "auth_mode": "1", "definitionType": "2", "video_id": "$2", "did": "$random32", "suuid": "$random36", "vf": "av01,h265,h264", "type": "pch5", "_support": "10000000", "src": "mgtv", "abroad": "0", "appVersion": "9.0.4"},
        'response_parse_script': {"streams_expr": "data.stream + data.stream_h265", "url_path": "item.url", "quality_path": "item.standardName", "res_path": "item.videoWidth + 'x' + item.videoHeight", "needpay_path": "item.needPay"},
        'quality_field': 'resolution',
        'quality_sort_key': 'resolution',
        'priority': 10,
        'remark': '芒果TV视频流解析'
    },
    {
        'id': 2,
        'name': 'B站',
        'platform': 'bilibili',
        'url_pattern': r'bilibili\.com/video/(BV[\w]+|av\d+)',
        'api_endpoint': 'https://api.bilibili.com/x/player/playurl',
        'method': 'GET',
        'headers': {"Origin": "https://www.bilibili.com", "Referer": "https://www.bilibili.com/", "User-Agent": "Mozilla/5.0"},
        'params_template': {"avid": "$bv_or_av", "cid": "$cid", "qn": "127", "fnval": "4048", "fnver": "0", "fourk": "1"},
        'response_parse_script': {"streams_expr": "data.dash.video", "url_path": "item.baseUrl", "quality_path": "item.new_description"},
        'quality_field': 'quality',
        'quality_sort_key': 'quality',
        'priority': 20,
        'remark': 'B站视频流解析'
    },
    {
        'id': 3,
        'name': '腾讯视频',
        'platform': 'qq',
        'url_pattern': r'v\.qq\.com.*?vid=([^&]+)',
        'api_endpoint': 'https://vd.l.qq.com/proxyhttp',
        'method': 'POST',
        'headers': {"Origin": "https://v.qq.com", "Referer": "https://v.qq.com/", "Content-Type": "application/json"},
        'params_template': {"vid": "$vid"},
        'response_parse_script': {"streams_expr": "data.vinfo.adlist[0].transcode", "url_path": "item.cdns[0].url", "quality_path": "item.qualitylabel"},
        'quality_field': 'quality',
        'quality_sort_key': 'quality',
        'priority': 30,
        'remark': '腾讯视频流解析'
    },
    {
        'id': 4,
        'name': '网易云音乐',
        'platform': 'music163',
        'url_pattern': r'music\.163\.com/song\?id=(\d+)',
        'api_endpoint': 'https://music.163.com/api/song/enhance/play/url',
        'method': 'GET',
        'headers': {"Referer": "https://music.163.com/", "User-Agent": "Mozilla/5.0"},
        'params_template': {"ids": "[$song_id]", "br": "320000"},
        'response_parse_script': {"streams_expr": "data", "url_path": "item.url", "quality_path": "item.br", "duration_path": "item.time"},
        'quality_field': 'quality',
        'quality_sort_key': 'quality',
        'priority': 40,
        'remark': '网易云音乐音频解析'
    },
    {
        'id': 5,
        'name': '虎牙直播',
        'platform': 'huya',
        'url_pattern': r'huya\.com/(\w+)',
        'api_endpoint': 'https://www.huya.com/live-share/live-detail',
        'method': 'GET',
        'headers': {"Referer": "https://www.huya.com/", "User-Agent": "Mozilla/5.0"},
        'params_template': {"do": "getLiveShareInfo", "roomId": "$room_id"},
        'response_parse_script': {"streams_expr": "data.stream", "url_path": "item.url", "quality_path": "item.name"},
        'quality_field': 'quality',
        'quality_sort_key': 'quality',
        'priority': 50,
        'remark': '虎牙直播流解析'
    }
]

for p in parsers:
    cur.execute('''
    INSERT INTO qingqiuyue.module_stream_parser
    (id, name, platform, url_pattern, api_endpoint, method, headers, params_template, response_parse_script, m3u8_url_field, quality_field, quality_sort_key, priority, remark, deleted)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 0)
    ''', (
        p['id'], p['name'], p['platform'], p['url_pattern'], p['api_endpoint'], p['method'],
        json.dumps(p['headers']), json.dumps(p['params_template']), json.dumps(p['response_parse_script']),
        'url', p['quality_field'], p['quality_sort_key'], p['priority'], p['remark']
    ))

conn.commit()
print(f'Inserted {len(parsers)} parsers')

cur.execute('SELECT id, name, platform, priority FROM qingqiuyue.module_stream_parser WHERE deleted=0 ORDER BY priority')
for r in cur.fetchall():
    print(f'  {r}')

conn.close()
