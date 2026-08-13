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
  try {
    const response = await api.post<UploadResult>('/uploads', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  } catch (error: any) {
    console.error('Upload error details:', {
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      data: error?.response?.data,
      message: error?.message
    });
    throw error;
  }
};

export default uploadFile;
