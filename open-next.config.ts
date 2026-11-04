import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import generatedApiRoutes from "./open-next.api-routes.json";
import generatedAdminApiRoutes from "./open-next.admin-api-routes.json";

const apiRoutes = generatedApiRoutes as `app/${string}/route`[];
const adminApiRoutes = generatedAdminApiRoutes as `app/${string}/route`[];
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
    },
    adminApi: {
      ...baseConfig.default,
      placement: "regional",
      runtime: "node",
      routePreloadingBehavior: "none",
      routes: adminApiRoutes,
    },
  },
};
