import sys
import os

backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(backend_dir)

from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.db.session import Base
from app.models.user import User
from app.models.document import Document
from app.models.chat_session import ChatSession
from app.models.chat_message import ChatMessage
from app.models.prompt_template import PromptTemplate
from app.models.query_log import QueryLog
from app.models.audit_log import AuditLog

def sync():
    print("=== BẮT ĐẦU ĐỒNG BỘ DỮ LIỆU LOCAL SANG CLOUD DB (AIVEN) ===")
    
    # 1. Khởi tạo engine cho Local DB
    local_url = settings.DATABASE_URL
    # Nếu chạy bên trong Docker, Database host là 'DataBase', nếu chạy bên ngoài là 'localhost'
    print(f"-> Đang kết nối Local Database...")
    local_engine = create_engine(local_url, pool_pre_ping=True)
    LocalSession = sessionmaker(bind=local_engine)
    local_db = LocalSession()
    
    # 2. Khởi tạo engine cho Cloud DB
    cloud_url = settings.CLOUD_DATABASE_URL
    if not cloud_url:
        print("LỖI: Chưa cấu hình CLOUD_DATABASE_URL trong file .env!")
        return
        
    print(f"-> Đang kết nối Cloud Database...")
    connect_args = {}
    if settings.CLOUD_DB_SSL_CA:
        # Đường dẫn tuyệt đối của ca.pem
        ca_path = os.path.abspath(os.path.join(backend_dir, "Key/ca.pem"))
        if os.path.exists(ca_path):
            connect_args["sslrootcert"] = ca_path
            connect_args["sslmode"] = "verify-ca"
            print(f"   Sử dụng chứng chỉ SSL CA: {ca_path}")
        else:
            print(f"   CẢNH BÁO: Không tìm thấy ca.pem tại {ca_path}")

    cloud_engine = create_engine(cloud_url, pool_pre_ping=True, connect_args=connect_args)
    CloudSession = sessionmaker(bind=cloud_engine)
    cloud_db = CloudSession()
    
    # 3. Tạo bảng ở Cloud DB nếu chưa tồn tại
    print("-> Đang đảm bảo cấu trúc bảng (schema) tồn tại trên Cloud DB...")
    Base.metadata.create_all(bind=cloud_engine)
    print("   Đã khởi tạo/kiểm tra các bảng thành công.")
    
    # 4. Danh sách các Model cần đồng bộ theo thứ tự quan hệ phụ thuộc
    models_to_sync = [
        (User, "users"),
        (ChatSession, "chat_sessions"),
        (Document, "documents"),
        (ChatMessage, "chat_messages"),
        (PromptTemplate, "prompt_templates"),
        (QueryLog, "query_logs"),
        (AuditLog, "audit_logs")
    ]
    
    # 5. Thực hiện đồng bộ từng bảng
    for model_class, table_name in models_to_sync:
        print(f"\n-> Đang đồng bộ bảng '{table_name}'...")
        local_records = local_db.query(model_class).all()
        print(f"   Tìm thấy {len(local_records)} bản ghi ở Local DB.")
        
        synced_count = 0
        updated_count = 0
        
        for record in local_records:
            # Lấy thông tin thuộc tính của đối tượng để sao chép (chỉ lấy cột thực tế của bảng, bỏ qua relationships)
            mapper = inspect(model_class)
            columns = list(mapper.columns.keys())
            record_data = {col: getattr(record, col) for col in columns}
            
            # Kiểm tra xem bản ghi đã tồn tại trên Cloud DB chưa
            cloud_record = cloud_db.query(model_class).filter(model_class.id == record.id).first()
            
            if not cloud_record:
                # Chèn mới
                new_record = model_class(**record_data)
                cloud_db.add(new_record)
                synced_count += 1
            else:
                # Cập nhật nếu có thay đổi
                for col, val in record_data.items():
                    setattr(cloud_record, col, val)
                updated_count += 1
                
        if synced_count > 0 or updated_count > 0:
            try:
                cloud_db.commit()
                print(f"   Thành công: Đã thêm mới {synced_count} và cập nhật {updated_count} bản ghi.")
            except Exception as e:
                cloud_db.rollback()
                print(f"   LỖI khi commit bảng '{table_name}': {e}")
        else:
            print("   Bảng đã đồng bộ đầy đủ, không có thay đổi nào.")
            
    # Đóng kết nối
    local_db.close()
    cloud_db.close()
    print("\n=== ĐỒNG BỘ DỮ LIỆU HOÀN TẤT THÀNH CÔNG! ===")

if __name__ == "__main__":
    sync()
