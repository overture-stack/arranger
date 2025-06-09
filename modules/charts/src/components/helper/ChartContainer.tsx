import { css } from "@emotion/react";
import { PropsWithChildren } from "react";

/**
 * Use to render response chart correctly in container
 */
export const ChartContainer = ({
  children,
  height,
}: PropsWithChildren<{ height?: any }>) => (
  <div css={css({ flex: 1, position: "relative" })}>
    <div
      css={css({
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: height || "100%",
      })}
    >
      {children}
    </div>
  </div>
);
