import mongoose, { Schema, Document } from 'mongoose';

export interface IValidationRecord extends Document {
  uploadId: string;
  rowNumber: number;
  field: string;
  message: string;
  severity: 'warning' | 'error';
  data: Record<string, unknown>;
}

const validationRecordSchema = new Schema<IValidationRecord>(
  {
    uploadId: { type: String, required: true, index: true },
    rowNumber: { type: Number, required: true },
    field: { type: String, required: true },
    message: { type: String, required: true },
    severity: { type: String, enum: ['warning', 'error'], default: 'error' },
    data: { type: Schema.Types.Mixed, required: true }
  },
  { timestamps: true }
);

export default mongoose.model<IValidationRecord>('ValidationRecord', validationRecordSchema);
