# -*- coding: utf-8 -*-
"""
智能审批助手（重建演示版）——本地 Mock API 服务
单文件、仅标准库。用法: python3 mock_server.py（默认仅监听本机 5050）

模拟的系统:
  /mock/oa/api/workflowService/getWorkflowInfo/process/v2   OA 流程数据查询
  /mock/bpm/openapi/km-review/main/open/load                BPM 表单数据查询 (JWT 鉴权)
  /mock/openapi/auth/access_token                           开放平台 token
  /mock/openapi/rules/getRulesAndFields                      规则/字段映射查询
  /mock/docfactory/v1/attachment/parse                      附件解析
  /mock/bpm/webhook/summary                                 AI 总结写回 BPM
"""
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from datetime import datetime, timezone, timedelta

def ts(y, m, d, hh=9, mm=0):
    """构造毫秒时间戳（模拟 BPM/OA 的时间字段）"""
    return int(datetime(y, m, d, hh, mm, tzinfo=timezone(timedelta(hours=8))).timestamp() * 1000)

# ---------------- 演示数据（全部虚构） ----------------

RULES = {
    "RULE-1001": {
        "flowRulse": """【请假流程 核对规则】
1. 用不超过100字提炼关键信息：请假人、部门、请假类型、起止时间、天数、事由
2. 合理性判断要点：
   - 请假类型与事由是否匹配
   - 列出天数和起止时间；未提供工作日历时不判断跨周末或节假日的精确天数
   - 仅整理本次事由；未提供历史记录，不判断请假频率
3. 输出格式（严格遵守）：
【关键信息】...
【核对结果】...
【待人工确认】列明仍需人工核实的事项，不输出同意或驳回决定""",
        "flowFileRulse": "请假审批单.pdf：核对请假单天数与系统填写是否一致、模拟材料中是否注明签字信息（不验证真实性）。",
        "fieldList": [
            {"cnField": "流程ID", "enField": "fdNumber", "dataType": "dynamicProps"},
            {"cnField": "申请人", "enField": "fd_applicant.fdName", "dataType": "dynamicProps"},
            {"cnField": "申请部门", "enField": "fd_dept.fdName", "dataType": "dynamicProps"},
            {"cnField": "请假类型", "enField": "fd_leaveType", "dataType": "dynamicProps"},
            {"cnField": "开始时间", "enField": "fd_startDate", "dataType": "dynamicProps"},
            {"cnField": "结束时间", "enField": "fd_endDate", "dataType": "dynamicProps"},
            {"cnField": "请假天数", "enField": "fd_days", "dataType": "dynamicProps"},
            {"cnField": "请假事由", "enField": "fd_reason", "dataType": "dynamicProps"},
        ],
    },
    "RULE-1003": {
        "flowRulse": """【采购申请流程 核对规则】
1. 用不超过120字提炼：标题、申请人、部门、采购事由、总金额
2. 合理性判断要点：
   - 明细金额加总与申请总金额是否一致
   - 单价×数量是否等于明细小计
   - 列出采购事由与物料对应关系；缺少库存和需求依据时不得判断超量
3. 输出格式（严格遵守）：
【关键信息】...
【核对结果】...
【待人工确认】列明仍需人工核实的事项，不输出同意或驳回决定""",
        "flowFileRulse": "采购报价明细.xlsx：逐行核对单价、数量、金额；未提供市场报价，不判断市场价格偏离。",
        "fieldList": [
            {"cnField": "标题", "enField": "requestName", "dataType": "workflowMainTableInfo"},
            {"cnField": "申请人", "enField": "sqr", "dataType": "workflowMainTableInfo"},
            {"cnField": "申请部门", "enField": "dept", "dataType": "workflowMainTableInfo"},
            {"cnField": "申请日期", "enField": "sqrq", "dataType": "workflowMainTableInfo"},
            {"cnField": "采购事由", "enField": "purchase_reason", "dataType": "workflowMainTableInfo"},
            {"cnField": "总金额", "enField": "total_amount", "dataType": "workflowMainTableInfo"},
            {"cnField": "采购明细", "enField": "detail_items", "dataType": "workflowMainTableInfo"},
        ],
    },
}

