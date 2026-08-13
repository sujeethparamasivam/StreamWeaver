import mongoose from 'mongoose';

export interface IMemorySample extends mongoose.Document {
  uploadId: string;
  ts: Date;
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
}

const memorySampleSchema = new mongoose.Schema<IMemorySample>({
  uploadId: { type: String, required: true, index: true },
  ts: { type: Date, required: true },
  rss: { type: Number, required: true },
  heapTotal: { type: Number, required: true },
  heapUsed: { type: Number, required: true },
  external: { type: Number, required: true },
  arrayBuffers: { type: Number, required: true }
}, { timestamps: false });

export default mongoose.model<IMemorySample>('MemorySample', memorySampleSchema);
