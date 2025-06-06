import { Chart } from "../Chart";

/**
 * Headless chart, that provides ChartProvider functionality without a UI component
 * @param props
 * @param props.fieldName - gql field name
 * @param props.children - render function
 * @returns Headless component
 */
export const Headless = ({ fieldName, children }) => {
  return (
    <Chart fieldName={fieldName} headless>
      {children}
    </Chart>
  );
};
