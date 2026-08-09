"""命令行输出格式化：JSON 与简易表格。"""

import json


def to_json(data):
    return json.dumps(data, ensure_ascii=False, indent=2)


def render_table(headers, rows, max_width=64):
    """把行数据渲染为等宽文本表格（无外部依赖）。"""
    text_rows = []
    for row in rows:
        text_rows.append([_cell(value, max_width) for value in row])
    widths = []
    for i, header in enumerate(headers):
        content_widths = [len(row[i]) for row in text_rows] if text_rows else []
        widths.append(max([len(header), *content_widths]))

    def line(values):
        return '  '.join(value.ljust(widths[i]) for i, value in enumerate(values)).rstrip()

    output = [line(headers)]
    output.append('  '.join('-' * widths[i] for i in range(len(widths))))
    output.extend(line(row) for row in text_rows)
    return '\n'.join(output)


def _cell(value, max_width):
    if value is None:
        return '-'
    if isinstance(value, (dict, list)):
        value = json.dumps(value, ensure_ascii=False)
    text = str(value)
    return text if len(text) <= max_width else text[: max_width - 1] + '…'
