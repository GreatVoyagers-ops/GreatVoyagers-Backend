import Settings, { getSettings } from "../../models/Settings.js";
import { settingsSchema } from "../../lib/crmValidation.js";
import { adminRouter } from "./shared.js";

const router = adminRouter();

router.get("/", async (req, res) => {
  res.json({ settings: await getSettings() });
});

router.put("/", async (req, res) => {
  const input = settingsSchema.parse(req.body ?? {});
  const settings = await Settings.findOneAndUpdate({ _id: "company" }, { $set: input }, { upsert: true, returnDocument: "after", runValidators: true }).lean();
  res.json({ settings });
});

export default router;
