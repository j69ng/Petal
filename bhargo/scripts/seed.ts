// `npm run seed` — loads the sample books over whatever is there.

import { seedSampleData } from "../src/lib/seed";

seedSampleData((message) => console.log(message));
