import Customer from "../../models/Customer.js";
import Enquiry, { ENQUIRY_SOURCES, ENQUIRY_STATUSES, OPEN_STATUSES } from "../../models/Enquiry.js";
import Vendor from "../../models/Vendor.js";
import { adminRouter, istDayStart, istMonthStart } from "./shared.js";

const router = adminRouter();
const SUMMARY_FIELDS = "number name phone destination tripType status source followUpAt quoteAmount createdAt";

router.get("/", async (req, res) => {
  const todayStart = istDayStart();
  const tomorrowStart = istDayStart(new Date(), 1);
  const monthStart = istMonthStart();
  const windowStart = istDayStart(new Date(), -90);
  const open = { $in: OPEN_STATUSES };

  const [
    statusRows,
    overdueCount,
    todayCount,
    followUps,
    wonRows,
    newThisMonth,
    sourceRows,
    destinationRows,
    closedRows,
    recent,
    customerCount,
    vendorCount,
  ] = await Promise.all([
    Enquiry.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Enquiry.countDocuments({ status: open, followUpAt: { $lt: todayStart } }),
    Enquiry.countDocuments({ status: open, followUpAt: { $gte: todayStart, $lt: tomorrowStart } }),
    Enquiry.find({ status: open, followUpAt: { $lt: tomorrowStart } }).sort({ followUpAt: 1 }).limit(10).select(SUMMARY_FIELDS).lean(),
    Enquiry.aggregate([
      { $match: { status: "Won", closedAt: { $gte: monthStart } } },
      { $group: { _id: null, count: { $sum: 1 }, value: { $sum: { $ifNull: ["$bookedAmount", { $ifNull: ["$quoteAmount", 0] }] } } } },
    ]),
    Enquiry.countDocuments({ createdAt: { $gte: monthStart } }),
    Enquiry.aggregate([{ $match: { createdAt: { $gte: windowStart } } }, { $group: { _id: "$source", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Enquiry.aggregate([
      { $match: { createdAt: { $gte: windowStart }, destination: { $nin: ["", null] } } },
      { $group: { _id: { $toLower: { $trim: { input: "$destination" } } }, label: { $first: "$destination" }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
    Enquiry.aggregate([{ $match: { closedAt: { $gte: windowStart } } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    Enquiry.find().sort({ createdAt: -1 }).limit(8).select(SUMMARY_FIELDS).lean(),
    Customer.estimatedDocumentCount(),
    Vendor.estimatedDocumentCount(),
  ]);

  const statusCounts = Object.fromEntries(ENQUIRY_STATUSES.map((status) => [status, 0]));
  for (const row of statusRows) statusCounts[row._id] = row.count;
  const closed = Object.fromEntries(closedRows.map((row) => [row._id, row.count]));
  const decided = (closed.Won ?? 0) + (closed.Lost ?? 0);

  res.set("Cache-Control", "no-store");
  res.json({
    statusCounts,
    openCount: OPEN_STATUSES.reduce((sum, status) => sum + statusCounts[status], 0),
    newCount: statusCounts.New,
    followUps: { overdue: overdueCount, today: todayCount, items: followUps },
    wonThisMonth: { count: wonRows[0]?.count ?? 0, value: wonRows[0]?.value ?? 0 },
    newThisMonth,
    conversionRate: decided ? Math.round(((closed.Won ?? 0) / decided) * 100) : null,
    bySource: sourceRows.filter((row) => ENQUIRY_SOURCES.includes(row._id)).map((row) => ({ label: row._id, count: row.count })),
    byDestination: destinationRows.map((row) => ({ label: row.label.trim(), count: row.count })),
    recent,
    totals: { customers: customerCount, vendors: vendorCount },
  });
});

export default router;
