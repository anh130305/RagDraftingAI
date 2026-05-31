import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from promptTemplates import parse_llm_json  # noqa: E402


def test_parse_llm_json_recovers_literal_newline_in_string():
    raw = '''```json
{
  "fields": {
    "CHU_VIET_TAT_CQ_BAN_HANH": "SYT",
    "NOI_DUNG_DIEN_BIEN": "1. BS. Nguyễn Đức Thắng tuyên bố lý do.\\n
      2. Bà Trần Thị Lan đọc trích ngang sơ yếu lý lịch.\\n
      3. Hội đồng tiến hành bỏ phiếu kín."
  }
}
```'''

    parsed = parse_llm_json(raw)

    assert parsed["fields"]["CHU_VIET_TAT_CQ_BAN_HANH"] == "SYT"
    assert "1. BS. Nguyễn Đức Thắng" in parsed["fields"]["NOI_DUNG_DIEN_BIEN"]
    assert "2. Bà Trần Thị Lan" in parsed["fields"]["NOI_DUNG_DIEN_BIEN"]
    assert "3. Hội đồng" in parsed["fields"]["NOI_DUNG_DIEN_BIEN"]


def test_parse_llm_json_still_rejects_structurally_invalid_json():
    raw = '{"fields": {"A": "x" "B": "y"}}'

    with pytest.raises(ValueError, match="Không parse được JSON"):
        parse_llm_json(raw)
