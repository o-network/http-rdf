import { lookup } from "mime-types";
import { PartialResponse } from "@opennetwork/http-representation";

export default function(request) {
  if (!["GET", "HEAD"].includes(request.method.toUpperCase())) {
    return undefined;
  }
  const contentType = lookup(new URL(request.url).pathname);
  if (!contentType) {
    return undefined;
  }
  return new PartialResponse(
    undefined,
    {
      headers: {
        "Content-Type": contentType
      }
    }
  );
}
