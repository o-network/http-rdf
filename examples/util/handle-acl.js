import { getResponse, getAllowedHeaderValue } from "@opennetwork/web-access-control";
import { Response, ResponseBuilder } from "@opennetwork/http-representation";
import { origin } from "../origin";

export default async function handleACL(request, { fetchNext }) {
  // export type WebAccessControlMode = "Read" | "Write" | "Append" | "Control" | string;
  const mode = {
    HEAD: 'Read',
    GET: 'Read',
    DELETE: 'Write',
    PUT: 'Write',
    POST: 'Write',
    PATCH: 'Write',
    COPY: true,
    OPTIONS: 'Read'
  }[request.method.toUpperCase()];

  if (!mode) {
    // We can't handle this method using WAC
    return new Response(null, {
      status: 405
    })
  }

  /**
   *
   * @type {WebAccessControlOptions}
   */
  const options = {
    agent: 'https://localhost:8443/profile/card#me',
    origin,
    fetch: fetchNext,
    trustedOrigins: [origin],
    allowedCache: {},
    aclResourceCache: {},
    fetchCache: {},
    getAccessResourceAndModeIfACLResource: resource => /\.acl$/i.test(resource) ? ({
      resource: resource.replace(/\.acl$/i, ''),
      mode: 'Control'
    }) : null
  };

  const allowValue = await getAllowedHeaderValue(request.url, options);

  const builder = new ResponseBuilder();
  builder.withHeaders({
    "WAC-Allow": allowValue
  });

  if (mode === true) {
    return builder.build();
  }

  // Skip if true, as COPY will also hit the "GET" & "PUT"
  builder.with(await getResponse(
    request.url,
    mode,
    options
  ));

  return builder.build();
}
