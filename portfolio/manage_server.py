# -*- coding: utf-8 -*-
"""
WLi Portfolio Manager - 首页内容管理服务
用法：双击运行，或 python manage_server.py
管理界面: http://localhost:8090/manager.html
"""
import sys
import os
import io
import json
import base64
import socket
import threading
import webbrowser
import time
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(line_buffering=True)
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(line_buffering=True)

PORT = 8090
PORTFOLIO_DIR = os.path.dirname(os.path.abspath(__file__))
WORKS_DIR = os.path.join(PORTFOLIO_DIR, 'works')
IMAGES_DIR = os.path.join(WORKS_DIR, 'images')
CARDS_DIR = os.path.join(IMAGES_DIR, 'cards')
CONFIG_FILE = os.path.join(WORKS_DIR, 'config.json')

MAX_BODY = 500 * 1024 * 1024  # 500MB，视频上限

ALLOWED_EXT = {
    'jpg': 'image', 'jpeg': 'image', 'png': 'image', 'webp': 'image',
    'gif': 'image', 'avif': 'image',
    'mp4': 'video', 'webm': 'video', 'mov': 'video', 'm4v': 'video',
}

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}

# 内置案例元数据种子（与作品集 bundle 原始数据一致，用于首次生成配置）
DEFAULT_CARDS = [
    {"id": "police", "tag": "G 端政务 · 公安数字化", "tagEn": "Gov / Public Security",
     "name": "数智派出所", "nameEn": "Smart Police Station",
     "desc": "浙江省、杭州市重点公安数字化改革工程，覆盖 PC 监管端、移动端、可视化大屏全链路 UI 设计。",
     "descEn": "A key public-security digitalization program covering desktop, mobile and large-screen UI across the province.",
     "cover": "./works/images/cards/1.jpg", "span": "wide"},
    {"id": "sinotrans", "tag": "B 端企业 · 物流运营", "tagEn": "Enterprise / Logistics",
     "name": "中外运跨境平台", "nameEn": "Sinotrans Cross-border",
     "desc": "面向跨境海外仓储的一站式运营管理平台，覆盖仓储、出库、物流、订单全流程业务。",
     "descEn": "One-stop operations platform for cross-border warehousing covering storage, outbound, logistics and orders.",
     "cover": "./works/images/cards/2.jpg", "span": ""},
    {"id": "haidian", "tag": "G 端政务 · 出租房管控", "tagEn": "Gov / Rental Control",
     "name": "北京海淀出租房管控", "nameEn": "Haidian Rental Control",
     "desc": "公安出租房管理全端设计：群众自主申报 C 端小程序、民警 B 端监管后台、数据可视化大屏。",
     "descEn": "Full-stack rental management: citizen mini-program, officer backend console and data screens.",
     "cover": "./works/images/cards/3.jpg", "span": ""},
    {"id": "campus", "tag": "G 端政务 · 校园安防", "tagEn": "Gov / Campus Safety",
     "name": "永康校园智慧治安", "nameEn": "Yongkang Campus Safety",
     "desc": "校园智慧治安监管项目：护苗智管 C 端小程序、校园 PC 监管端、安防可视化大屏。",
     "descEn": "Campus safety supervision: guardian mini-program, PC console and security visualization screens.",
     "cover": "./works/images/cards/4.jpg", "span": ""},
    {"id": "xinjiang", "tag": "G 端政务 · 民生保障", "tagEn": "Gov / Public Housing",
     "name": "新疆公租房监管平台", "nameEn": "Xinjiang Public Housing",
     "desc": "民生类政务平台设计，严格遵循政务极简、严谨的视觉规范。",
     "descEn": "Public-housing supervision platform designed under strict, minimal government visual standards.",
     "cover": "./works/images/cards/5.jpg", "span": ""},
]

HERO_FILENAME = 'BG_compressed'


def ensure_dirs():
    for d in (WORKS_DIR, IMAGES_DIR, CARDS_DIR):
        os.makedirs(d, exist_ok=True)


