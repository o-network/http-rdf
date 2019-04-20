import handleGet from "./get";
import handleMutate from "./mutate";
import handlePatch from "./patch";
import { Request, Response } from "@opennetwork/http-representation";
import { RDFStoreOptions } from "../options";

export type Fetcher = (request: Request) => Promise<Response>;
export type MethodHandler = (request: Request, options: RDFStoreOptions, fetch: Fetcher) => Promise<Response>;

export {
  handleGet,
  handleMutate,
  handlePatch
};

export const METHODS: { [key: string /* RequestMethod */]: MethodHandler } = {
  GET: handleGet,
  PATCH: handlePatch
};
