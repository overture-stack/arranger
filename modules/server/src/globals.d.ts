declare module NodeJS {
  interface Global {
    __basedir: string;
  }
}

declare var __basedir: string;

declare namespace Express {
  export interface Request {
    context: any;
  }
}
