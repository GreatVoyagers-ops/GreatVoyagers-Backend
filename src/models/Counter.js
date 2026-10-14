import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } });

const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);

/** Atomic running number, offset so the first value is `offset + 1`. */
export async function nextSequence(name, offset = 1000) {
  const counter = await Counter.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" });
  return offset + counter.seq;
}

export default Counter;
