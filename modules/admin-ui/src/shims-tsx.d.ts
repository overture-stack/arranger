declare type GlobalFetch = {
  fetch(input: RequestInfo, init?: RequestInit): Promise<Response>;
};
