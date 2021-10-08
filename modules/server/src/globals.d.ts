declare module NodeJS {
  interface Global {
    __basedir: string;
  }
}

declare var __basedir: string;
