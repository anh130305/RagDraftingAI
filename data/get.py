import os
from datasets import load_dataset
import pandas as pd

# 1. Thiết lập thư mục lưu trữ
save_dir = r"D:\coding\school\QLDA\RAG_drafting\data"
if not os.path.exists(save_dir):
    os.makedirs(save_dir)

def download_huggingface_dataset(repo_id, filename):
    print(f"--- Đang tải dataset: {repo_id} ---")
    try:
        # Tải dataset từ Hugging Face
        # Với các dataset này, chúng ta lấy phân đoạn 'train'
        dataset = load_dataset(repo_id, split='train')
        
        # Chuyển đổi sang Pandas DataFrame để dễ xử lý và lưu trữ
        df = pd.DataFrame(dataset)
        
        # Lưu file
        file_path = os.path.join(save_dir, filename)
        
        # Kiểm tra đuôi file để lưu định dạng phù hợp
        if filename.endswith('.csv'):
            df.to_csv(file_path, index=False, encoding='utf-8-sig')
        else:
            df.to_parquet(file_path, index=False)
            
        print(f"Thành công! Đã lưu tại: {file_path}")
        print(f"Số lượng dòng: {len(df)}")
        return df
    except Exception as e:
        print(f"Lỗi khi tải {repo_id}: {e}")
        return None

# 2. Thực thi tải 2 bộ dữ liệu
# Bộ 1: ThuVienPhapLuat (Nên lưu dạng Parquet vì dữ liệu HTML rất nặng)
df_tvpl = download_huggingface_dataset("sontungkieu/ThuVienPhapLuat", "thuvienphapluat_full.parquet")

# Bộ 2: vn-law-corpus (Lưu dạng CSV để bạn dễ soi nội dung Điều/Khoản)
df_corpus = download_huggingface_dataset("truro7/vn-law-corpus", "vn_law_corpus.csv")

print("\n--- Hoàn tất quá trình tải dữ liệu ---")