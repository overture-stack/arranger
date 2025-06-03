import { useEffect } from "react";
import { useChartsContext } from "./Provider";
import { ChartContainer } from "./ChartContainer";

type ChartProps = {
  fieldName: string;
  config: {};
  headless?: boolean;
  children?: React.ReactElement;
  DisplayComponent?: React.ReactElement;
};

// Container => Comp
export const Chart: React.PropsWithChildren<ChartProps> = ({
  fieldName,
  config,
  children,
  headless,
  DisplayComponent,
}: ChartProps) => {
  const { registerChart, deregisterChart, getChartData } = useChartsContext();

  useEffect(() => {
    try {
      registerChart({ fieldName });
    } catch (e) {
      console.log("");
    }
    return () => {
      deregisterChart({ fieldName });
    };
  }, []);

  const data = getChartData({ fieldName });

  // headless
  if (headless) {
    if (typeof children === "function") {
      return children({ data });
    }
    console.error(
      "Arranger Charts Headless component needs a function as children to render."
    );
  }

  // child component
  if (data.isLoading) {
    return <div> Loading</div>;
  } else if (data.isError) {
    return <div> Error</div>;
  } else if (data.data === undefined) {
    return <div> no data</div>;
  } else {
    return (
      <ChartContainer>
        <DisplayComponent data={data.data} config={config} />
      </ChartContainer>
    );
  }
};
