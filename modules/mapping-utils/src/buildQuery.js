import { FilterProcessor } from '@arranger/middleware'

export default ({ type, filters = {}, score, nested_fields }) =>
    new FilterProcessor().buildFilters(type.name.toLowerCase(),nested_fields,filters)
