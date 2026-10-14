import p01 from "./01-thailand-tour-packages-from-india.js";
import p02 from "./02-thailand-visa-for-indian-citizens.js";
import p03 from "./03-best-time-to-visit-thailand.js";
import p04 from "./04-7-day-thailand-itinerary.js";
import p05 from "./05-phuket-vs-krabi.js";
import p06 from "./06-thailand-honeymoon-guide.js";
import p07 from "./07-thailand-trip-cost-from-india.js";
import p08 from "./08-things-to-do-in-bangkok.js";
import p09 from "./09-phi-phi-islands-day-trip-guide.js";
import p10 from "./10-pattaya-family-trip-guide.js";
import p11 from "./11-what-is-a-dmc-thailand.js";
import p12 from "./12-thailand-group-and-bachelor-trip.js";
import p13 from "./13-vegetarian-and-indian-food-in-thailand.js";
import p14 from "./14-bali-vs-thailand.js";

const coverUrl = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1600&q=75`;

export default [p01, p02, p03, p04, p05, p06, p07, p08, p09, p10, p11, p12, p13, p14].map(({ coverId, publishedAt, ...post }) => ({
  ...post,
  coverImage: coverUrl(coverId),
  author: "GreatVoyagers Team",
  status: "published",
  publishedAt: new Date(`${publishedAt}T09:00:00+05:30`),
}));
