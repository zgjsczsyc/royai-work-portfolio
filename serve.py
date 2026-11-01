"""启动作品集本地展示；构建产物缺失时给出明确步骤。"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading

ROOT = Path(__file__).resolve().parent
SITES = [
    (8765, 'showcase'),
    (8766, 'projects/log-analysis'),
    (8767, 'projects/operations-dashboard'),
    (8768, 'projects/notification-center/dist'),
    (8769, 'projects/home-model/dist'),
]


def main():
    for _, relative in SITES:
        if not (ROOT / relative / 'index.html').is_file():
            project = relative.removesuffix('/dist')
            raise SystemExit(f'缺少构建文件：{relative}\n请先进入 {project}，执行 npm ci 和 npm run build。')
    servers = []
    try:
        for port, relative in SITES:
            handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT / relative))
            server = ThreadingHTTPServer(('127.0.0.1', port), handler)
            servers.append(server)
            threading.Thread(target=server.serve_forever, daemon=True).start()
        print('作品集入口：http://127.0.0.1:8765\nCtrl+C 停止全部展示服务。', flush=True)
        threading.Event().wait()
    except OSError as error:
        raise SystemExit(f'本地端口被占用或不可用：{error}。请停止之前的作品集服务后重试。')
    except KeyboardInterrupt:
        pass
    finally:
        for server in servers:
            server.shutdown()
            server.server_close()


if __name__ == '__main__':
    main()
