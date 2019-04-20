import { lookup } from "mime-types";
import { PartialResponse } from "@opennetwork/http-representation";

export default function(request) {
  if (!["GET", "HEAD"].includes(request.method.toUpperCase())) {
    return new PartialResponse();
  }
  const contentType = lookup(request.url);
  if (!contentType) {
    return new PartialResponse();
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
