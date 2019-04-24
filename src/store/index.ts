import { PartialResponse, Request, Response } from "@opennetwork/http-representation";
import { Store } from "@opennetwork/http-store";
import { RDFStoreOptions } from "./options";
import { METHODS, MethodHandler, handleMutate } from "./methods";
import appendLinks from "./append-links";
import isType, { isOneOfType } from "./is-type";
import { isOneOfAccepted } from "./is-accepted";
import { RDF_MIME_TYPES } from "./mime-types";
import { preferredMediaTypes } from "./media-type";

function isMutationMethod(methodUpper: string) {
  return ["PUT", "POST", "DELETE"].indexOf(methodUpper) > -1;
}

function getHandler(method: string): MethodHandler {
  const upper = method.toUpperCase();
  return METHODS[upper] || (isMutationMethod(upper) ? handleMutate : undefined);
}

export * from "./options";

export class RDFStore implements Store {

  private readonly options: RDFStoreOptions;

  constructor(options: RDFStoreOptions) {
    this.options = options;
  }

  static isRDFRequest(request: Request): boolean {
    const requestedType = preferredMediaTypes(request.headers.get("Accept"))[0];
    if (!requestedType || requestedType === "*/*") {
      return false;
    }
    if (isMutationMethod(request.method) && (isOneOfType(request.headers, RDF_MIME_TYPES) || isOneOfType(request.headers, ["application/sparql-update", "text/n3"]))) {
      return true;
    }
    if (request.method.toUpperCase() === "POST" && isType(request.headers, "multipart/form-data")) {
      return true;
    }
    // OPTIONS is handled via partial response
    if (!["GET", "HEAD"].includes(request.method.toUpperCase())) {
      return false;
    }
    return isOneOfAccepted(requestedType, RDF_MIME_TYPES);
  }

  private async handle(request: Request, options: RDFStoreOptions = undefined): Promise<Response> {
    const handler: MethodHandler = getHandler(request.method);
    if (!RDFStore.isRDFRequest(request)) {
      // We're not going to handle it, return a partial response in fetch
      return undefined;
    }
    if (!handler) {
      return undefined;
    }
    // When we call an external fetch, pass this fetch as the new fetch, anything invoked inside
    // will only ever use this fetch within that set
    const fetcher = options.fetchNext || (
      (request: Request) => (options.fetch || this.fetch)(request, {
        ...options,
        fetch: this.fetch
      } as RDFStoreOptions)
    );
    return handler(request, options, fetcher);
  }

  readonly fetch = async (request: Request, options: RDFStoreOptions = undefined): Promise<Response> => {
    const newOptions = {
      ...this.options,
      ...(options || {})
    };
    // Handle our request if we can, then add our headers
    const response = (await this.handle(request, newOptions)) || new PartialResponse();
    appendLinks(request, response.headers, newOptions);
    return response;
  };

}
