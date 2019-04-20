import { PartialResponse, Request, Response } from "@opennetwork/http-representation";
import { Store } from "@opennetwork/http-store";
import { RDFStoreOptions } from "./options";
import { METHODS, MethodHandler, handleMutate } from "./methods";
import appendLinks from "./append-links";
import isType, { isOneOfType } from "./is-type";
import isAccepted, { isOneOfAccepted } from "./is-accepted";
import { RDF_MIME_TYPES } from "./mime-types";

function isMutationMethod(methodUpper: string) {
  return ["PUT", "POST", "DELETE"].indexOf(methodUpper) > -1;
}

function getHandler(method: string): MethodHandler {
  const upper = method.toUpperCase();
  return METHODS[upper] || (isMutationMethod(upper) ? handleMutate : undefined);
}

class RDFStore implements Store {

  private readonly options: RDFStoreOptions;

  constructor(options: RDFStoreOptions) {
    this.options = options;
  }

  static isRDFRequest(request: Request, dataBrowser: boolean): boolean {
    if (isOneOfType(request.headers, RDF_MIME_TYPES) || isOneOfType(request.headers, ["application/sparql-update", "text/n3"])) {
      console.log(request.url, "allowed via one of");
      return true;
    }
    if (isType(request.headers, "multipart/form-data")) {
      console.log(request.url, "allowed via multipart");
      return true;
    }
    // OPTIONS is handled via partial response
    if (!["GET", "HEAD"].includes(request.method.toUpperCase())) {
      console.log(request.url, "not allowed via get or head");
      return false;
    }
    if (dataBrowser && isAccepted(request.headers, "text/html")) {
      return true;
    }
    return isOneOfAccepted(request.headers, RDF_MIME_TYPES);
  }

  private handle(request: Request, options: RDFStoreOptions = undefined): Promise<Response> {
    const handler: MethodHandler = getHandler(request.method);
    if (!handler) {
      return undefined;
    }
    if (!RDFStore.isRDFRequest(request, !!this.options.getDataBrowser)) {
      // We're not going to handle it, return a partial response in fetch
      return undefined;
    }
    // When we call an external fetch, pass this fetch as the new fetch, anything invoked inside
    // will only ever use this fetch within that set
    const fetcher = (request: Request) => (options.fetch || this.fetch)(request, {
      ...options,
      fetch: this.fetch
    } as RDFStoreOptions);
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

export default RDFStore;
