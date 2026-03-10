import os
import pandas as pd
import yaml

# Xác định thư mục chứa script
base_dir = os.path.dirname(os.path.abspath(__file__))
input_dir = os.path.join(base_dir, "Forms", "md")
output_file = os.path.join(base_dir, "forms_dataset.parquet")

data = []

for filename in os.listdir(input_dir):
    if filename.endswith(".md"):
        filepath = os.path.join(input_dir, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Parse YAML frontmatter
        if content.startswith("---"):
            parts = content.split("---", 2)
            if len(parts) >= 3:
                frontmatter_str = parts[1]
                template_markdown = parts[2].strip()
                
                try:
                    metadata = yaml.safe_load(frontmatter_str)
                    
                    form_id = str(metadata.get("form_id", ""))
                    
                    form_type = metadata.get("form_type", "")
                    if isinstance(form_type, list):
                        form_type = ", ".join([str(x) for x in form_type])
                    else:
                        form_type = str(form_type)
                        
                    purpose = str(metadata.get("purpose", ""))
                    
                    required_fields = metadata.get("required_fields", [])
                    if not isinstance(required_fields, list):
                        required_fields = [str(required_fields)]
                    else:
                        required_fields = [str(f) for f in required_fields]
                    
                    data.append({
                        "form_id": form_id,
                        "form_type": form_type,
                        "purpose": purpose,
                        "required_fields": required_fields,
                        "template_markdown": template_markdown
                    })
                except Exception as e:
                    print(f"Lỗi khi đọc file {filename}: {str(e)}")

# Create DataFrame
df = pd.DataFrame(data)

# Save to Parquet
df.to_parquet(output_file, engine='pyarrow')

print(f"Đã chuyển đổi thành công {len(df)} biểu mẫu sang file Parquet.")
print(f"Đường dẫn file lưu tại: {output_file}")
print("Cấu trúc các cột:")
print(df.columns.tolist())
