import handleGet from "./get";
import handleMutate from "./mutate";
import handlePatch from "./patch";
import { Request, Response } from "@opennetwork/http-representation";
import { RDFStoreOptions } from "../options";
import { Fetcher } from "@opennetwork/http-store";

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
