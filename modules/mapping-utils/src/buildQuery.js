import { FilterProcessor } from '@arranger/middleware';

export default ({ filters = {}, score, nested_fields }) =>
  new FilterProcessor().buildFilters(nested_fields, filters);
