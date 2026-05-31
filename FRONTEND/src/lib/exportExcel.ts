import * as XLSX from 'xlsx';

export const exportToExcel = (data: any[], filename: string, sheetName: string = 'Sheet1') => {
  if (!data || data.length === 0) {
    alert("Không có dữ liệu để xuất");
    return;
  }
  
  // Tạo sheet từ dữ liệu
  const worksheet = XLSX.utils.json_to_sheet(data);
  
  // Tạo workbook và thêm sheet
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  
  // Tải file excel
  XLSX.writeFile(workbook, `${filename}.xlsx`);
};