OA_DATA = {
    "10086": {
        "processName": "张三的请假申请",
        "formData": {
            "fdNumber": "OA-2026-10086",
            "fd_applicant.fdName": "张三",
            "fd_dept.fdName": "智能制造事业部-工艺部",
            "fd_leaveType": "年假",
            "fd_startDate": ts(2026, 11, 5, 9),
            "fd_endDate": ts(2026, 11, 6, 18),
            "fd_days": "2",
            "fd_reason": "年假休假，陪伴家人出行",
        },
        "attachments": [{"id": "ATT-001", "name": "请假审批单.pdf"}],
    }
}

BPM_DATA = {
    "20099": {
        "dynamicProps": {
            "requestName": "测试环境算力扩容采购申请",
            "sqr": {"fdName": "李四"},
            "dept": {"fdName": "信息技术部"},
            "sqrq": ts(2026, 11, 2, 10),
            "purchase_reason": "测试环境GPU算力不足，影响模型迭代排期",
            "total_amount": 196000,
            "detail_items": [
                {"item": "GPU服务器", "qty": 2, "price": 85000, "subtotal": 170000},
                {"item": "万兆交换机", "qty": 4, "price": 6500, "subtotal": 26000},
            ],
        },
        "attachment": [{"id": "ATT-002", "name": "采购报价明细.xlsx"}],
    }
}

PARSE = {
    "ATT-001": {"summary": "请假审批单扫描件，内容与系统填写一致", "keyPoints": ["请假类型：年假", "请假天数：2天", "申请人签字齐全"]},
    "ATT-002": {"summary": "采购报价明细表，共2行明细", "keyPoints": ["GPU服务器 2台 单价85000 小计170000", "万兆交换机 4台 单价6500 小计26000", "明细合计196000，与申请总额一致"]},
}

TOKEN = "demo-access-token"

# 日期类型由规则声明，金额不会按数值大小转换为时间。
for key, rule in RULES.items():
    filename = '请假审批单.pdf' if key == 'RULE-1001' else '采购报价明细.xlsx'
    rule['flowFileRulse'] = {'instructions': rule['flowFileRulse'], 'required_files': [filename]}
    for field in rule['fieldList']:
        path = field['enField']
        field['required'] = True
        field['valueType'] = ('datetime_ms' if path in ('fd_startDate', 'fd_endDate', 'sqrq')
                              else 'number' if path in ('fd_days', 'total_amount')
                              else 'json' if path == 'detail_items' else 'text')

def valid_jwt(header):
    import base64
    import hashlib
    import hmac
    import time
    try:
        scheme, token = header.split(' ', 1)
        head, payload, signature = token.split('.')
        decode = lambda value: base64.urlsafe_b64decode(value + '=' * (-len(value) % 4))
        expected = hmac.new(b'demo-jwt-secret', (head + '.' + payload).encode(), hashlib.sha256).digest()
        claims = json.loads(decode(payload))
        now = time.time()
        return (scheme == 'Bearer' and json.loads(decode(head)).get('alg') == 'HS256'
                and hmac.compare_digest(expected, decode(signature))
                and claims.get('iss') == 'DEMO-KEY-0001'
                and all(type(claims.get(k)) is int for k in ('iat', 'nbf', 'exp'))
                and claims['iat'] <= now and claims['nbf'] <= now < claims['exp'])
    except (ValueError, TypeError, KeyError, AttributeError):
        return False


