import { Request, Response } from "@opennetwork/http-representation";

export type RDFStoreOptions = {
  metaSuffix?: "string";
  aclSuffix?: "string";
  findAvailablePOSTUrl: (baseUrl: string) => Promise<string>,
  live?: boolean;
  liveOrigin?: string;
  getDataBrowser?: (request: Request, resource?: Response) => Promise<Response>;
  fetch: (request: Request, options: RDFStoreOptions) => Promise<Response>
};
