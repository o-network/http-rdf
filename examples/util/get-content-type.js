import { lookup } from "mime-types";

export default (request, contentLocation) => {
  if (request.method !== "HEAD" && request.method !== "GET") {
    return undefined; // No content
  }
  // Provided content type already
  if (request.headers.get("Content-Type")) {
    return request.headers.get("Content-Type");
  }
  return lookup(new URL(contentLocation || request.url).pathname)
};
