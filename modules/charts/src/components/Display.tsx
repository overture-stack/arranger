/**
 *
 *
 *
 *
 * REFERENCE ONLY
 *
 *
 */

import { defaultConfig } from "./configs/bar/defaultConfig";
import { useChartsContext } from "./Provider";

const resolveConfigs = (libConfig, userConfig) => ({
  ...libConfig,
  ...userConfig,
});

const barTransform = (obj) => obj.buckets;

export const ChartDisplay = ({ type, consumerConfig, variant, data }) => {
  const chartsContext = useChartsContext();
  const chartConfig = getChartConfig({ type, variant }); // should be static
  console.log("chart config", chartConfig);
  // 1. check is supported
  //const default: {Component: any: config: any} = {}
  // const ChartComponent =  SUPPORTED_CHART[lib][bar]
  //return <ChartComponent {...config}/>

  console.log("BarChartDisplay", data);

  // TODO: error handling

  /**
   * rendering library specific charts, different interfaces
   * data + config +(consumer config)= result
   */
  const Comp = chartConfig.ChartComponent;
  if (chartConfig.lib === "nivo") {
    //const props = formatter('nivo', 'line', props)
    const chartData = barTransform(data); // format
    const resolvedConfig = resolveConfigs(
      defaultConfig(),
      consumerConfig || {}
    );
    console.log(
      "DISPLAY",
      JSON.stringify({ data: chartData, config: resolvedConfig })
    );
    return (
      <Comp
        {...resolvedConfig}
        data={chartData}
        onClick={(data) => {
          console.log("on click", data);
          // TODO: interface of this is v important, should be consistent. essentially trying to have a consistent Arranger layer over the madness of charts + ui
          chartsContext.update({
            fieldName: "xxx",
            // type too, so we go (field: {name,type}, eventData) => SQON
            eventData: data,
          });
        }}
      />
    );
  }
};

// context vs prop, is all bar charts vs individual, so will need to use prop too
