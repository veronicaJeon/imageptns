import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import generatedApiRoutes from "./open-next.api-routes.json";

const apiRoutes = generatedApiRoutes as `app/${string}/route`[];
const baseConfig = defineCloudflareConfig({ routePreloadingBehavior: "none" });

export default {
  ...baseConfig,
  functions: {
    api: {
      ...baseConfig.default,
      placement: "regional",
      runtime: "node",
      routePreloadingBehavior: "none",
      routes: apiRoutes,
      patterns: ["/api/*"],
    },
  },
};
