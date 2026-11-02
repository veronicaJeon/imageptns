import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // Avoid route preloading on cold start. It increases CPU usage and is not
  // needed for the current application routing model.
  routePreloadingBehavior: "none",
});