def scan_hero_files():
    """扫描首屏媒体目录,返回 (视频列表, 图片列表) 已排序"""
    if not os.path.isdir(IMAGES_DIR):
        return [], []
    try:
        files = os.listdir(IMAGES_DIR)
    except OSError:
        files = []
    videos, images = [], []
    for f in files:
        ext = os.path.splitext(f)[1].lstrip('.').lower()
        if f.startswith(HERO_FILENAME + '.') and ext in ALLOWED_EXT:
            (videos if ALLOWED_EXT[ext] == 'video' else images).append(f)
    return sorted(videos), sorted(images)


def add_poster(hero, images):
    """视频模式下，若存在同名/同目录图片则附加为 poster（视频未加载时的静态首帧兜底）"""
    if hero.get('type') == 'video' and images:
        base_name = os.path.splitext(os.path.basename(hero['src']))[0]
        poster = next((f for f in images if os.path.splitext(f)[0] == base_name), None)
        if poster is None:
            poster = images[0]
        hero['poster'] = './works/images/' + poster
    return hero


def resolve_hero(cfg):
    """根据 config.hero.type 解析生效的首屏媒体;该类型文件缺失时自动回退到另一类型"""
    h = cfg.get('hero') or {}
    want = h.get('type') if h.get('type') in ('video', 'image') else 'image'
    videos, images = scan_hero_files()
    pool = videos if want == 'video' else images
    if pool:
        return add_poster({'type': want, 'src': './works/images/' + pool[0]}, images)
    pool = images if want == 'video' else videos
    if pool:
        return {'type': 'image' if want == 'video' else 'video', 'src': './works/images/' + pool[0]}
    return {'type': 'image', 'src': ''}


def detect_hero():
    """探测首屏媒体：优先视频，其次图片（用于首次生成配置）"""
    videos, images = scan_hero_files()
    pick = videos or images
    if not pick:
        return {'type': 'image', 'src': ''}
    ext = os.path.splitext(pick[0])[1].lstrip('.').lower()
    hero = {'type': ALLOWED_EXT[ext], 'src': './works/images/' + pick[0]}
    return add_poster(hero, images)


def file_exists(cover_path):
    """根据 cover 路径（如 ./works/images/cards/1.jpg）判断文件是否存在"""
    if not cover_path:
        return False
    rel = cover_path.lstrip('./').replace('/', os.sep)
    return os.path.isfile(os.path.join(PORTFOLIO_DIR, rel))


def load_config():
    if os.path.isfile(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if isinstance(data, dict) and 'cards' in data:
                data['hero'] = resolve_hero(data)
                return data
        except (json.JSONDecodeError, OSError):
            pass
    return build_default_config()


def build_default_config():
    ensure_dirs()
    hero = detect_hero()
    cards = []
    for i, c in enumerate(DEFAULT_CARDS):
        cards.append({**c, 'enabled': file_exists(c['cover']), 'order': i})
    return {'hero': hero, 'cards': cards}


def save_config(data):
    ensure_dirs()
    # 保存前统一规范化 hero：保证 type 与 src 一致（作品集页面直接读取该文件）
    if isinstance(data, dict) and 'cards' in data:
        data['hero'] = resolve_hero(data)
    tmp = CONFIG_FILE + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, CONFIG_FILE)


def read_json_body(handler):
    length = int(handler.headers.get('Content-Length', 0))
    if length <= 0 or length > MAX_BODY:
        raise ValueError('请求体过大或为空')
    raw = handler.rfile.read(length)
    try:
        return json.loads(raw.decode('utf-8'))
    except Exception as e:
        raise ValueError('JSON 解析失败: %s' % e)


def safe_name(name):
    """仅保留安全文件名"""
    name = os.path.basename(name or '')
    name = re.sub(r'[^A-Za-z0-9._-]', '_', name)
    return name[:80]


def compress_to_jpg(data, quality=90, max_side=2560):
    """将图片字节压缩为 JPEG(质量 90)并返回压缩后的字节;解析失败返回 None"""
    try:
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(data))
        img = img.convert('RGB')
        if max(img.size) > max_side:
            img.thumbnail((max_side, max_side), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, 'JPEG', quality=quality, optimize=True)
        return buf.getvalue()
    except Exception:
        return None


class ManagerHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PORTFOLIO_DIR, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

    def log_message(self, fmt, *args):
        print('  [%s] %s' % (self.log_date_time_string(), args[0]))

    def _json(self, data, status=200):
        try:
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            for k, v in CORS_HEADERS.items():
                self.send_header(k, v)
            self.end_headers()
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            pass

    def _ok(self, **kw):
        self._json({'status': 'ok', **kw})

    def _err(self, msg, status=400):
        self._json({'status': 'error', 'message': msg}, status)

    def do_OPTIONS(self):
        try:
            self.send_response(204)
            for k, v in CORS_HEADERS.items():
                self.send_header(k, v)
            self.end_headers()
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            pass

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == '/api/health':
            self._json({'status': 'ok'})
            return
        if parsed.path == '/api/config':
            self._json(load_config())
            return
        if parsed.path == '/api/cards/files':
            self._json({'files': sorted(os.listdir(CARDS_DIR)) if os.path.isdir(CARDS_DIR) else []})
            return
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        try:
            if parsed.path == '/api/config':
                data = read_json_body(self)
                cfg = load_config()
                if 'hero' in data:
                    cfg['hero'] = data['hero']
                if 'cards' in data:
                    cfg['cards'] = data['cards']
                save_config(cfg)
                self._ok()
                return

            if parsed.path == '/api/hero/type':
                body = read_json_body(self)
                t = str(body.get('type', '')).lower()
                if t not in ('video', 'image'):
                    raise ValueError('类型只能是 video 或 image')
                cfg = load_config()
                cfg['hero'] = {'type': t, 'src': cfg.get('hero', {}).get('src', '')}
                save_config(cfg)
                self._ok(hero=resolve_hero(cfg))
                return

            if parsed.path == '/api/upload/hero':
                body = read_json_body(self)
                self._upload_hero(body)
                return

            if parsed.path == '/api/upload/card':
                body = read_json_body(self)
                self._upload_card(body)
                return

            if parsed.path == '/api/delete/media':
                body = read_json_body(self)
                self._delete_media(body)
                return

            self._err('未知接口', 404)
        except ValueError as e:
            self._err(str(e))
        except Exception as e:
            self._err('服务器错误: %s' % e, 500)

    # ---------- 业务逻辑 ----------

    def _decode_file(self, body):
        ext = str(body.get('ext', '')).lstrip('.').lower()
        if ext not in ALLOWED_EXT:
            raise ValueError('不支持的文件类型: %s' % ext)
        b64 = body.get('dataBase64', '')
        if not b64:
            raise ValueError('缺少文件内容')
        # 兼容 dataURL 前缀
        if ',' in b64 and b64.strip().startswith('data:'):
            b64 = b64.split(',', 1)[1]
        try:
            data = base64.b64decode(b64)
        except Exception:
            raise ValueError('文件内容解码失败')
        if not data:
            raise ValueError('文件内容为空')
        return data, ext

    def _upload_hero(self, body):
        data, ext = self._decode_file(body)
        kind = ALLOWED_EXT[ext]
        if kind == 'image':
            # 背景图片统一压缩为 JPEG(质量 90)，原图不保留
            compressed = compress_to_jpg(data)
            if compressed is None:
                raise ValueError('图片压缩失败，请上传有效的图片文件')
            data, ext = compressed, 'jpg'
        ensure_dirs()
        # 仅清理同类型旧文件（视频/图片各自独立保存，可同时存在供开关切换）
        try:
            for f in os.listdir(IMAGES_DIR):
                fext = os.path.splitext(f)[1].lstrip('.').lower()
                if f.startswith(HERO_FILENAME + '.') and fext in ALLOWED_EXT and ALLOWED_EXT[fext] == kind:
                    os.remove(os.path.join(IMAGES_DIR, f))
        except OSError:
            pass
        target = os.path.join(IMAGES_DIR, HERO_FILENAME + '.' + ext)
        with open(target, 'wb') as f:
            f.write(data)
        cfg = load_config()
        cfg['hero'] = {'type': kind, 'src': './works/images/' + HERO_FILENAME + '.' + ext}
        save_config(cfg)
        self._ok(hero=resolve_hero(cfg))

    def _upload_card(self, body):
        data, ext = self._decode_file(body)
        if ALLOWED_EXT[ext] == 'image':
            # 案例封面统一压缩为 JPEG(质量 90)，原图不保留
            compressed = compress_to_jpg(data)
            if compressed is None:
                raise ValueError('图片压缩失败，请上传有效的图片文件')
            data, ext = compressed, 'jpg'
        card_id = safe_name(str(body.get('id', '')))
        # 判断是否为替换：该卡片已有 cover 文件
        cfg = load_config()
        card = next((c for c in cfg['cards'] if c.get('id') == card_id), None)
        if card and card.get('cover') and file_exists(card['cover']):
            old_rel = card['cover'].lstrip('./').replace('/', os.sep)
            old_file = os.path.basename(old_rel)
            filename = os.path.splitext(old_file)[0] + '.jpg'
            # 原图若为非 jpg 格式，替换后清掉
            if old_file != filename:
                try:
                    os.remove(os.path.join(PORTFOLIO_DIR, old_rel))
                except OSError:
                    pass
        else:
            filename = 'card-%s-%d.jpg' % (card_id or 'new', int(time.time() * 1000))
        ensure_dirs()
        target = os.path.join(CARDS_DIR, filename)
        with open(target, 'wb') as f:
            f.write(data)
        cover = './works/images/cards/' + filename
        if card is not None:
            card['cover'] = cover
        else:
            # 首屏案例只维护图片：无需名称/标签/描述等信息
            cfg['cards'].append({
                'id': card_id or ('item-%d' % (len(cfg['cards']) + 1)),
                'cover': cover,
                'enabled': True,
            })
        save_config(cfg)
        self._ok(cards=cfg['cards'])

    def _delete_media(self, body):
        mtype = body.get('type')
        cfg = load_config()
        if mtype == 'hero':
            h = cfg.get('hero') or {}
            kind = h.get('type') if h.get('type') in ('video', 'image') else None
            if kind:
                try:
                    for f in os.listdir(IMAGES_DIR):
                        fext = os.path.splitext(f)[1].lstrip('.').lower()
                        if f.startswith(HERO_FILENAME + '.') and fext in ALLOWED_EXT and ALLOWED_EXT[fext] == kind:
                            os.remove(os.path.join(IMAGES_DIR, f))
                except OSError:
                    pass
            # 删除后若另一类型媒体仍存在，自动切换过去
            cfg['hero'] = resolve_hero(cfg)
            save_config(cfg)
            self._ok(hero=cfg['hero'])
            return
        if mtype == 'card':
            card_id = safe_name(str(body.get('id', '')))
            card = next((c for c in cfg['cards'] if c.get('id') == card_id), None)
            if card:
                if card.get('cover') and file_exists(card['cover']):
                    rel = card['cover'].lstrip('./').replace('/', os.sep)
                    try:
                        os.remove(os.path.join(PORTFOLIO_DIR, rel))
                    except OSError:
                        pass
                cfg['cards'] = [c for c in cfg['cards'] if c.get('id') != card_id]
            save_config(cfg)
            self._ok(cards=cfg['cards'])
            return
        self._err('未知删除类型', 400)


def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'


def main():
    ensure_dirs()
    # 首次启动生成配置
    if not os.path.isfile(CONFIG_FILE):
        save_config(build_default_config())

    server = ThreadingHTTPServer(('0.0.0.0', PORT), ManagerHandler)
    ip = get_local_ip()
    print()
    print('=' * 52)
    print('  WLi Portfolio Manager - 首页内容管理服务')
    print('=' * 52)
    print('  管理界面: http://localhost:%d/manager.html' % PORT)
    print('  局域网:   http://%s:%d/manager.html' % (ip, PORT))
    print('  作品集:   http://localhost:%d/index.html' % PORT)
    print('  按 Ctrl+C 停止服务')
    print('=' * 52)
    print()
    threading.Timer(1.0, lambda: webbrowser.open('http://localhost:%d/manager.html' % PORT)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n  服务已停止。')
        server.server_close()


if __name__ == '__main__':
    main()
