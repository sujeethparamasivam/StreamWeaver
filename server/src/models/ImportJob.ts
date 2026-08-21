import mongoose, { Schema, Document } from 'mongoose';

export interface IImportJob extends Document {
  uploadId: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalRows: number;
  failedRows: number;
  fileSize?: number;
  columns?: string[];
  selectedColumns?: string[];
  mapping?: Record<string, string>;
  transformedAt?: Date;
  importedAt?: Date;
  importedRows?: number;
  createdBy?: string;
  startedAt?: Date;
  finishedAt?: Date;
  memoryAudit?: {
    peakRss?: number;
    peakHeap?: number;
    avgRss?: number;
    avgHeap?: number;
    samples?: number;
    savedAt?: Date;
  };
}

const importJobSchema = new Schema<IImportJob>(
  {
    uploadId: { type: String, required: true, unique: true },
    fileName: { type: String, required: true },
    status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
    totalRows: { type: Number, default: 0 },
    failedRows: { type: Number, default: 0 },
    fileSize: { type: Number, default: 0 },
    columns: { type: [String], default: [] },
    selectedColumns: { type: [String], default: [] },
    mapping: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: String },
    startedAt: { type: Date },
    finishedAt: { type: Date },
    importedAt: { type: Date },
    importedRows: { type: Number, default: 0 }
    ,
    memoryAudit: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

export default mongoose.model<IImportJob>('ImportJob', importJobSchema);
