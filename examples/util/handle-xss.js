import { Response } from "@opennetwork/http-representation";
import fetchExternal from "node-fetch";

export default async function handleXSS(request) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/xss")) {
    return undefined;
  }
  if (!url.searchParams.has("uri")) {
    return new Response(undefined, {
      status: 400
    });
  }
  const uri = url.searchParams.get("uri");
  return fetchExternal(uri, {
    headers: {
      Accept: request.headers.get("Accept")
    }
  });
}
