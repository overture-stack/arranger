import { ResponsiveBar } from "@nivo/bar";
import { Chart } from "../../Chart";
import { defaultConfig } from "./config";
import { get } from "lodash";
import { useChartsContext } from "../../Provider";

type ArrangerChart = React.FC<{ data: {}; config: {} }>;

const BarchartComp: ArrangerChart = ({ data, config }) => {
  const barchartData = get(data, "buckets");
  const { theme } = useChartsContext();
  // cleaner resolved config, acc for nested values eg. axis label
  // const resolvedConfig = getResolvedConfig();
  console.log("barchart", barchartData, config);
  const c = { ...defaultConfig, ...config, theme };

  return <ResponsiveBar data={barchartData} {...c} />;
};

export const Barchart = ({ fieldName, config }): React.ReactElement => {
  return (
    <Chart
      fieldName={fieldName}
      config={config}
      DisplayComponent={BarchartComp}
    />
  );
};
