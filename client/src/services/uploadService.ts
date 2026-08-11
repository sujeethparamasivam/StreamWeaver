import api from './api';

export interface UploadResult {
  message: string;
  fileName: string;
  total: number;
  totalRows?: number;
  failedRows?: number;
  preview: Array<Record<string, unknown>>;
  columns?: string[];
  uploadId: string;
}

const uploadFile = async (file: File, clientUploadId: string): Promise<UploadResult> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('clientUploadId', clientUploadId);
  const response = await api.post<UploadResult>('/uploads', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

export default uploadFile;
