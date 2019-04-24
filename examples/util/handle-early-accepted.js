import {Request, ResponseBuilder} from "@opennetwork/http-representation";
import isAccepted from "../../dist/store/is-accepted";

export default async function handleDataBrowser(request, { fetchNext }) {
  if (request.method.toUpperCase() !== "GET") {
    // Not our problem
    return undefined;
  }

  const currentResource = await fetchNext(
    new Request(
      request.url,
      {
        method: "HEAD",
        headers: request.headers
      }
    )
  );

  if (!currentResource.ok) {
    return undefined;
  }

  const contentType = (currentResource.headers.get("Content-Type") || "").split(";")[0].trim();

  if (!isAccepted(request.headers, contentType)) {
    return undefined;
  }

  // Now get our resource
  return await fetchNext(
    new Request(
      request.url,
      {
        method: "GET",
        headers: request.headers
      }
    )
  );
};
