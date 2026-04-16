
import sys
import os
import re
from typing import Tuple, Optional

# Mock the split logic from the service
def _split_prompt_smart(content: str) -> Tuple[str, Optional[str]]:
    if not content:
        return "", None
    
    # Pattern: \n\n followed by a line starting with a label (Key: Value)
    pattern = r'\n{2,}(?=[ \t]*[^:\n]{2,30}:)'
    match = re.search(pattern, content)
    
    if match:
        split_pos = match.start()
        query = content[:split_pos].strip()
        extra = content[split_pos:].strip()
        return query, extra
    
    return content.strip(), None

def test_smart_refactor():
    print("--- Testing Smart Split Logic ---")
    
    # Test 1: Administrative Drafting Example
    content_1 = """Soạn biên bản cuộc họp Hội đồng kỷ luật cán bộ, công chức của Sở Y tế tỉnh Phú Thọ. Cuộc họp xét hình thức kỷ luật đối với 01 chuyên viên vi phạm quy định pháp luật. Nội dung biên bản cần căn cứ theo Luật Cán bộ, công chức và Nghị định của Chính phủ quy định về xử lý kỷ luật cán bộ, công chức, viên chức.

Thời gian họp: 14h00 ngày 20/03/2025
Địa điểm: Phòng họp Ban Giám đốc, Sở Y tế Phú Thọ
Chủ trì: Giám đốc - BS. Nguyễn Đức Thắng
Thư ký: Trưởng phòng TC-CB - Trần Thị Lan
Kết luận: Hội đồng thống nhất kiến nghị hình thức Cảnh cáo"""

    q1, e1 = _split_prompt_smart(content_1)
    print("\n[Test 1] Standard split")
    print(f"Query found: {'YES' if q1.startswith('Soạn biên bản') else 'NO'}")
    print(f"Extra found: {'YES' if e1 and 'Thời gian họp' in e1 else 'NO'}")
    assert e1 is not None and "Thời gian họp" in e1

    # Test 2: Narrative only (No split)
    content_2 = "Soạn một văn bản thông thường không có thông tin chi tiết."
    q2, e2 = _split_prompt_smart(content_2)
    print("\n[Test 2] Narrative only")
    print(f"Query matches: {'YES' if q2 == content_2 else 'NO'}")
    print(f"Extra is None: {'YES' if e2 is None else 'NO'}")
    assert e2 is None

    # Test 3: Multiple newlines but no colons
    content_3 = "Para 1.\n\nPara 2."
    q3, e3 = _split_prompt_smart(content_3)
    print("\n[Test 3] Multiple paragraphs, no metadata")
    print(f"Extra is None: {'YES' if e3 is None else 'NO'}")
    assert e3 is None

    # Test 4: Colon but on same line (No split)
    content_4 = "Hợp đồng số: 123. Vui lòng soạn nội dung."
    q4, e4 = _split_prompt_smart(content_4)
    print("\n[Test 4] Colon on same line")
    print(f"Extra is None: {'YES' if e4 is None else 'NO'}")
    assert e4 is None

    print("\n[SUCCESS] All smart split tests passed!")

if __name__ == "__main__":
    test_smart_refactor()
