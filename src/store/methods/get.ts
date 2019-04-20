import { Request, Response } from "@opennetwork/http-representation";
import { RDFStoreOptions } from "../options";
import { RDF_MIME_TYPES } from "../mime-types";
import isAccepted, { isOneOfAccepted } from "../is-accepted";
import { graph, parse, serialize } from "rdflib";
import { preferredMediaTypes } from "../media-type";

async function handleMethod(request: Request, options: RDFStoreOptions, fetch: (request: Request) => Promise<Response>): Promise<Response> {

  const requestedType = preferredMediaTypes(request.headers.get("Accept"))[0];
  const possibleRDFType = preferredMediaTypes(request.headers.get("Accept"), RDF_MIME_TYPES)[0];
  const isDataBrowserPossible = requestedType && requestedType.includes("text/html") && options.getDataBrowser;

  if (isDataBrowserPossible) {
    return options.getDataBrowser(request, undefined);
  }

  const currentResource = await fetch(
    new Request(
      request.url,
      {
        method: "GET",
        headers: request.headers
      }
    )
  );

  if (!currentResource.ok) {
    return currentResource;
  }

  // Redirect for browser because of content negotiation
  if (currentResource.headers.get("Content-Location")) {
    return new Response(
      undefined,
      {
        status: 302,
        headers: {
          Location: currentResource.headers.get("Content-Location")
        }
      }
    );
  }

  if (isAccepted(request.headers, request.headers.get("Content-Type"))) {
    console.log("Early 1");
    // No need to do any more parsing
    return currentResource;
  }

  if (possibleRDFType !== requestedType) {
    console.log("Early 2", currentResource.headers.getAll("Content-Type"));
    // No need to do any more parsing
    return currentResource;
  }

  // Data browser should be accepted _after_ the RDF type
  if (!possibleRDFType && isDataBrowserPossible) {
    return options.getDataBrowser(request, currentResource);
  }

  if (!possibleRDFType) {
    return new Response(
      undefined,
      {
        status: 406
      }
    );
  }

  // We already know they accept an RDF type from RDF store code
  const currentResourceText = await currentResource.text();

  const resourceGraph = graph();

  await new Promise(
    (resolve, reject) => parse(
      currentResourceText,
      resourceGraph,
      request.url,
      (currentResource.headers.get("Content-Type") || "text/turtle").split(";")[0].trim(),
      (error) => error ? reject(error) : resolve()
    )
  );

  const body = await new Promise(
    (resolve, reject) => serialize(
      undefined,
      resourceGraph,
      request.url,
      possibleRDFType,
      (error, value) => error ? reject(error) : resolve(value)
    )
  );

  const response = new Response(
    body,
    {
      status: 200,
      headers: currentResource.headers
    }
  );
  response.headers.set("Content-Type", possibleRDFType);
  return response;
}

export default handleMethod;
