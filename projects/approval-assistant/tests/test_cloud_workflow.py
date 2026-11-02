"""执行云端 DSL 的实际代码与连线；模型用明确标记的测试文本替代。"""
import ast
import copy
import json
from pathlib import Path
import re
import unittest
from unittest.mock import patch

import yaml


DSL = yaml.safe_load((Path(__file__).resolve().parents[1] / 'workflow-cloud.yml').read_text())
NODES = {node['id']: node['data'] for node in DSL['workflow']['graph']['nodes']}
EDGES = DSL['workflow']['graph']['edges']
START = '1747625302829'
FALLBACK = '1747807067083'
OA_LLM = '1747706698187'
BPM_LLM = '17635292115110'


def call(node_id, **kwargs):
    node = NODES[node_id]
    scope = {}
    exec(compile(node['code'], node['title'], 'exec'), scope)
    result = scope['main'](**kwargs)
    if set(result) != set(node['outputs']):
        raise AssertionError('代码输出与 DSL 声明不一致')
    types = {'string': str, 'object': dict, 'array[object]': list}
    for key, value in result.items():
        if not isinstance(value, types[node['outputs'][key]['type']]):
            raise AssertionError('代码输出类型与 DSL 声明不一致')
    return result


def run_flow(workflow_id, system_code, workflow_code, model_text='测试模型替身输出；非真实模型结果'):
    values = {START: dict(workflow_id=workflow_id, system_code=system_code,
                          workflow_code=workflow_code, task_id='')}
    executed = []
    current = START
    while True:
        executed.append(current)
        node = NODES[current]
        handle = 'source'
        if node['type'] == 'answer':
            answer = re.sub(r'\{\{#([^.#]+)\.([^#]+)#\}\}',
                            lambda match: values[match[1]][match[2]], node['answer'])
            return values, executed, answer
        try:
            if node['type'] == 'code':
                kwargs = {v['variable']: values[v['value_selector'][0]][v['value_selector'][1]]
                          for v in node['variables']}
                values[current] = call(current, **kwargs)
            elif node['type'] == 'if-else':
                handle = 'false'
                for case in node['cases']:
                    if all(values[c['variable_selector'][0]][c['variable_selector'][1]] == c['value']
                           for c in case['conditions']):
                        handle = case['case_id']
                        break
            elif node['type'] == 'llm':
                values[current] = {'text': model_text}
        except ValueError:
            handle = 'fail-branch'
        edges = [e for e in EDGES if e['source'] == current and e['sourceHandle'] == handle]
        if len(edges) != 1:
            raise AssertionError('当前节点没有唯一的后续连线')
        current = edges[0]['target']


class CloudWorkflowTests(unittest.TestCase):
    def test_no_business_network_or_environment_dependency(self):
        self.assertEqual(DSL['workflow']['environment_variables'], [])
        self.assertNotIn('mock_base_url', yaml.safe_dump(DSL))
        for node in NODES.values():
            self.assertNotEqual(node['type'], 'http-request')
            if node['type'] != 'code':
                continue
            tree = ast.parse(node['code'])
            for item in ast.walk(tree):
                if isinstance(item, ast.Import):
                    self.assertTrue(all(alias.name in {'json', 'datetime', 'decimal'} for alias in item.names))
                elif isinstance(item, ast.ImportFrom):
                    self.assertIn(item.module, {'json', 'datetime', 'decimal'})
            main = next(item for item in tree.body if isinstance(item, ast.FunctionDef) and item.name == 'main')
            self.assertEqual({arg.arg for arg in main.args.args}, {v['variable'] for v in node['variables']})
            for variable in node['variables']:
                producer, field = variable['value_selector']
                upstream = NODES[producer]
                fields = ({v['variable'] for v in upstream['variables']} if upstream['type'] == 'start'
                          else set(upstream['outputs']) if upstream['type'] == 'code' else {'text'})
                self.assertIn(field, fields)
        for edge in EDGES:
            self.assertEqual(edge['data']['sourceType'], NODES[edge['source']]['type'])
            self.assertEqual(edge['data']['targetType'], NODES[edge['target']]['type'])

    @patch('socket.socket', side_effect=AssertionError('云端数据链路不应访问网络'))
    def test_oa_runs_to_reply_without_mock(self, _socket):
        values, executed, answer = run_flow('10086', 'OA', 'LEAVE')
        self.assertIn(OA_LLM, executed)
        self.assertNotIn(FALLBACK, executed)
        form = json.loads(values['1747625928035']['process_data'])
        self.assertEqual(form['申请人'], '张三')
        self.assertEqual(form['开始时间'], '2026-11-05T09:00+08:00')
        files = json.loads(values['1747625928035']['file_data'])
        self.assertFalse(files['incomplete'])
        self.assertTrue(files['files'][0]['content']['simulated'])
        self.assertIn('虚构数据', answer)
        self.assertIn('最终审批由人完成', answer)

    @patch('socket.socket', side_effect=AssertionError('云端数据链路不应访问网络'))
    def test_bpm_runs_to_reply_without_claiming_writeback(self, _socket):
        values, executed, answer = run_flow('20099', 'BPM', 'PURCHASE')
        self.assertIn(BPM_LLM, executed)
        self.assertNotIn(FALLBACK, executed)
        form = json.loads(values['17633623818210']['process_data'])
        self.assertEqual(form['总金额'], 196000)
        self.assertIn('一致', form['金额核对'])
        self.assertIn('未保存结果', answer)
        self.assertIn('未调用 BPM', answer)
        self.assertNotIn('写回成功', answer)

    def test_invalid_inputs_stop_before_model(self):
        for args in [('99999', 'OA', 'LEAVE'), ('99999', 'BPM', 'PURCHASE'),
                     ('10086', 'OA', 'PURCHASE'), ('10086', 'OTHER', 'LEAVE')]:
            with self.subTest(args=args):
                _, executed, _ = run_flow(*args)
                self.assertEqual(executed[-1], FALLBACK)
                self.assertNotIn(OA_LLM, executed)
                self.assertNotIn(BPM_LLM, executed)
        with self.assertRaises(ValueError):
            call('1761544744961', flowNum='MISSING')

    def test_missing_or_unreadable_required_material_stops(self):
        config = call('1761544744961', flowNum='RULE-1001')
        payload = json.loads(call('1747625687855', workflow_id='10086')['body'])
        for failure in ('field', 'attachment', 'parse'):
            broken = copy.deepcopy(payload)
            if failure == 'field':
                del broken['data']['formData']['fd_reason']
            elif failure == 'attachment':
                broken['data']['attachments'] = []
            else:
                broken['data']['attachments'][0]['id'] = 'MISSING'
            with self.subTest(failure=failure), self.assertRaises(ValueError):
                call('1747625928035', workflow_data=json.dumps(broken),
                     processed_fields=config['processedFields'], file_rules=config['fileRulse'])

    def test_purchase_amount_mismatch_stops(self):
        config = call('1761544744961', flowNum='RULE-1003')
        data = call('1763363903584', fdId='20099')
        data['dynamicProps']['total_amount'] += 1
        with self.assertRaisesRegex(ValueError, '合计与申请总额不一致'):
            call('17633623818210', dynamic_props=data['dynamicProps'], attachment=data['attachment'],
                 processed_fields=config['processedFields'], file_rules=config['fileRulse'])

    def test_empty_model_output_still_uses_fallback(self):
        _, executed, _ = run_flow('10086', 'OA', 'LEAVE', model_text=' ')
        self.assertIn(OA_LLM, executed)
        self.assertEqual(executed[-1], FALLBACK)


if __name__ == '__main__':
    unittest.main()
