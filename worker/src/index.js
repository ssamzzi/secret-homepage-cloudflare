import { handleApi } from "./routes/api.js";

export default {
  async fetch(request, env) {
    const apiResponse = handleApi(request, env);
    if (apiResponse) return apiResponse;
    return env.ASSETS.fetch(request);
  },
};
