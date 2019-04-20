import { Request, Response } from "@opennetwork/http-representation";
import { Fetcher } from "@opennetwork/http-store";

export type RDFStoreOptions = {
  metaSuffix?: "string";
  aclSuffix?: "string";
  live?: boolean;
  liveOrigin?: string;
  getDataBrowser?: (request: Request, resource?: Response) => Promise<Response>;
  fetch?: Fetcher;
  fetchNext?: Fetcher;
  getContentLocation?: (request: Request) => Promise<string>;
};
