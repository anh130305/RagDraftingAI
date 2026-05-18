"""
Script đồng bộ ngược: Cập nhật trạng thái rag_ingested/chunk_count/status
từ Cloud DB (Aiven - source of truth) về Local DB.
"""
import sys
import os

backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(backend_dir)

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.document import Document


def sync_ingest_status_from_cloud():
    print("=== ĐỒNG BỘ TRẠNG THÁI INGEST TỪ CLOUD → LOCAL DB ===\n")

    # Kết nối Local DB
    local_engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
    LocalSession = sessionmaker(bind=local_engine)
    local_db = LocalSession()

    # Kết nối Cloud DB (Aiven)
    cloud_url = settings.CLOUD_DATABASE_URL
    ca_path = os.path.abspath(os.path.join(backend_dir, "Key/ca.pem"))
    cloud_engine = create_engine(
        cloud_url,
        pool_pre_ping=True,
        connect_args={"sslrootcert": ca_path, "sslmode": "verify-ca"},
    )
    CloudSession = sessionmaker(bind=cloud_engine)
    cloud_db = CloudSession()

    # Lấy tất cả tài liệu từ Cloud DB
    cloud_docs = cloud_db.query(Document).all()
    print(f"Cloud DB: {len(cloud_docs)} tài liệu, "
          f"đã ingest: {sum(1 for d in cloud_docs if d.rag_ingested)}")

    updated = 0
    for cloud_doc in cloud_docs:
        if not cloud_doc.rag_ingested:
            continue  # Bỏ qua tài liệu chưa ingest

        local_doc = local_db.query(Document).filter(
            Document.id == cloud_doc.id
        ).first()

        if not local_doc:
            print(f"  ⚠️  Không tìm thấy '{cloud_doc.title}' trong Local DB")
            continue

        if local_doc.rag_ingested != cloud_doc.rag_ingested \
                or local_doc.chunk_count != cloud_doc.chunk_count \
                or local_doc.status != cloud_doc.status:
            local_doc.rag_ingested = cloud_doc.rag_ingested
            local_doc.chunk_count = cloud_doc.chunk_count
            local_doc.status = cloud_doc.status
            updated += 1
            print(f"  ✅ Cập nhật '{local_doc.title}': "
                  f"rag_ingested=True, chunks={cloud_doc.chunk_count}")

    if updated > 0:
        local_db.commit()
        print(f"\n>>> Đã cập nhật {updated} tài liệu trong Local DB.")
    else:
        print("\n>>> Local DB đã đồng bộ, không có thay đổi nào.")

    local_db.close()
    cloud_db.close()
    print("\n=== HOÀN TẤT ===")


if __name__ == "__main__":
    sync_ingest_status_from_cloud()
