import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
import os

dataset_dir = 'dataset'
if not os.path.exists(dataset_dir):
    os.makedirs(dataset_dir)
csv_file = os.path.join(dataset_dir, 'vbpl_crawl_2.csv')
parquet_file = os.path.join(dataset_dir, 'legal_dataset.parquet')
chunk_size = 50000  # Điều chỉnh số dòng tùy theo RAM của bạn

print("Đang bắt đầu chuyển đổi theo từng chunk...")

# Tạo một reader để đọc file theo từng khối
reader = pd.read_csv(csv_file, chunksize=chunk_size, encoding='utf-16')

writer = None

for i, chunk in enumerate(reader):
    # Chuyển đổi DataFrame chunk sang PyArrow Table
    table = pa.Table.from_pandas(chunk)
    
    # Khởi tạo writer ở chunk đầu tiên
    if writer is None:
        writer = pq.ParquetWriter(parquet_file, table.schema, compression='snappy')
    
    # Ghi chunk vào file
    writer.write_table(table)
    print(f"Đã xử lý xong chunk thứ {i+1}")

if writer:
    writer.close()

print(f"Xong! File Parquet dung lượng lớn đã sẵn sàng: {parquet_file}")