"""本地展示数据处理与模拟写回，不调用模型，不模拟模型审批意见。"""
import json
from pathlib import Path
import runpy
import threading

import requests
import yaml


def main():
    root = Path(__file__).resolve().parent
    dsl = yaml.safe_load((root / 'workflow.yml').read_text())
    functions = {}
    for node in dsl['workflow']['graph']['nodes']:
        if node['data']['type'] == 'code':
            namespace = {}
            exec(compile(node['data']['code'], node['data']['title'], 'exec'), namespace)
            functions[node['data']['title']] = namespace['main']

    mock = runpy.run_path(str(root / 'mock_server.py'), run_name='local_demo')
    mock['Handler'].log_message = lambda *args: None
    server = mock['create_server'](port=0)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f'http://127.0.0.1:{server.server_port}/mock'
    try:
        print('本地链路演示：所有数据虚构；没有调用 LLM。\n')
        for system, flow, wid in [('OA', 'LEAVE', '10086'), ('BPM', 'PURCHASE', '20099')]:
            config = functions['流程编码转换'](arg1=flow, workflow_id=wid, system_code=system)
            rules = functions['规则数据获取'](flowNum=config['workfolwRule_code'], base_url=base)
            common = dict(processed_fields=rules['processedFields'], file_rules=rules['fileRulse'], base_url=base)
            if system == 'OA':
                response = requests.post(base + '/oa/api/workflowService/getWorkflowInfo/process/v2',
                                         data=config['oa_body'], headers={'Content-Type': 'application/json'}, timeout=5)
                response.raise_for_status()
                result = functions['OA数据处理'](workflow_data=response.text, **common)
            else:
                data = functions['调用BPM接口获取流程数据'](fdId=wid, base_url=base)
                result = functions['BPM数据处理'](dynamic_props=data['dynamicProps'], attachment=data['attachment'], **common)
            print(f'[{system} / {flow}] 整理后将提供给模型的表单')
            print(json.dumps(json.loads(result['process_data']), ensure_ascii=False, indent=2))
            files = json.loads(result['file_data'])
            print('附件状态：', '、'.join(f"{f['name']}={f['status']}" for f in files['files']))
            if system == 'BPM':
                summary = '[本地链路测试文本，非 AI 生成] ' + result['process_data']
                written = functions['回调BPM写入AI总结内容'](workflow_id=wid, workflow_code=flow,
                              task_id='demo-task', answer=summary, base_url=base)
                stored = requests.get(base + '/bpm/summary/' + wid, timeout=5).json()
                if stored.get('data', {}).get('answer') != summary:
                    raise RuntimeError('模拟写回内容核验失败')
                print(written['result'])
                print('已重新读取并核对模拟写回内容。')
            print()
        try:
            functions['调用BPM接口获取流程数据'](fdId='99999', base_url=base)
        except ValueError:
            print('[异常演示] 不存在的 BPM 流程已被代码拒绝；实际 Dify 失败分支待实机验收。')
        else:
            raise RuntimeError('异常示例未被正确拒绝')
        print('\n本地链路演示完成。LLM 输出及 Dify 运行请按 README 单独验证。')
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


if __name__ == '__main__':
    main()