class Handler(BaseHTTPRequestHandler):
    def _send(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == '/health':
            self._send({'status': 'ok', 'service': 'approval-demo-mock'})
        elif self.path.startswith('/mock/bpm/summary/'):
            wid = self.path.rsplit('/', 1)[-1]
            summary = self.server.summaries.get(wid)
            self._send({'success': summary is not None, 'data': summary}, 200 if summary else 404)
        else:
            self._send({'message': 'not found'}, 404)

    def do_POST(self):
        try:
            size = int(self.headers.get('Content-Length') or 0)
            if not 0 < size <= 65536:
                raise ValueError('invalid body size')
            body = json.loads(self.rfile.read(size))
            if not isinstance(body, dict):
                raise ValueError('expected object')
        except (ValueError, UnicodeDecodeError):
            self._send({'success': False, 'message': '请求必须为有效 JSON 对象（最大 64 KiB）'}, 400)
            return
        path = self.path.split('?')[0]
        if path.startswith('/mock/bpm/') and not valid_jwt(self.headers.get('Authorization', '')):
            self._send({'success': False, 'message': '无效或过期的演示 JWT'}, 401)
            return
        if path in ('/mock/openapi/rules/getRulesAndFields', '/mock/docfactory/v1/attachment/parse') and self.headers.get('accessToken') != TOKEN:
            self._send({'success': False, 'message': '无效演示 token'}, 401)
            return

        if path == '/mock/oa/api/workflowService/getWorkflowInfo/process/v2':
            if body.get('token') != 'demo-token':
                self._send({'success': False, 'message': '无效演示 token'}, 401)
                return
            data = OA_DATA.get(str(body.get('processInstanceId', '')))
            self._send({'success': data is not None, 'data': data, 'message': '' if data else '模拟流程不存在'})
        elif path == '/mock/openapi/auth/access_token':
            if body.get('appId') not in ('demo_app', 'demo_doc') or body.get('appSecret') != 'demo_secret':
                self._send({'success': False, 'message': '无效演示身份'}, 401)
                return
            self._send({'success': True, 'result': {'accessToken': TOKEN, 'expireIn': 3600}})
        elif path == '/mock/openapi/rules/getRulesAndFields':
            rule = RULES.get(body.get('flowNum', ''))
            self._send({'success': rule is not None, 'result': rule, 'message': '' if rule else '未配置规则'})
        elif path == '/mock/docfactory/v1/attachment/parse':
            if not isinstance(body.get('instructions'), str) or not body['instructions'].strip():
                self._send({'success': False, 'message': '缺少附件核对规则'}, 400)
                return
            parsed = PARSE.get(body.get('fileId', ''))
            # 固定夹具，不执行 OCR 或模型解析；返回收到的规则供演示核验。
            result = dict(parsed, received_instructions=body['instructions'], simulated=True) if parsed else None
            self._send({'success': parsed is not None, 'result': result, 'message': '' if parsed else '附件不存在'})
        elif path == '/mock/bpm/openapi/km-review/main/open/load':
            data = BPM_DATA.get(str(body.get('fdId', '')))
            result = {'mechanisms': {'sys-xform': {'dynamicProps': data['dynamicProps']}, 'attachment': data['attachment']}} if data else None
            self._send({'success': data is not None, 'data': result, 'msg': '' if data else '模拟流程不存在'})
        elif path == '/mock/bpm/webhook/summary':
            data = body.get('IT_DATA')
            if (not isinstance(data, dict) or data.get('workflow_id') not in BPM_DATA
                    or data.get('workflow_code') != 'PURCHASE'
                    or not isinstance(data.get('answer'), str) or not data['answer'].strip()):
                self._send({'ES_BC_INFO': {'TYPE': 'F'}}, 400)
                return
            self.server.summaries[data['workflow_id']] = data
            self._send({'ES_BC_INFO': {'TYPE': 'S'}})
        else:
            self._send({'message': 'not found'}, 404)


def create_server(host='127.0.0.1', port=5050):
    server = HTTPServer((host, port), Handler)
    server.summaries = {}
    return server


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='审批辅助工作流本地模拟服务，所有数据和凭据均为演示值')
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=5050)
    args = parser.parse_args()
    server = create_server(args.host, args.port)
    print(f'Mock API: http://{args.host}:{args.port}; Ctrl+C 停止', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
