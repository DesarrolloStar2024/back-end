import mongoose, { Schema, Document } from "mongoose";

export interface IChannel extends Document {
  name: string;
  slug: string;
  bodegas: string[];
  createdAt?: Date;
}

const ChannelSchema = new Schema<IChannel>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    bodegas: { type: [String], required: true },
  },
  { timestamps: true }
);

ChannelSchema.index({ slug: 1 }, { unique: true });

export const Channel =
  mongoose.models.Channel || mongoose.model<IChannel>("Channel", ChannelSchema);
