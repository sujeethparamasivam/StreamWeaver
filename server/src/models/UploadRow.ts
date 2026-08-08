import mongoose, { Schema, Document } from 'mongoose';

export interface IUploadRow extends Document {
  uploadId: string;
  fileName: string;
  rowNumber: number;
  data: Record<string, unknown>;
}

const uploadRowSchema = new Schema<IUploadRow>(
  {
    uploadId: { type: String, required: true, index: true },
    fileName: { type: String, required: true },
    rowNumber: { type: Number, required: true },
    data: { type: Schema.Types.Mixed, required: true }
  },
  { timestamps: true }
);

export default mongoose.model<IUploadRow>('UploadRow', uploadRowSchema);
