import mongoose, { Schema, Document } from "mongoose";

export interface IChannel extends Document {
  name: string;
  slug: string;
  bodegas: string[];
  marcas: string[];
  createdAt?: Date;
}

const ChannelSchema = new Schema<IChannel>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    bodegas: { type: [String], required: true },
    marcas: { type: [String], default: [] },
  },
  { timestamps: true }
);

// slug unique index already declared via `unique: true` on the field

export const Channel =
  mongoose.models.Channel || mongoose.model<IChannel>("Channel", ChannelSchema);
