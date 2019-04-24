import { PartialResponse } from "@opennetwork/http-representation";

export default () => new PartialResponse(
  undefined,
  {
    headers: {
      "Vary": "Accept"
    }
  }
);
