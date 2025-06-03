/**
 *
 *
 *
 *
 * REFERENCE ONLY
 *
 *
 */
import { ResponsiveBar } from "@nivo/bar";

type SupportedChart = {
  lib: string;
  ChartComponent: React.ElementType;
  chartType: string; // 'Aggregations' |  NumericAggregations
};

const supportedAggregationCharts: Record<string, SupportedChart> = {
  default: {
    lib: "nivo",
    ChartComponent: ResponsiveBar,
    config: {},
  },
};

const supportedCharts = {
  Aggregations: supportedAggregationCharts,
};

export const getChartConfig = ({
  type,
  variant = "default",
}: {
  type: string;
  variant?: string;
}) => {
  if (!type) {
    console.error("no chart type provided");
  }
  return supportedCharts[type][variant];
};
