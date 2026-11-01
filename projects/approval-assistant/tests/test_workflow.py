"""执行 DSL 内的真实代码，连接临时本地 Mock；不调用模型或任何业务系统。"""
import ast
import base64
import copy
import hashlib
import hmac
import json
from pathlib import Path
import runpy
import threading
import time
import unittest
from unittest.mock import patch

import requests
import yaml


ROOT = Path(__file__).resolve().parents[1]
DSL = yaml.safe_load((ROOT / 'workflow.yml').read_text())
NODES = {n['data']['title']: n for n in DSL['workflow']['graph']['nodes']}
SCOPES = {}
for title, node in NODES.items():
    if node['data']['type'] == 'code':
        SCOPES[title] = {}
        exec(compile(node['data']['code'], title, 'exec'), SCOPES[title])


def call(title, **kwargs):
    result = SCOPES[title]['main'](**kwargs)
    expected = NODES[title]['data']['outputs']
    types = {'string': str, 'object': dict, 'array[object]': list}
    if set(result) != set(expected):
        raise AssertionError(f'{title}: 返回字段不满足 DSL 声明')
    for name, value in result.items():
        if not isinstance(value, types[expected[name]['type']]):
            raise AssertionError(f'{title}: {name} 类型不匹配')
    return result


def field(label, path, kind='text', required=True):
    return {'label': label, 'path': path, 'kind': kind, 'required': required}


def jwt(claims=None, secret=b'demo-jwt-secret'):
    now = int(time.time())
    body = claims if claims is not None else {'iss': 'DEMO-KEY-0001', 'iat': now, 'nbf': now, 'exp': now + 60}
    encode = lambda value: base64.urlsafe_b64encode(value).decode().rstrip('=')
    signing = encode(json.dumps({'alg': 'HS256'}).encode()) + '.' + encode(json.dumps(body).encode())
    signature = hmac.new(secret, signing.encode(), hashlib.sha256).digest()
    return 'Bearer ' + signing + '.' + encode(signature)


class WorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mock = runpy.run_path(str(ROOT / 'mock_server.py'), run_name='test_mock')
        cls.mock['Handler'].log_message = lambda *args: None
        cls.server = cls.mock['create_server'](port=0)
        cls.base = f'http://127.0.0.1:{cls.server.server_port}/mock'
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def rules(self, code='RULE-1003'):
        return call('规则数据获取', flowNum=code, base_url=self.base)

    def process(self, form, fields, attachments=None, required_files=None):
        return call('BPM数据处理', dynamic_props=form, attachment=attachments or [],
                    processed_fields={'fields': fields},
                    file_rules=json.dumps({'instructions': '只核对提供的信息', 'required_files': required_files or []}),
                    base_url=self.base)

    def test_oa_happy_path(self):
        config = self.rules('RULE-1001')
        body = call('流程编码转换', arg1='LEAVE', workflow_id='10086', system_code='OA')['oa_body']
        response = requests.post(self.base + '/oa/api/workflowService/getWorkflowInfo/process/v2',
                                 data=body, headers={'Content-Type': 'application/json'}, timeout=3)
        result = call('OA数据处理', workflow_data=response.text, processed_fields=config['processedFields'],
                      file_rules=config['fileRulse'], base_url=self.base)
        form = json.loads(result['process_data'])
        self.assertEqual(form['申请人'], '张三')
        self.assertEqual(form['开始时间'], '2026-11-05T09:00+08:00')
        self.assertFalse(json.loads(result['file_data'])['incomplete'])

    def test_bpm_happy_path_and_callback_storage(self):
        config = self.rules()
        data = call('调用BPM接口获取流程数据', fdId='20099', base_url=self.base)
        result = call('BPM数据处理', dynamic_props=data['dynamicProps'], attachment=data['attachment'],
                      processed_fields=config['processedFields'], file_rules=config['fileRulse'], base_url=self.base)
        form = json.loads(result['process_data'])
        self.assertEqual(form['总金额'], 196000)
        self.assertIn('一致', form['金额核对'])
        summary = '自动化测试文本；不是模型生成的审批建议'
        written = call('回调BPM写入AI总结内容', workflow_id='20099', workflow_code='PURCHASE',
                       task_id='test-task', answer=summary, base_url=self.base)
        self.assertIn('写回成功', written['result'])
        stored = requests.get(self.base + '/bpm/summary/20099', timeout=3).json()['data']
        self.assertEqual(stored['answer'], summary)
        self.assertEqual(stored['task_id'], 'test-task')

    def test_missing_bpm_raises_for_own_failure_branch(self):
        with self.assertRaises(ValueError):
            call('调用BPM接口获取流程数据', fdId='99999', base_url=self.base)

    def test_unknown_rules_stop(self):
        with self.assertRaises(ValueError):
            self.rules('UNKNOWN')

    def test_rule_service_down_stops(self):
        with patch('requests.post', side_effect=requests.ConnectionError('offline')):
            with self.assertRaises(requests.ConnectionError):
                self.rules()

    def test_blank_rules_stop(self):
        rules = self.mock['RULES']['RULE-1003']
        with patch.dict(rules, {'flowRulse': ''}):
            with self.assertRaises(ValueError):
                self.rules()

    def test_invalid_or_empty_field_mapping_stops(self):
        convert = SCOPES['规则数据获取']['process_field_list']
        for rows in ([], [{'cnField': '申请人', 'enField': ''}, {'cnField': '总金额', 'enField': 'amount'}],
                     [{'cnField': '总金额', 'enField': 'amount'}, {'cnField': '总金额', 'enField': 'other'}]):
            with self.subTest(rows=rows), self.assertRaises(ValueError):
                convert(rows)

    def test_nested_and_flat_names(self):
        for form in ({'person': {'fdName': '测试申请人'}}, {'person.fdName': '测试申请人'},
                     {'person': {'value': {'fdName': '测试申请人'}}}):
            with self.subTest(form=form):
                out = self.process(form, [field('申请人', 'person.fdName')])
                self.assertEqual(json.loads(out['process_data'])['申请人'], '测试申请人')

    def test_wrapper_name_and_value(self):
        out = self.process({'name': {'fdName': '测试申请人'}, 'amount': {'value': 0}},
                           [field('申请人', 'name'), field('金额', 'amount', 'number')])
        self.assertEqual(json.loads(out['process_data']), {'申请人': '测试申请人', '金额': 0})

    def test_large_amount_not_date(self):
        out = self.process({'amount': 2000000000}, [field('总金额', 'amount', 'number')])
        self.assertEqual(json.loads(out['process_data'])['总金额'], 2000000000)

    def test_timestamp_uses_explicit_timezone(self):
        # UTC epoch + 8 小时，与测试机器或 Docker 的 TZ 无关。
        out = self.process({'date': 0}, [field('日期', 'date', 'datetime_ms')])
        self.assertEqual(json.loads(out['process_data'])['日期'], '1970-01-01T08:00+08:00')

    def test_bad_number_and_timestamp_rejected(self):
        for value, kind in [('not-a-date', 'datetime_ms'), ('NaN', 'number'), ('Infinity', 'number')]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                self.process({'value': value}, [field('字段', 'value', kind)])

    def test_empty_and_missing_required_form_fields_stop(self):
        for form in ({}, {'other': 1}, {'amount': ''}):
            with self.subTest(form=form), self.assertRaises(ValueError):
                self.process(form, [field('金额', 'amount', 'number')])

    def test_optional_field_marked_missing(self):
        out = self.process({'other': 1}, [field('备注', 'note', required=False)])
        self.assertEqual(json.loads(out['process_data'])['备注'], '未提供')

    def test_oa_error_payload_and_empty_form_stop(self):
        config = self.rules('RULE-1001')
        for payload in ({'success': False, 'data': {'formData': {'x': 1}}},
                        {'success': True, 'data': {'processName': 'title', 'formData': {}}}):
            with self.subTest(payload=payload), self.assertRaises(ValueError):
                call('OA数据处理', workflow_data=json.dumps(payload), processed_fields=config['processedFields'],
                     file_rules=config['fileRulse'], base_url=self.base)

    def test_required_attachment_missing_or_unreadable_stops(self):
        for attachments in ([], [{'id': 'MISSING', 'name': '必需.pdf'}]):
            with self.subTest(attachments=attachments), self.assertRaises(ValueError):
                self.process({'name': '测试'}, [field('申请人', 'name')], attachments, ['必需.pdf'])

    def test_optional_attachment_failure_visible_to_model(self):
        out = self.process({'name': '测试'}, [field('申请人', 'name')],
                           [{'id': 'ATT-001', 'name': '请假审批单.pdf'}, {'id': 'MISSING', 'name': '补充.pdf'}],
                           ['请假审批单.pdf'])
        data = json.loads(out['file_data'])
        self.assertTrue(data['incomplete'])
        self.assertEqual(data['files'][1]['status'], 'failed')
        self.assertIn('补充.pdf', out['err_msg'])

    def test_attachment_instructions_reach_service(self):
        out = self.process({'name': '测试'}, [field('申请人', 'name')], [{'id': 'ATT-001', 'name': '请假审批单.pdf'}])
        parsed = json.loads(out['file_data'])['files'][0]['content']
        self.assertEqual(parsed['received_instructions'], '只核对提供的信息')
        self.assertTrue(parsed['simulated'])

    def test_no_attachments_is_distinct_from_parse_failure(self):
        out = self.process({'name': '测试'}, [field('申请人', 'name')])
        self.assertEqual(json.loads(out['file_data'])['files'], [])
        self.assertFalse(json.loads(out['file_data'])['incomplete'])

    def test_purchase_arithmetic_rejects_inconsistency(self):
        for kind in ('subtotal', 'total'):
            form = copy.deepcopy(self.mock['BPM_DATA']['20099']['dynamicProps'])
            if kind == 'subtotal':
                form['detail_items'][0]['subtotal'] += 1
            else:
                form['total_amount'] += 1
            with self.subTest(kind=kind), self.assertRaises(ValueError):
                self.process(form, [field('总金额', 'total_amount', 'number')])

    def test_decimal_money_has_no_float_rounding_error(self):
        form = {'detail_items': [{'qty': 3, 'price': '0.10', 'subtotal': '0.30'}], 'total_amount': '0.30'}
        out = self.process(form, [field('总金额', 'total_amount', 'number')])
        self.assertIn('一致', json.loads(out['process_data'])['金额核对'])

    def test_oa_id_is_json_serialized(self):
        for wid in ('10086', '000123', 'OA-10086', 'ID"\\\n'):
            with self.subTest(wid=wid):
                out = call('流程编码转换', arg1='LEAVE', workflow_id=wid, system_code='OA')
                self.assertEqual(json.loads(out['oa_body'])['processInstanceId'], wid)

    def test_unknown_or_mismatched_inputs_stop(self):
        for system, flow, wid in [('unknown', 'LEAVE', '1'), ('OA', 'UNKNOWN', '1'), ('OA', 'PURCHASE', '1'), ('OA', 'LEAVE', '')]:
            with self.subTest(system=system, flow=flow, wid=wid), self.assertRaises(ValueError):
                call('流程编码转换', arg1=flow, workflow_id=wid, system_code=system)

    def test_mock_rejects_missing_tampered_expired_jwt(self):
        now = int(time.time())
        expired = {'iss': 'DEMO-KEY-0001', 'iat': now - 120, 'nbf': now - 120, 'exp': now - 60}
        for auth in ('', jwt(secret=b'wrong-secret'), jwt(expired), 'Bearer invalid'):
            with self.subTest(auth=auth[:10]):
                response = requests.post(self.base + '/bpm/openapi/km-review/main/open/load',
                                         json={'fdId': '20099'}, headers={'Authorization': auth}, timeout=3)
                self.assertEqual(response.status_code, 401)

    def test_mock_rejects_invalid_json(self):
        response = requests.post(self.base + '/bpm/webhook/summary', data='not-json', timeout=3)
        self.assertEqual(response.status_code, 400)

    def test_write_failure_status_keeps_summary_available(self):
        with patch('requests.post', side_effect=requests.ConnectionError('offline')):
            out = call('回调BPM写入AI总结内容', workflow_id='20099', workflow_code='PURCHASE',
                       task_id='', answer='测试摘要', base_url=self.base)
        self.assertIn('写回失败', out['result'])
        self.assertIn('摘要仍可查看', out['result'])

    def test_cleaner_preserves_evidence_and_rejects_empty_result(self):
        out = call('生成结果数据处理', arg1='金额 [100]；附件 **报价**')
        self.assertIn('[100]', out['result'])
        self.assertIn('最终审批由人完成', out['result'])
        with self.assertRaises(ValueError):
            call('生成结果数据处理', arg1=' ')

    def test_graph_edges_signatures_and_failure_routes(self):
        edges = DSL['workflow']['graph']['edges']
        by_id = {n['id']: n['data'] for n in NODES.values()}
        adjacency = {key: [] for key in by_id}
        for edge in edges:
            self.assertIn(edge['source'], by_id)
            self.assertIn(edge['target'], by_id)
            adjacency[edge['source']].append(edge['target'])
        visited, visiting = set(), set()
        def visit(node):
            self.assertNotIn(node, visiting, '工作流存在环')
            if node in visited:
                return
            visiting.add(node)
            for target in adjacency[node]:
                visit(target)
            visiting.remove(node)
            visited.add(node)
        visit('1747625302829')
        self.assertEqual(visited, set(by_id))
        for title, node in NODES.items():
            data = node['data']
            if data['type'] == 'code':
                main = next(n for n in ast.parse(data['code']).body if isinstance(n, ast.FunctionDef) and n.name == 'main')
                self.assertEqual({arg.arg for arg in main.args.args}, {v['variable'] for v in data['variables']})
            if data['type'] in ('code', 'http-request', 'llm') and title != '回调BPM写入AI总结内容':
                self.assertEqual(data['error_strategy'], 'fail-branch')
                self.assertTrue(any(e['source'] == node['id'] and e['target'] == '1747807067083' and e['sourceHandle'] == 'fail-branch' for e in edges))
        self.assertTrue(any(e['source'] == '1780973262149' and e['target'] == '17636152941180' for e in edges))
        self.assertFalse(any(e['source'] == '17636152895170' and e['target'] == '17636152941180' for e in edges))

    def test_prompt_separates_business_data_from_instructions(self):
        for title in ('LLM 1-1', 'LLM 1-1 (1)'):
            prompts = NODES[title]['data']['prompt_template']
            self.assertEqual([p['role'] for p in prompts], ['system', 'user'])
            self.assertNotIn('.process_data#', prompts[0]['text'])
            self.assertNotIn('.file_data#', prompts[0]['text'])
            self.assertIn('incomplete=true', prompts[0]['text'])
        # 结构检查不证明模型能够抵抗提示注入，实机验收见 docs/validation.md。


if __name__ == '__main__':
    unittest.main()
