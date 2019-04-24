import { Request } from "@opennetwork/http-representation";
import { Fetcher } from "@opennetwork/http-store";

export type RDFStoreOptions = {
  metaSuffix?: "string";
  aclSuffix?: "string";
  live?: boolean;
  liveOrigin?: string;
  fetch?: Fetcher;
  fetchNext?: Fetcher;
  getContentLocation?: (request: Request) => Promise<string>;
};
