import { dirname, relative } from "path";
import { Request, PartialResponse } from "@opennetwork/http-representation";

async function getACLUrl(store, url) {
  if (/\.acl$/i.test(url)) {
    return undefined;
  }
  const aclUrl = `${url}.acl`;
  const headResponse = await store.fetch(
    new Request(
      aclUrl,
      {
        method: "HEAD"
      }
    )
  );
  if (headResponse.ok) {
    return aclUrl;
  }
  // Only return if we have a direct ACL
  return undefined;
  // const instance = new URL(url);
  // if (instance.pathname === "/") {
  //   return undefined;
  // }
  // const dir = dirname(instance.pathname);
  // return getACLUrl(store, new URL(dir, instance.origin))
}

export default function(store) {
  return async request => {
    const aclUrl = await getACLUrl(store, request.url);
    if (!aclUrl) {
      return new PartialResponse();
    }
    const aclUrlInstance = new URL(aclUrl),
      originalUrlInstance = new URL(request.url);
    return new PartialResponse(
      undefined,
      {
        headers: {
          "Link": `<${relative(dirname(originalUrlInstance.pathname), aclUrlInstance.pathname)}>; rel="acl"`
        }
      }
    );
  }
}
